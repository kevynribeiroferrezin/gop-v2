"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import AppShell from "../../src/components/AppShell";
import AttendanceTable from "../../src/components/AttendanceTable";
import ScopeControls from "../../src/components/ScopeControls";
import { activeProfile, attendancePeriod, coordinatorList, supervisorList } from "../../src/lib/workspace-data";
import { filterScope, STATUS_LABELS, type Profile, type Coordinator, type Supervisor, type AttendanceRow, type ViewScope } from "../../src/lib/workspace-types";
import { attendanceCsv, downloadCsv, validatePeriod, monthPeriod, pendingCalls, pendingCallsCsv } from "../../src/lib/reports";
import { dataHojeBrasil } from "../../src/lib/dates";

export default function ReportsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [start, setStart] = useState(dataHojeBrasil);
  const [end, setEnd] = useState(dataHojeBrasil);
  const [loaded, setLoaded] = useState({ start: "", end: "" });
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [scope, setScope] = useState<ViewScope>({ mode: "geral", id: "" });
  const [onlyPending, setOnlyPending] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const load = useCallback(async (first: string, last: string, signal?: AbortSignal) => {
    const request = ++requestId.current;
    setLoading(true); setError("");
    try {
      validatePeriod(first, last);
      const current = await activeProfile();
      if (!current) { router.replace("/login"); return; }
      const [records, people, coords] = await Promise.all([attendancePeriod(first, last), supervisorList(), current.role === "admin" ? coordinatorList() : Promise.resolve([])]);
      if (signal?.aborted || request !== requestId.current) return;
      setProfile(current); setRows(records); setSupervisors(people); setCoordinators(coords); setLoaded({ start: first, end: last });
    } catch (error) { if (!signal?.aborted && request === requestId.current) setError(error instanceof Error ? error.message : "Não foi possível gerar o relatório."); }
    finally { if (!signal?.aborted && request === requestId.current) setLoading(false); }
  }, [router]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { const today = dataHojeBrasil(); void load(today, today, controller.signal); } });
    return () => controller.abort();
  }, [load]);
  const filtered = useMemo(() => filterScope(rows, scope).filter((row) =>
    (!onlyPending || row.chamada_pendente) && (!status || row.status_presenca === status) &&
    `${row.funcionario_nome} ${row.nome_smart ?? ""} ${row.matricula} ${row.supervisor_nome}`.toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR"))), [rows, scope, onlyPending, status, search]);
  const dirty = Boolean(loaded.start) && (start !== loaded.start || end !== loaded.end);
  const canExportCollection = Boolean(profile?.ativo && (profile.role === "admin" || profile.role === "coordenador"));
  // Collection uses the hierarchy selection and period. Status/search filters on
  // individual employees must not silently omit teams from a collection file.
  const collectionRows = useMemo(() => filterScope(rows, scope).filter((row) => row.chamada_pendente), [rows, scope]);
  const collection = useMemo(() => pendingCalls(collectionRows), [collectionRows]);
  function quickPeriod(previous?: boolean) {
    const period = previous === undefined ? { start: dataHojeBrasil(), end: dataHojeBrasil() } : monthPeriod(dataHojeBrasil(), previous);
    setStart(period.start); setEnd(period.end);
    void load(period.start, period.end);
  }
  function exportRows() {
    if (loading || dirty || error || !filtered.length) return;
    downloadCsv(`presencas-${onlyPending ? "pendentes-" : ""}${loaded.start}-${loaded.end}.csv`, attendanceCsv(filtered));
  }
  async function exportCollection() {
    if (!canExportCollection || loading || dirty || error || !collection.length) return;
    const current = await activeProfile();
    if (!current || current.id !== profile?.id || !["admin", "coordenador"].includes(current.role)) {
      setError("Seu perfil não tem permissão para baixar arquivos de cobrança.");
      return;
    }
    downloadCsv(`cobranca-pendencias-${loaded.start}-${loaded.end}.csv`, pendingCallsCsv(collectionRows));
  }
  return <AppShell active="relatorios">
    <header className="page-heading"><div><p className="eyebrow">Consulta e exportação</p><h1>Relatórios de presenças</h1><p className="page-description">Exporte os registros permitidos ao seu perfil, com os filtros da seleção.</p></div><button type="button" className="button-primary" disabled={loading || dirty || Boolean(error) || !filtered.length} onClick={exportRows}><Download size={17} /> Exportar {filtered.length} registros · CSV</button></header>
    <form className="surface report-filters" onSubmit={(event) => { event.preventDefault(); void load(start, end); }}>
      <div className="report-shortcuts" aria-label="Períodos rápidos"><span>Período rápido</span><button type="button" className="button-secondary" disabled={loading} onClick={() => quickPeriod()}>Hoje</button><button type="button" className="button-secondary" disabled={loading} onClick={() => quickPeriod(false)}>Mês atual</button><button type="button" className="button-secondary" disabled={loading} onClick={() => quickPeriod(true)}>Mês passado</button></div>
      <label>Data inicial<input type="date" aria-label="Data inicial do relatório" required value={start} onChange={(event) => setStart(event.target.value)} /></label>
      <label>Data final<input type="date" aria-label="Data final do relatório" required value={end} onChange={(event) => setEnd(event.target.value)} /></label>
      <label>Status<select aria-label="Status da presença no relatório" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="submit" className="button-secondary" disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : null} Gerar relatório</button>
      <label className="checkbox-label"><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} /> Somente chamadas pendentes</label>
    </form>
    {profile && <ScopeControls profile={profile} supervisors={supervisors} coordinators={coordinators} scope={scope} onChange={setScope} />}
    {canExportCollection && !loading && !error && <section className="surface collection-export"><div><h2>Pendências para cobrança</h2><p>{collection.length} chamadas não finalizadas · {new Set(collection.map((item) => item.supervisorId)).size} supervisores. Um registro por supervisor e data, no período e na equipe selecionados.</p><small>Este resumo inclui todas as pendências da seleção, independentemente da busca ou do filtro de status.</small></div><button type="button" className="button-secondary" disabled={dirty || !collection.length} onClick={() => { void exportCollection(); }}><Download size={17} /> Baixar pendências para cobrança</button></section>}
    <p className="report-note">Consulte até 31 dias por vez. Mês atual considera do dia 1 até hoje; mês passado considera o mês completo. “Pendente” indica que a chamada ainda não foi finalizada. O status padrão “Presente” não confirma o fechamento.</p>
    {dirty && !loading && !error && <p role="status" className="auth-message">Período alterado. Gere o relatório para atualizar os dados e liberar a exportação.</p>}
    {error && <p role="alert" className="auth-message error">{error}</p>}
    {loading ? <div className="page-loading" role="status"><Loader2 className="animate-spin" /><p>Buscando os registros do período…</p></div> : !error && <AttendanceTable rows={filtered} title="Presenças do período" showDate searchText={search} onSearchChange={setSearch} />}
  </AppShell>;
}
