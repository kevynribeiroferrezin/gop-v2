"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import AppShell from "../../src/components/AppShell";
import { StatusBadge } from "../../src/components/AttendanceTable";
import { activeProfile, attendancePeriod, employeeList } from "../../src/lib/workspace-data";
import { STATUS_LABELS, type AttendanceRow } from "../../src/lib/workspace-types";
import { adjacentMonth, calendarMonth } from "../../src/lib/calendar";
import { dataHojeBrasil } from "../../src/lib/dates";

type Employee = { id: string; nome: string; matricula: string; supervisor_nome: string | null; ativo: boolean };
export default function CalendarPage() {
  const router = useRouter();
  const today = dataHojeBrasil();
  const [month, setMonth] = useState(() => dataHojeBrasil().slice(0, 7));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ key: string; rows: AttendanceRow[]; error: string }>({ key: "", rows: [], error: "" });
  const [day, setDay] = useState(today);
  const employee = employees.find((item) => item.id === employeeId);
  const key = `${employee?.id ?? ""}:${month}`;
  const period = useMemo(() => calendarMonth(month), [month]);
  const loadEmployees = useCallback(async () => {
    setRosterLoading(true); setRosterError("");
    try {
      if (!await activeProfile()) { router.replace("/login"); return; }
      const { rows } = await employeeList();
      setEmployees(rows as unknown as Employee[]);
    } catch (error) { setRosterError(error instanceof Error ? error.message : "Não foi possível carregar os colaboradores."); }
    finally { setRosterLoading(false); }
  }, [router]);
  useEffect(() => { let live = true; queueMicrotask(() => { if (live) void loadEmployees(); }); return () => { live = false; }; }, [loadEmployees]);
  useEffect(() => {
    if (!employee) return;
    let live = true;
    const selected = employee.id;
    queueMicrotask(async () => {
      if (!live) return;
      setLoading(true);
      try {
        const rows = await attendancePeriod(period.start, period.end, selected);
        if (live) setResult({ key, rows, error: "" });
      } catch (error) {
        if (live) setResult({ key, rows: [], error: error instanceof Error ? error.message : "Não foi possível carregar o calendário." });
      } finally { if (live) setLoading(false); }
    });
    return () => { live = false; };
  }, [employee, key, period.start, period.end, retry]);
  const matching = result.key === key;
  const busy = Boolean(employee && (loading || !matching));
  const error = matching ? result.error : "";
  const records = useMemo(() => new Map((matching ? result.rows : []).map((row) => [row.data_referencia, row])), [matching, result.rows]);
  const selectedDate = day.startsWith(month) ? day : period.start;
  const record = records.get(selectedDate);
  const filteredEmployees = useMemo(() => employees.filter((item) => `${item.nome} ${item.matricula} ${item.supervisor_nome ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))), [employees, search]);
  const options = employee && !filteredEmployees.some((item) => item.id === employee.id) ? [employee, ...filteredEmployees] : filteredEmployees;
  const monthLabel = new Date(`${period.start}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  function statusFor(row: AttendanceRow | undefined, date: string) {
    if (!row) return date > today ? "Sem lançamento" : "Sem dados";
    if (date > today && !row.possui_registro_manual) return "Sem lançamento";
    return STATUS_LABELS[row.status_presenca] ?? row.status_presenca;
  }
  return <AppShell active="calendario">
    <header className="page-heading"><div><p className="eyebrow">Histórico individual</p><h1>Calendário da equipe</h1><p className="page-description">Consulte presenças, férias e outras ocorrências de cada colaborador.</p></div><CalendarDays size={28} className="text-slate-400" /></header>
    <section className="surface calendar-filters" aria-label="Selecionar colaborador e mês">
      <label>Buscar colaborador<div className="attendance-search"><Search size={16} /><input aria-label="Buscar colaborador no calendário" placeholder="Nome, matrícula ou supervisor…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></label>
      <label>Colaborador<select aria-label="Colaborador do calendário" disabled={rosterLoading || Boolean(rosterError)} value={employee?.id ?? ""} onChange={(event) => setEmployeeId(event.target.value)}><option value="">{rosterLoading ? "Carregando colaboradores…" : "Selecione um colaborador"}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.matricula}{item.supervisor_nome ? ` · ${item.supervisor_nome}` : ""}{!item.ativo ? " (inativo)" : ""}</option>)}</select></label>
      <label>Mês de referência<input type="month" aria-label="Mês do calendário" min="1900-01" max="9999-12" value={month} onChange={(event) => { const value = event.target.value; if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= "1900-01" && value <= "9999-12") setMonth(value); }} /></label>
    </section>
    {rosterError && <div className="auth-message error" role="alert">{rosterError}<button className="button-secondary" type="button" onClick={() => { void loadEmployees(); }}>Tentar novamente</button></div>}
    {!rosterLoading && !rosterError && !employees.length && <div className="surface empty-state"><CalendarDays size={30} /><strong>Nenhum colaborador vinculado ao seu perfil.</strong><p>Os colaboradores aparecem conforme a sua hierarquia de acesso.</p></div>}
    {!employee && employees.length > 0 && <div className="surface empty-state"><CalendarDays size={30} /><strong>Escolha um colaborador para começar.</strong><p>Você verá os registros e as ocorrências do mês selecionado.</p></div>}
    {employee && <>
      <div className="calendar-person"><div><h2>{employee.nome}</h2><p>Matrícula {employee.matricula} · {employee.supervisor_nome ?? "Sem supervisor"}</p></div><span>Consulta conforme sua hierarquia</span></div>
      <section className="surface calendar-panel" aria-label={`Calendário de ${employee.nome}`}>
        <header className="calendar-toolbar"><h2>{monthLabel}</h2><div><button type="button" className="icon-button" aria-label="Mês anterior" disabled={month === "1900-01"} onClick={() => setMonth(adjacentMonth(month, -1))}><ChevronLeft size={19} /></button><button type="button" className="button-secondary" onClick={() => { setMonth(today.slice(0, 7)); setDay(today); }}>Mês atual</button><button type="button" className="icon-button" aria-label="Próximo mês" disabled={month === "9999-12"} onClick={() => setMonth(adjacentMonth(month, 1))}><ChevronRight size={19} /></button></div></header>
        {busy ? <div className="page-loading" role="status"><Loader2 className="animate-spin" /><p>Buscando os registros do mês…</p></div> : error ? <div className="empty-state" role="alert"><strong>{error}</strong><button type="button" className="button-secondary" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button></div> : <>
          <div className="calendar-weekdays" aria-hidden="true">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label) => <span key={label}>{label}</span>)}</div>
          <div className="calendar-grid">{Array.from({ length: period.offset }, (_, index) => <div className="calendar-spacer" aria-hidden="true" key={`blank-${index}`} />)}{period.dates.map((date) => {
            const row = records.get(date);
            const hasStatus = row && (date <= today || row.possui_registro_manual);
            const status = statusFor(row, date);
            return <button className={`calendar-day ${date === selectedDate ? "is-selected" : ""}`} type="button" key={date} aria-label={`${date.split("-").reverse().join("/")}: ${status}`} aria-pressed={date === selectedDate} aria-current={date === today ? "date" : undefined} onClick={() => setDay(date)}>
              <span className="calendar-day-number">{Number(date.slice(-2))}{date === today && <small>Hoje</small>}</span><span className="calendar-day-status" data-status={hasStatus ? row.status_presenca : "empty"}>{status}</span><small className="calendar-day-note">{hasStatus ? date > today ? "Previsto" : row.possui_registro_manual ? "Registro manual" : "Padrão da chamada" : "—"}</small>
            </button>;
          })}</div>
          <div className="calendar-legend">{Object.entries(STATUS_LABELS).map(([value, label]) => <span className="calendar-day-status" data-status={value} key={value}>{label}</span>)}</div>
        </>}
      </section>
      {!busy && !error && <section className="surface calendar-details" aria-live="polite"><div><p className="eyebrow">Detalhes do dia</p><h2>{new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</h2></div>
        {record && (selectedDate <= today || record.possui_registro_manual) ? <><StatusBadge status={record.status_presenca} /><p>{selectedDate > today ? "Ocorrência prevista para esta data." : record.possui_registro_manual ? "Status lançado manualmente na chamada." : "Status padrão da chamada; não representa um lançamento manual."} {selectedDate <= today ? record.chamada_pendente ? "A chamada da equipe ainda não foi finalizada." : "A chamada da equipe foi finalizada." : "O fechamento será acompanhado na data da chamada."}</p></> : <p>{selectedDate > today ? "Nenhuma ocorrência lançada para esta data futura." : "Não há dados disponíveis para este colaborador nesta data."}</p>}
      </section>}
      <p className="report-note">O calendário usa os registros da chamada. “Presente” pode ser o status padrão antes de uma exceção; consulte o detalhe do dia para verificar lançamento e fechamento. Dias sem dados não são classificados como faltas. Agendamentos futuros aparecem como previstos.</p>
    </>}
  </AppShell>;
}
