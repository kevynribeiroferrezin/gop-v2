export const ROLES = ["admin", "coordenador", "supervisor", "rh"] as const;
export type Role = typeof ROLES[number];
export type Profile = { id: string; user_id: string; nome: string; role: Role; ativo: boolean };
export type Supervisor = { id: string; nome: string; codigo: string; email: string; ativo: boolean; coordenador_profile_id: string | null };
export type Coordinator = { id: string; nome: string; ativo: boolean };
export type WorkMode = "nao_informado" | "home_office" | "presencial" | "hibrido";
export const WORK_MODES: Record<WorkMode, string> = {
  nao_informado: "Não informado", home_office: "Home office", presencial: "Presencial", hibrido: "Híbrido",
};
export const STATUS_LABELS: Record<string, string> = {
  presente: "Presente", falta: "Falta", atraso: "Atraso", atestado: "Atestado", folga: "Folga", ferias: "Férias", afastado: "Afastado",
};
export type AttendanceRow = {
  data_referencia: string; funcionario_id: string; matricula: string;
  funcionario_nome: string; nome_smart: string | null; modalidade_trabalho: WorkMode;
  cargo_nome: string; supervisor_id: string; supervisor_nome: string;
  coordenador_profile_id: string | null; status_presenca: string;
  possui_registro_manual: boolean; chamada_pendente: boolean;
};
export type ViewScope = { mode: "geral" | "coordenador" | "supervisor"; id: string };
export function filterScope(rows: AttendanceRow[], scope: ViewScope) {
  if (scope.mode === "geral") return rows;
  if (!scope.id) return [];
  return rows.filter((row) => scope.mode === "coordenador"
    ? row.coordenador_profile_id === scope.id : row.supervisor_id === scope.id);
}
