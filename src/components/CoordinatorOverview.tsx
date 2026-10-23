"use client";
import { useMemo, useState } from "react";
import { ArrowDown, CheckCircle2, ClipboardList, Clock3, Users } from "lucide-react";
import type { ChamadaPendente, DashboardResumo } from "../../app/page";
import { STATUS_LABELS, type AttendanceRow } from "../lib/workspace-types";
import { dataHojeBrasil } from "../lib/dates";
import AttendanceTable from "./AttendanceTable";

export default function CoordinatorOverview({ rows, resumo, pending, onRemind, sending, sent }: {
  rows: AttendanceRow[]; resumo: DashboardResumo; pending: ChamadaPendente[];
  onRemind: (id: string) => void; sending: string; sent: string[];
}) {
  const [status, setStatus] = useState("");
  const future = resumo.data_referencia > dataHojeBrasil();
  const teams = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; rows: AttendanceRow[] }>();
    for (const row of rows) {
      const group = groups.get(row.supervisor_id) ?? { id: row.supervisor_id, name: row.supervisor_nome, rows: [] };
      group.rows.push(row); groups.set(row.supervisor_id, group);
    }
    return [...groups.values()].sort((a, b) => Number(b.rows.some((row) => row.chamada_pendente)) - Number(a.rows.some((row) => row.chamada_pendente)) || a.name.localeCompare(b.name, "pt-BR"));
  }, [rows]);
  const displayed = teams.map((team) => ({ ...team, filtered: team.rows.filter((row) => !status || row.status_presenca === status) })).filter((team) => team.filtered.length);
  const date = new Date(`${resumo.data_referencia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return <>
    <header className="page-heading"><div><p className="eyebrow">{date}</p><h1>Acompanhamento da coordenação</h1><p className="page-description">Acompanhe os fechamentos dos seus supervisores e os status de cada equipe.</p></div></header>
    <div className="metric-grid">
      {[
        { label: "Chamadas pendentes", value: pending.length, note: "Supervisores para cobrar", icon: Clock3 },
        { label: "Chamadas finalizadas", value: resumo.total_equipes_finalizadas, note: "Na data selecionada", icon: CheckCircle2 },
        { label: "Supervisores", value: teams.length, note: "Com colaboradores nesta seleção", icon: ClipboardList },
        { label: "Faltas registradas", value: resumo.total_faltas, note: "Colaboradores com status falta", icon: Users },
      ].map(({ label, value, note, icon: Icon }) => <section className="surface metric" key={label}><div className="metric-top"><span>{label}</span><Icon size={18} /></div><p className="metric-value">{value}</p><p className="metric-foot">{note}</p></section>)}
    </div>
    <section className="surface coordinator-pending" aria-label="Acompanhamento das chamadas">
      <div className="panel-heading"><div><h2>Supervisores com chamada pendente</h2><p>O lançamento e a finalização da presença ficam com cada supervisor.</p></div><span className="count-label">{pending.length} pendentes</span></div>
      {pending.length ? <div className="coordinator-pending-list">{pending.map((item) => <div className="coordinator-pending-row" key={item.supervisor_id}>
        <span className="avatar">{item.supervisor_nome.charAt(0)}</span><div className="pending-copy"><strong>{item.supervisor_nome}</strong><small>{item.total_funcionarios} colaboradores · chamada não finalizada</small></div>
        <a className="button-secondary" href={`#coordinator-team-${item.supervisor_id}`} onClick={() => { const group = document.getElementById(`coordinator-team-${item.supervisor_id}`); if (group instanceof HTMLDetailsElement) group.open = true; }}><ArrowDown size={15} /> Ver colaboradores</a>
        <button type="button" className="button-primary" aria-label={`Cobrar ${item.supervisor_nome}`} disabled={Boolean(sending) || sent.includes(item.supervisor_id)} onClick={() => onRemind(item.supervisor_id)}>{sent.includes(item.supervisor_id) ? "Cobrança enviada" : sending === item.supervisor_id ? "Enviando…" : "Cobrar supervisor"}</button>
      </div>)}</div> : <div className="empty-state"><CheckCircle2 size={28} /><strong>{future ? "Data futura selecionada" : teams.length ? "Nenhuma chamada pendente nesta seleção." : "Nenhuma equipe com colaboradores nesta seleção."}</strong><p>{future ? "O fechamento será acompanhado na data da chamada." : teams.length ? "Os supervisores desta seleção finalizaram a chamada." : "As equipes aparecem conforme os vínculos da coordenação."}</p></div>}
    </section>
    <section className="coordinator-employees" aria-labelledby="coordinator-employees-title">
      <header className="coordinator-employees-heading"><div><h2 id="coordinator-employees-title">Status dos colaboradores</h2><p>Equipes organizadas por supervisor, dentro da hierarquia da coordenação.</p></div><label>Mostrar status<select aria-label="Filtrar status dos colaboradores da coordenação" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="button-secondary" type="button" aria-pressed={status === "falta"} onClick={() => setStatus(status === "falta" ? "" : "falta")}>{status === "falta" ? "Mostrar todos" : "Somente faltas"}</button></header>
      <p className="report-note">Falta é o status registrado do colaborador. Chamada pendente significa que o supervisor ainda não finalizou a equipe; não indica falta dos colaboradores.</p>
      {displayed.map((team) => <details open key={team.id} id={`coordinator-team-${team.id}`} className="surface coordinator-team">
        <summary><div><strong>{team.name}</strong><span>{team.filtered.length} de {team.rows.length} colaboradores · {team.rows.filter((row) => row.status_presenca === "falta").length} faltas registradas</span></div><span className={`closure-label ${team.rows.some((row) => row.chamada_pendente) ? "pending" : ""}`}>{future ? "Agendada" : team.rows.some((row) => row.chamada_pendente) ? "Chamada pendente" : "Chamada finalizada"}</span></summary>
        <AttendanceTable rows={team.filtered} title={`Equipe de ${team.name}`} />
      </details>)}
      {!displayed.length && <div className="surface empty-state"><Users size={28} /><strong>{status ? "Nenhum colaborador com este status." : "Nenhum colaborador nesta seleção."}</strong><p>{status ? "Escolha outro status para consultar os demais colaboradores." : "Os colaboradores aparecem quando vinculados às equipes da coordenação."}</p></div>}
    </section>
  </>;
}
