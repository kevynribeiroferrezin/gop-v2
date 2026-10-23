"use client";
import AppShell, { PageLoading } from "../../src/components/AppShell";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, LockKeyhole, Save, Search } from "lucide-react";
import { supabase } from "../../src/lib/supabase/client";
import { dataHojeBrasil } from "../../src/lib/dates";
import { activeProfile, supervisorList } from "../../src/lib/workspace-data";
import { collectPages } from "../../src/lib/reports";
import { missingSchema } from "../../src/lib/schema-errors";
import { STATUS_LABELS } from "../../src/lib/workspace-types";
import { detailError, emptyDetails, normalizeDetails, type AttendanceDetails, type AttendanceStatus } from "../../src/lib/attendance";
import AttendanceDetailsFields from "../../src/components/AttendanceDetailsFields";
import { StatusBadge } from "../../src/components/AttendanceTable";

type Item = { funcionario_id: string; matricula: string; funcionario_nome: string; cargo_nome: string;
  supervisor_id: string; supervisor_codigo: string; supervisor_nome: string; data_presenca: string;
  status_presenca: AttendanceStatus; observacao: string | null; possui_registro_manual: boolean };
type Draft = AttendanceDetails & { status: AttendanceStatus; observacao: string };
type Stored = AttendanceDetails & { funcionario_id: string; supervisor_id: string; status: AttendanceStatus; observacao: string | null };
type CallState = { versao: number; registros: Stored[]; fechamentos: string[] };
type VacationPeriod = { versao: number; inicio: string; fim: string; token: string; dias_bloqueados: number };
type VacationForm = { employee: Item; start: string; end: string; original?: VacationPeriod; reference: string };
const statuses = Object.keys(STATUS_LABELS) as AttendanceStatus[];
function savedDraft(row: Item, stored?: Stored): Draft {
  return { ...emptyDetails, ...stored, status: stored?.status ?? row.status_presenca ?? "presente", observacao: stored?.observacao ?? row.observacao ?? "" };
}
function saveError(error: { code?: string; message?: string }) {
  if (missingSchema(error)) return "As novas regras precisam ser habilitadas no banco. Solicite a aplicação da migração 007 à administração.";
  if (error.code === "55000") return "Registro bloqueado: as férias já foram gravadas ou a chamada foi finalizada. Atualize a tela para consultar os dados atuais.";
  if (error.code === "42501") return "Sem permissão para alterar esta equipe. Atualize a tela para conferir seu vínculo.";
  return "Não foi possível salvar. Confira os detalhes obrigatórios e tente novamente.";
}
export default function ChamadaPage() {
  const router = useRouter();
  const [date, setDate] = useState(dataHojeBrasil);
  const [rows, setRows] = useState<Item[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [original, setOriginal] = useState<Record<string, Draft>>({});
  const [closed, setClosed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [team, setTeam] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [vacation, setVacation] = useState<VacationForm | null>(null);
  const requestId = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const request = ++requestId.current;
    setLoading(true); setError(""); setSuccess(""); setReady(false); setVacation(null);
    try {
      const profile = await activeProfile();
      if (!profile) { router.replace("/login"); return; }
      if (!["admin", "supervisor"].includes(profile.role)) { router.replace("/acesso-negado"); return; }
      const teams = (await supervisorList()).filter((item) => item.ativo);
      const ids = teams.map((item) => item.id);
      const records = ids.length ? await collectPages<Item>(async (offset, last) => {
        const { data, error } = await supabase.rpc("get_chamada_por_data", { p_data: date })
          .select("funcionario_id,matricula,funcionario_nome,cargo_nome,supervisor_id,supervisor_codigo,supervisor_nome,data_presenca,status_presenca,observacao,possui_registro_manual")
          .in("supervisor_id", ids).order("supervisor_id").order("funcionario_id").range(offset, last);
        if (error) throw new Error("Não foi possível carregar a chamada.");
        return ((data ?? []) as unknown as Item[]).filter((row) => ids.includes(row.supervisor_id));
      }) : [];
      const { data: state, error: stateError } = await supabase.rpc("estado_chamada", { p_data: date });
      if (stateError && !missingSchema(stateError)) throw new Error("Não foi possível conferir as travas da chamada. A edição está bloqueada até essa verificação.");
      const current = !stateError && state?.versao === 1 ? state as CallState : null;
      const stored = new Map((current?.registros ?? []).filter((item) => ids.includes(item.supervisor_id)).map((item) => [item.funcionario_id, item]));
      const initial = Object.fromEntries(records.map((row) => [row.funcionario_id, savedDraft(row, stored.get(row.funcionario_id))]));
      if (signal?.aborted || request !== requestId.current) return;
      setRows(records); setDrafts(initial); setOriginal(initial); setClosed(current?.fechamentos ?? []); setReady(Boolean(current)); setIsAdmin(profile.role === "admin");
      const requested = new URLSearchParams(window.location.search).get("equipe");
      setTeam((previous) => records.some((row) => row.supervisor_id === previous) ? previous : requested && records.some((row) => row.supervisor_id === requested) ? requested : records[0]?.supervisor_id ?? "");
    } catch (error) {
      if (!signal?.aborted && request === requestId.current) { setRows([]); setError(error instanceof Error ? error.message : "Não foi possível carregar a chamada."); }
    } finally { if (!signal?.aborted && request === requestId.current) setLoading(false); }
  }, [date, router]);
  useEffect(() => {
    const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load]);
  const teams = useMemo(() => [...new Map(rows.map((row) => [row.supervisor_id, { id: row.supervisor_id, name: row.supervisor_nome }])).values()], [rows]);
  const teamRows = useMemo(() => rows.filter((row) => row.supervisor_id === team), [rows, team]);
  const visible = useMemo(() => teamRows.filter((row) => `${row.funcionario_nome} ${row.matricula} ${row.cargo_nome}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))), [teamRows, search]);
  const finished = closed.includes(team);
  const disabled = saving || !ready || finished;
  const vacationLocked = (row: Item) => !isAdmin && original[row.funcionario_id]?.status === "ferias";
  const exceptions = teamRows.filter((row) => drafts[row.funcionario_id]?.status !== "presente").length;
  const changed = (row: Item) => JSON.stringify(drafts[row.funcionario_id]) !== JSON.stringify(original[row.funcionario_id]);
  const dirty = teamRows.some((row) => !vacationLocked(row) && changed(row));
  function update(row: Item, next: Partial<Draft>) {
    if (disabled || vacationLocked(row)) return;
    setDrafts((current) => ({ ...current, [row.funcionario_id]: { ...current[row.funcionario_id], ...next } }));
  }
  async function openVacation(row: Item) {
    if (disabled || vacationLocked(row)) return;
    if (original[row.funcionario_id]?.status !== "ferias") {
      setVacation({ employee: row, start: date, end: date, reference: date }); return;
    }
    if (!isAdmin) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const { data, error } = await supabase.rpc("consultar_periodo_ferias", { p_funcionario_id: row.funcionario_id, p_referencia: date });
      if (error) { setError(missingSchema(error) ? "O ajuste de períodos ainda não foi habilitado no banco. Aplique a migração 009 para liberar essa ação ao admin." : "Não foi possível consultar o período. Confirme seu acesso de admin e atualize a chamada."); return; }
      if (!data || data.versao !== 1) { setError("O período de férias não foi encontrado. Atualize a chamada antes de editar."); return; }
      const period = data as VacationPeriod;
      setVacation({ employee: row, start: period.inicio, end: period.fim, original: period, reference: date });
    } catch { setError("Não foi possível consultar o período de férias. Tente novamente."); }
    finally { setSaving(false); }
  }
  async function save(finish = false) {
    if (disabled || !teamRows.length) return;
    const candidates = teamRows.filter((row) => !vacationLocked(row) && (finish || changed(row)));
    for (const row of candidates) {
      const draft = drafts[row.funcionario_id];
      const reason = detailError(draft.status, draft);
      if (reason) { setError(`${row.funcionario_nome}: ${reason}`); return; }
    }
    const records = candidates.filter(changed).map((row) => {
      const draft = drafts[row.funcionario_id];
      return { funcionario_id: row.funcionario_id, status: draft.status, observacao: draft.observacao.trim() || null, ...normalizeDetails(draft.status, draft) };
    });
    if (!finish && !records.length) { setSuccess("Nenhuma alteração pendente para salvar."); return; }
    if (!window.confirm(finish ? "Finalizar esta chamada? As alterações serão salvas e a chamada não poderá ser reaberta ou alterada." : `Salvar ${records.length} registro(s) da chamada?`)) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const { error } = await supabase.rpc("salvar_chamada", { p_supervisor_id: team, p_data: date, p_registros: records, p_finalizar: finish });
      if (error) { setError(saveError(error)); return; }
      await load(); setSuccess(finish ? "Chamada finalizada. Todos os registros estão bloqueados para alteração." : "Alterações salvas com sucesso.");
    } catch { setError("Não foi possível salvar. Atualize a chamada e confira os registros antes de tentar novamente."); }
    finally { setSaving(false); }
  }
  async function saveVacation() {
    if (!vacation || disabled || vacationLocked(vacation.employee)) return;
    const { employee, start, end, original: period, reference } = vacation;
    if (period && !isAdmin) return;
    if (!start || !end || end < start || (Date.parse(end) - Date.parse(start)) / 86400000 > 365) { setError("Selecione um período válido de até 366 dias."); return; }
    if (dirty && !window.confirm("Há alterações ainda não salvas. Para registrar o período de férias, a chamada será recarregada e esses rascunhos serão descartados. Continuar?")) return;
    if (period && start === period.inicio && end === period.fim) { setError("Altere a data inicial ou final para salvar o ajuste do período."); return; }
    if (!window.confirm(period ? `Substituir o período de férias de ${employee.funcionario_nome}, de ${period.inicio.split("-").reverse().join("/")} a ${period.fim.split("-").reverse().join("/")}, por ${start.split("-").reverse().join("/")} a ${end.split("-").reverse().join("/")}? Os dias retirados deixarão de estar marcados como férias. Dias finalizados não poderão ser removidos.` : `Registrar férias de ${employee.funcionario_nome} de ${start.split("-").reverse().join("/")} até ${end.split("-").reverse().join("/")}? Depois de gravadas, somente admin poderá alterá-las enquanto a chamada estiver aberta.`)) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const { error } = period
        ? await supabase.rpc("alterar_periodo_ferias", { p_funcionario_id: employee.funcionario_id, p_referencia: reference, p_token: period.token, p_inicio: start, p_fim: end })
        : await supabase.rpc("registrar_ferias", { p_funcionario_id: employee.funcionario_id, p_inicio: start, p_fim: end });
      if (error) {
        setError(period && missingSchema(error) ? "Aplique a migração 009 no banco para habilitar o ajuste de períodos."
          : period && error.code === "40001" ? "Esse período foi alterado em outra sessão. Cancele e abra novamente o ajuste antes de salvar."
          : period && error.code === "23505" ? "O novo período inclui datas com outros registros. Nenhum dia foi alterado; revise essas datas."
          : period && error.code === "55000" ? "O ajuste alteraria uma chamada finalizada. Mantenha esses dias no período; nenhum registro foi alterado."
          : saveError(error)); return;
      }
      await load(); setSuccess(period ? "Período de férias atualizado. As datas anteriores foram substituídas pelo novo período." : "Férias registradas. Somente admin poderá alterar esses lançamentos enquanto a chamada estiver aberta.");
    } catch { setError("Não foi possível registrar as férias. Confira o período e tente novamente."); }
    finally { setSaving(false); }
  }
  if (loading) return <PageLoading active="chamada" message="Conferindo registros e fechamento da chamada…" />;
  return <AppShell active="chamada">
    <header className="page-heading"><div><p className="eyebrow">Chamada diária</p><h1>Controle de presença</h1><p className="page-description">Marque as exceções e informe os detalhes de cada ocorrência.</p></div><div className="call-actions"><button className="button-primary" disabled={disabled || !teamRows.length} onClick={() => { void save(); }}>{saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}Salvar alterações</button><button className="button-secondary" disabled={disabled || !teamRows.length || date > dataHojeBrasil()} onClick={() => { void save(true); }}><CheckCircle2 size={17} />{finished ? "Chamada finalizada" : "Finalizar chamada"}</button></div></header>
    {error && <div className="auth-message error" role="alert">{error}<button type="button" className="button-secondary" disabled={saving} onClick={() => { void load(); }}>Atualizar chamada</button></div>}
    {success && <p className="auth-message success" role="status">{success}</p>}
    {!ready && !error && <p className="auth-message" role="status">A consulta está disponível. Para editar e ativar as travas definitivas, a administração precisa aplicar a migração 007 de ocorrências e fechamento no banco.</p>}
    {finished && <p className="call-lock-notice" role="status"><LockKeyhole size={19} />Chamada finalizada. Nenhum registro desta equipe e data pode ser alterado, inclusive pelo admin.</p>}
    <section className="surface call-toolbar"><div><span>Total</span><strong>{teamRows.length}</strong></div><div><span>Presentes</span><strong>{teamRows.length - exceptions}</strong></div><div><span>Exceções</span><strong>{exceptions}</strong></div><label>Data da chamada<input aria-label="Data da chamada" type="date" value={date} disabled={saving} onChange={(event) => { if (event.target.value && (!dirty || window.confirm("Descartar as alterações ainda não salvas e mudar a data?"))) setDate(event.target.value); }} /></label></section>
    <section className="surface call-list"><div className="panel-heading"><div><h2>Lista de colaboradores</h2><p>Somente admin altera férias já gravadas. Chamadas finalizadas ficam bloqueadas para todos.</p></div><select aria-label="Equipe do supervisor" disabled={saving} value={team} onChange={(event) => { if (!dirty || window.confirm("Descartar os rascunhos desta equipe?")) { setDrafts(original); setVacation(null); setTeam(event.target.value); setError(""); setSuccess(""); } }}><option value="" disabled>Selecione uma equipe</option>{teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="call-search attendance-search"><Search size={16} /><input aria-label="Buscar colaborador na chamada" placeholder="Buscar nome, matrícula ou cargo…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {!visible.length && <div className="empty-state"><Search size={25} /><strong>{search ? "Nenhum colaborador encontrado." : "Nenhum colaborador nesta chamada."}</strong></div>}
      <div className="call-rows">{visible.map((row) => {
        const draft = drafts[row.funcionario_id]; const locked = vacationLocked(row); const rowDisabled = disabled || locked;
        return <article className="attendance-row call-employee" key={row.funcionario_id} aria-label={`Chamada de ${row.funcionario_nome}`}>
          <div className="call-employee-heading"><div><h3>{row.funcionario_nome}</h3><p>{row.matricula} · {row.cargo_nome}</p></div><StatusBadge status={draft.status} /></div>
          {locked && <p className="call-lock-notice"><LockKeyhole size={16} />Férias já registradas: somente admin pode alterar este lançamento em uma chamada aberta.</p>}
          {isAdmin && original[row.funcionario_id]?.status === "ferias" && <button type="button" className="button-secondary" disabled={disabled} onClick={() => { void openVacation(row); }}>Alterar período de férias</button>}
          <div className="call-status-options" role="group" aria-label={`Status de ${row.funcionario_nome}`}>{statuses.map((status) => <button type="button" key={status} className="attendance-status" aria-pressed={draft.status === status} disabled={rowDisabled} onClick={() => {
            if (status === "ferias") { void openVacation(row); return; }
            setVacation(null); update(row, { ...normalizeDetails(status, draft), status });
          }}>{STATUS_LABELS[status]}</button>)}</div>
          <AttendanceDetailsFields status={draft.status} value={draft} disabled={rowDisabled} onChange={(details) => update(row, details)} />
          <label className="call-observation">Observação (opcional)<input aria-label={`Observação de ${row.funcionario_nome}`} maxLength={2000} disabled={rowDisabled} value={draft.observacao} onChange={(event) => update(row, { observacao: event.target.value })} /></label>
          {vacation?.employee.funcionario_id === row.funcionario_id && <fieldset className="occurrence-fields" disabled={rowDisabled}><legend>{vacation.original ? "Alterar período de férias" : "Período de férias"}</legend>
            {vacation.original ? <p>Período contínuo encontrado: <strong>{vacation.original.inicio.split("-").reverse().join("/")} a {vacation.original.fim.split("-").reverse().join("/")}</strong>. Ao salvar, os dias retirados deixarão de ser férias. {vacation.original.dias_bloqueados > 0 ? `${vacation.original.dias_bloqueados} dia(s) têm chamada finalizada e precisam permanecer no período.` : "Os registros que permanecerem nas mesmas datas serão preservados."}</p> : <p>Todos os dias do período serão registrados. Um período que inclua chamada finalizada será recusado por completo.</p>}
            <label>{vacation.original ? "Nova data inicial" : "Data inicial"}<input aria-label="Data inicial das férias" type="date" value={vacation.start} onChange={(event) => setVacation({ ...vacation, start: event.target.value })} /></label><label>{vacation.original ? "Nova data final" : "Data final"}<input aria-label="Data final das férias" type="date" value={vacation.end} onChange={(event) => setVacation({ ...vacation, end: event.target.value })} /></label><div className="call-actions"><button type="button" className="button-secondary" onClick={() => setVacation(null)}>Cancelar</button><button type="button" className="button-primary" onClick={() => { void saveVacation(); }}>{vacation.original ? "Salvar novo período" : "Confirmar férias"}</button></div></fieldset>}
        </article>;
      })}</div>
    </section>
  </AppShell>;
}
