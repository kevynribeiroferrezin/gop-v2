import { supabase } from "./supabase/client";
import { collectPages, validatePeriod } from "./reports";
import { ROLES, type AttendanceRow, type Profile, type Supervisor, type Coordinator } from "./workspace-types";
import { missingSchema } from "./schema-errors";
import { dataHojeBrasil } from "./dates";

async function requireProfile() {
  const profile = await activeProfile();
  if (!profile) throw new Error("Sua sessão expirou. Entre novamente.");
  return profile;
}

async function allowedSupervisors(profile: Profile): Promise<string[] | null> {
  if (profile.role === "admin" || profile.role === "rh") return null;
  const column = profile.role === "supervisor" ? "profile_id" : "coordenador_profile_id";
  const { data, error } = await supabase.from("supervisores").select("id").eq(column, profile.id).eq("ativo", true);
  if (error) throw new Error("Não foi possível validar o vínculo da sua equipe. Contate a administração.");
  return (data ?? []).map((item) => item.id as string);
}

export async function activeProfile(): Promise<Profile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.from("profiles")
    .select("id, user_id, nome, role, ativo").eq("user_id", session.user.id).single();
  if (error || !data?.ativo || !ROLES.includes(data.role)) return null;
  return data as Profile;
}

export async function attendancePeriod(start: string, end: string, employeeId?: string) {
  validatePeriod(start, end);
  const profile = await requireProfile();
  const allowed = await allowedSupervisors(profile);
  if (allowed?.length === 0) return [];
  try {
    const rows = await collectPages<AttendanceRow>(async (offset, last) => {
      let query = supabase.rpc("relatorio_presencas", { p_inicio: start, p_fim: end });
      if (allowed) query = query.in("supervisor_id", allowed);
      if (employeeId) query = query.eq("funcionario_id", employeeId);
      const { data, error } = await query.order("data_referencia").order("supervisor_id").order("funcionario_id").range(offset, last);
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    });
    return rows.filter((row) => (!allowed || allowed.includes(row.supervisor_id)) && (!employeeId || row.funcionario_id === employeeId));
  } catch (error) {
    if (!missingSchema(error as { code?: string })) throw new Error("Não foi possível carregar as presenças. Tente novamente.");
  }
  // Existing installations already expose the daily call. Reuse that contract
  // without requiring the optional coordination/report migration.
  const rows: AttendanceRow[] = [];
  for (let day = start; day <= end;) {
    const date = day;
    const closed = await closedSupervisors(date, allowed);
    const daily = await collectPages<AttendanceRow>(async (offset, last) => {
      let query = supabase.rpc("get_chamada_por_data", { p_data: date })
        .select("funcionario_id,matricula,funcionario_nome,cargo_nome,supervisor_id,supervisor_nome,status_presenca,possui_registro_manual");
      if (allowed) query = query.in("supervisor_id", allowed);
      if (employeeId) query = query.eq("funcionario_id", employeeId);
      const { data, error } = await query.order("supervisor_id").order("funcionario_id").range(offset, last);
      if (error) throw new Error("Não foi possível carregar as presenças da equipe.");
      return ((data ?? []) as unknown as AttendanceRow[]).filter((row) => (!allowed || allowed.includes(row.supervisor_id)) && (!employeeId || row.funcionario_id === employeeId)).map((row) => ({
        ...row, data_referencia: date, nome_smart: null, modalidade_trabalho: "nao_informado",
        coordenador_profile_id: profile.role === "coordenador" ? profile.id : null,
        chamada_pendente: date <= dataHojeBrasil() && !closed.includes(row.supervisor_id),
      })) as AttendanceRow[];
    });
    rows.push(...daily);
    if (rows.length > 50000) throw new Error("Reduza o período do relatório para até 50 mil registros.");
    day = new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  }
  return rows;
}

export async function closedSupervisors(date: string, allowed?: string[] | null) {
  return collectPages<string>(async (offset, last) => {
    let query = supabase.from("fechamentos_chamada").select("supervisor_id").eq("data_chamada", date);
    if (allowed) query = query.in("supervisor_id", allowed);
    const { data, error } = await query.order("supervisor_id").range(offset, last);
    if (error) throw new Error("Não foi possível conferir o fechamento da chamada.");
    return (data ?? []).map((row) => row.supervisor_id as string);
  });
}

export async function supervisorList(): Promise<Supervisor[]> {
  const profile = await requireProfile();
  const allowed = await allowedSupervisors(profile);
  if (allowed?.length === 0) return [];
  return collectPages(async (offset, last) => {
    const read = async (fields: string) => {
      let query = supabase.from("supervisores").select(fields);
      if (allowed) query = query.in("id", allowed);
      return query.order("nome").order("id").range(offset, last);
    };
    let { data, error } = await read("id, nome, codigo, email, ativo, coordenador_profile_id");
    if (missingSchema(error)) ({ data, error } = await read("id, nome, codigo, email, ativo"));
    if (error) throw new Error("Não foi possível carregar os supervisores.");
    return ((data ?? []) as unknown as Supervisor[]).map((row) => ({ ...row, coordenador_profile_id: row.coordenador_profile_id ?? null }));
  });
}

const employeeFields = "id,matricula,nome,cargo_id,cargo_codigo,cargo_nome,supervisor_id,supervisor_codigo,supervisor_nome,data_admissao,status,ativo,observacao,regional_id,regional_codigo,regional_nome";
export async function employeeList() {
  const profile = await requireProfile();
  const allowed = await allowedSupervisors(profile);
  if (allowed?.length === 0) return { rows: [], workFields: false };
  let modern = true;
  const rows = await collectPages<Record<string, unknown>>(async (offset, last) => {
    const read = async (view: string, fields: string) => {
      let query = supabase.from(view).select(fields);
      if (allowed) query = query.in("supervisor_id", allowed);
      return query.order("nome").order("id").range(offset, last);
    };
    let result = modern ? await read("vw_colaboradores_acesso", `${employeeFields},nome_smart,modalidade_trabalho`)
      : await read("vw_funcionarios_completo", employeeFields);
    if (modern && missingSchema(result.error)) {
      modern = false;
      result = await read("vw_funcionarios_completo", employeeFields);
    }
    if (result.error) throw new Error("Não foi possível carregar os colaboradores da sua equipe. Tente novamente.");
    return ((result.data ?? []) as unknown as Record<string, unknown>[]).filter((row) => !allowed || allowed.includes(row.supervisor_id as string))
      .map((row) => ({ ...row, nome_smart: row.nome_smart ?? null, modalidade_trabalho: row.modalidade_trabalho ?? "nao_informado" }));
  });
  return { rows, workFields: modern };
}
export async function coordinatorList(): Promise<Coordinator[]> {
  return collectPages(async (offset, last) => {
    const { data, error } = await supabase.from("profiles").select("id, nome, ativo")
      .eq("role", "coordenador").order("nome").order("id").range(offset, last);
    if (error) throw new Error("Não foi possível carregar os coordenadores.");
    return (data ?? []) as Coordinator[];
  });
}
