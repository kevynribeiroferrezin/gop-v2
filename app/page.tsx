"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import AppShell from "../src/components/AppShell";
import DashboardView from "../src/components/DashboardView";
import ScopeControls from "../src/components/ScopeControls";
import AttendanceTable from "../src/components/AttendanceTable";
import ReminderInbox from "../src/components/ReminderInbox";
import CoordinatorOverview from "../src/components/CoordinatorOverview";
import { activeProfile, attendancePeriod, supervisorList, coordinatorList } from "../src/lib/workspace-data";
import { filterScope, type Profile, type AttendanceRow, type Supervisor, type Coordinator, type ViewScope } from "../src/lib/workspace-types";
import { supabase } from "../src/lib/supabase/client";
import { dataHojeBrasil } from "../src/lib/dates";

export type DashboardResumo = {
  data_referencia: string; total_presentes: number; total_faltas: number; total_atrasos: number;
  total_atestados: number; total_folgas: number; total_ferias: number; total_afastados: number;
  total_equipes: number; total_equipes_finalizadas: number; total_funcionarios_ativos: number;
  total_presencas_lancadas: number; total_pendentes: number;
};
export type ChamadaPendente = {
  data_pendente: string; supervisor_id: string; supervisor_nome: string; supervisor_email: string;
  total_funcionarios: number; total_excecoes_registradas: number; chamada_pendente: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const [date, setDate] = useState(dataHojeBrasil);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [closed, setClosed] = useState<string[]>([]);
  const [scope, setScope] = useState<ViewScope>({ mode: "geral", id: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const requestId = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const request = ++requestId.current;
    setLoading(true); setError(""); setMessage(""); setSent([]);
    try {
      const current = await activeProfile();
      if (!current) { router.replace("/login"); return; }
      const [records, people, coords] = await Promise.all([
        attendancePeriod(date, date), supervisorList(), current.role === "admin" ? coordinatorList() : Promise.resolve([]),
      ]);
      const closures = [...new Set(records.filter((row) => !row.chamada_pendente && date <= dataHojeBrasil()).map((row) => row.supervisor_id))];
      if (signal?.aborted || request !== requestId.current) return;
      setProfile(current); setRows(records); setSupervisors(people); setCoordinators(coords); setClosed(closures);
    } catch (error) {
      if (!signal?.aborted && request === requestId.current) setError(error instanceof Error ? error.message : "Não foi possível carregar o painel.");
    } finally { if (!signal?.aborted && request === requestId.current) setLoading(false); }
  }, [date, router]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load]);

  const visible = useMemo(() => filterScope(rows, scope), [rows, scope]);
  const coordinationView = profile?.role === "coordenador" || (profile?.role === "admin" && scope.mode === "coordenador");
  const pending = useMemo<ChamadaPendente[]>(() => {
    if (date > dataHojeBrasil()) return [];
    const groups = new Map<string, ChamadaPendente>();
    for (const row of visible) {
      if (closed.includes(row.supervisor_id)) continue;
      const group = groups.get(row.supervisor_id) ?? { data_pendente: date, supervisor_id: row.supervisor_id,
        supervisor_nome: row.supervisor_nome, supervisor_email: "", total_funcionarios: 0,
        total_excecoes_registradas: 0, chamada_pendente: true };
      group.total_funcionarios++;
      if (row.status_presenca !== "presente") group.total_excecoes_registradas++;
      groups.set(row.supervisor_id, group);
    }
    return [...groups.values()].sort((a, b) => a.supervisor_nome.localeCompare(b.supervisor_nome));
  }, [visible, closed, date]);
  const resumo = useMemo<DashboardResumo>(() => {
    const count = (status: string) => visible.filter((row) => row.status_presenca === status).length;
    const teams = [...new Set(visible.map((row) => row.supervisor_id))];
    return { data_referencia: date, total_presentes: count("presente"), total_faltas: count("falta"), total_atrasos: count("atraso"),
      total_atestados: count("atestado"), total_folgas: count("folga"), total_ferias: count("ferias"), total_afastados: count("afastado"),
      total_equipes: teams.length, total_equipes_finalizadas: teams.filter((id) => closed.includes(id)).length,
      total_funcionarios_ativos: visible.length, total_presencas_lancadas: visible.filter((row) => row.possui_registro_manual).length,
      total_pendentes: pending.length };
  }, [visible, closed, date, pending.length]);

  async function remind(supervisorId: string) {
    setSending(supervisorId); setMessage("");
    const { error } = await supabase.rpc("cobrar_chamada", { p_supervisor_id: supervisorId, p_data: date });
    if (error) setMessage("Não foi possível cobrar. A chamada pode ter sido finalizada ou estar fora da sua responsabilidade.");
    else { setSent((items) => [...items, supervisorId]); setMessage("Cobrança registrada. O supervisor verá a solicitação na visão geral."); }
    setSending("");
  }
  return <AppShell active="dashboard">
    <div className="surface dashboard-date"><div><strong>Visão geral</strong><p>Acompanhe a sua equipe por dia</p></div><label htmlFor="dashboard-date">Data de referência<input id="dashboard-date" type="date" value={date} onChange={(event) => { if (event.target.value) setDate(event.target.value); }} /></label></div>
    {profile && <ScopeControls profile={profile} supervisors={supervisors} coordinators={coordinators} scope={scope} onChange={setScope} />}
    {loading && <div className="page-loading" role="status"><Loader2 size={24} className="animate-spin" /><p>Preparando o panorama da equipe…</p></div>}
    {error && <div className="surface empty-state" role="alert"><AlertTriangle size={28} /><strong>Não foi possível carregar o painel.</strong><p>{error}</p><button type="button" className="button-secondary mt-5" onClick={() => { void load(); }}>Tentar novamente</button></div>}
    {!loading && !error && profile && <>
      {profile.role === "supervisor" && <ReminderInbox />}
      {message && <p className="auth-message" role="status">{message}</p>}
      {coordinationView ? <CoordinatorOverview key={`${scope.mode}:${scope.id}:${date}`} rows={visible} resumo={resumo} pending={pending} onRemind={remind} sending={sending} sent={sent} /> : <><DashboardView resumo={resumo} pendentes={pending} supervisorView={profile.role === "supervisor" || scope.mode === "supervisor"} canCall={profile.role === "admin" || profile.role === "supervisor"}
        canRemind={profile.role === "admin" || profile.role === "coordenador"} onRemind={remind} sending={sending} sent={sent}
        onCall={(id) => router.push(id ? `/chamada?equipe=${encodeURIComponent(id)}` : "/chamada")} />
      <AttendanceTable key={`${scope.mode}:${scope.id}:${date}`} rows={visible} title={profile.role === "supervisor" || scope.mode === "supervisor" ? "Status da equipe" : "Status dos colaboradores"} />
      </>}
    </>}
  </AppShell>;
}
