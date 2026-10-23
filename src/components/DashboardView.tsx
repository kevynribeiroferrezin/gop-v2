"use client";

import { ArrowRight, ArrowUpRight, CalendarCheck2, Check, CircleCheck, ClipboardCheck, Clock3, Info, Users, UserX } from "lucide-react";
import type { DashboardResumo, ChamadaPendente } from "../../app/page";

export default function DashboardView({ resumo, pendentes, canCall, onCall, canRemind, onRemind, sending, sent, supervisorView = false }: {
  resumo: DashboardResumo; pendentes: ChamadaPendente[]; canCall: boolean; onCall: (id?: string) => void;
  canRemind: boolean; onRemind: (id: string) => void; sending: string; sent: string[];
  supervisorView?: boolean;
}) {
  const total = resumo.total_funcionarios_ativos;
  const statuses = [
    { label: "Presentes", value: resumo.total_presentes, color: "#7898ca" },
    { label: "Faltas", value: resumo.total_faltas, color: "#c9796b" },
    { label: "Atrasos", value: resumo.total_atrasos, color: "#d9b854" },
    { label: "Atestados", value: resumo.total_atestados, color: "#829bab" },
    { label: "Folgas", value: resumo.total_folgas, color: "#a5b4d1" },
    { label: "Férias", value: resumo.total_ferias, color: "#b2a583" },
    { label: "Afastados", value: resumo.total_afastados, color: "#8d8798" },
  ];
  const date = new Date(`${resumo.data_referencia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  if (supervisorView) return <>
    <header className="page-heading"><div><p className="eyebrow">{date}</p><h1>Sua equipe, em dia.</h1><p className="page-description">Confira os status e conclua a chamada da sua equipe.</p></div>
      {canCall && <button type="button" className="button-primary" onClick={() => onCall()}><ClipboardCheck size={18} /> Abrir chamada <ArrowUpRight size={16} /></button>}
    </header>
    <section className="supervisor-summary" aria-label="Resumo da equipe">
      <div className="surface team-total"><Users size={21} /><strong>{total}</strong><span>colaboradores na equipe</span></div>
      <div className="surface team-statuses">{statuses.map((status) => <div key={status.label}><span className="status-dot" style={{ background: status.color }} /><span>{status.label}</span><strong>{status.value}</strong></div>)}</div>
    </section>
    <section className={`surface call-notice ${pendentes.length ? "is-pending" : ""}`}>
      <ClipboardCheck size={23} /><div><h2>{!total ? "Nenhum colaborador vinculado" : pendentes.length ? "Sua chamada aguarda finalização" : "Chamada sem pendências"}</h2><p>{pendentes.length ? "Revise férias, faltas e demais exceções antes de finalizar." : "Consulte os status individuais na lista abaixo."}</p></div>
      {pendentes.length > 0 && <button type="button" className="button-secondary" onClick={() => onCall()}>Revisar chamada <ArrowRight size={16} /></button>}
    </section>
  </>;
  return <>
    <header className="page-heading">
      <div><p className="eyebrow">{date}</p><h1>O dia da sua equipe.</h1><p className="page-description">Presenças, exceções e chamadas na data selecionada.</p></div>
      {canCall && <button type="button" className="button-primary" onClick={() => onCall()}><ClipboardCheck size={17} /> Fazer chamada <ArrowUpRight size={16} /></button>}
    </header>
    <div className="metric-grid">
      {[
        { label: "Presentes", value: resumo.total_presentes, note: "Inclui o padrão da chamada", icon: CircleCheck, emphasis: true },
        { label: "Faltas", value: resumo.total_faltas, note: "Ausências registradas", icon: UserX },
        { label: "Atrasos", value: resumo.total_atrasos, note: "Exceções registradas", icon: Clock3 },
        { label: "Colaboradores", value: total, note: "Na sua área de acesso", icon: Users },
      ].map(({ label, value, note, icon: Icon, emphasis }) => <section className={`surface metric ${emphasis ? "metric-emphasis" : ""}`} key={label}>
        <div className="metric-top"><span>{label}</span><Icon size={17} strokeWidth={1.6} /></div><p className="metric-value">{value.toLocaleString("pt-BR")}</p><p className="metric-foot">{note}</p>
      </section>)}
    </div>
    <div className="dashboard-grid">
      <section className="surface">
        <div className="panel-heading"><div><h2>Panorama de presenças</h2><p>A distribuição da equipe na data selecionada.</p></div><CalendarCheck2 size={18} className="text-slate-400" /></div>
        {total > 0 ? <div className="daily-overview">
          <div className="overview-total"><strong>{Math.round(resumo.total_presentes / total * 100)}%</strong><span>da equipe com status presente</span></div>
          <div className="presence-track" aria-label="Distribuição de status da equipe">{statuses.filter((status) => status.value > 0).map((status) => <span key={status.label} title={`${status.label}: ${status.value}`} style={{ background: status.color, flexGrow: status.value }} />)}</div>
          <div className="status-list">{statuses.map((status) => <div className="status-line" key={status.label}><span style={{ background: status.color }} />{status.label}<strong>{status.value}</strong></div>)}</div>
        </div> : <div className="empty-state"><Users size={30} strokeWidth={1.3} /><strong>Sua equipe aparece aqui.</strong><p>Quando houver colaboradores vinculados, você poderá acompanhar as presenças neste painel.</p></div>}
        <p className="panel-footnote"><Info size={13} />Presença é o padrão até o lançamento de uma exceção.</p>
      </section>
      <section className="surface">
        <div className="panel-heading"><div><h2>Chamadas para finalizar</h2><p>Equipes que ainda precisam de fechamento.</p></div><span className="count-label">{pendentes.length} {pendentes.length === 1 ? "pendente" : "pendentes"}</span></div>
        <div className="pending-list">{pendentes.length === 0 ? <div className="empty-state"><CircleCheck size={30} strokeWidth={1.3} /><strong>{total > 0 ? "Tudo em dia por aqui." : "Nenhuma chamada pendente."}</strong><p>{total > 0 ? "As chamadas das equipes foram finalizadas. Bom trabalho!" : "As pendências aparecem quando há equipes para acompanhar."}</p></div> : pendentes.map((item) => <div className="pending-row" key={item.supervisor_id}>
          <span className="avatar">{item.supervisor_nome.charAt(0)}</span><div className="pending-copy"><strong>{item.supervisor_nome}</strong><small>{item.total_funcionarios} colaboradores · {item.total_excecoes_registradas} exceções</small></div>
          {canRemind && <button type="button" className="button-secondary reminder-button" onClick={() => onRemind(item.supervisor_id)} disabled={Boolean(sending) || sent.includes(item.supervisor_id)} aria-label={`Cobrar ${item.supervisor_nome}`}>{sent.includes(item.supervisor_id) ? "Enviada" : sending === item.supervisor_id ? "Enviando…" : "Cobrar"}</button>}
          {canCall && <button type="button" className="icon-button" onClick={() => onCall(item.supervisor_id)} aria-label={`Abrir chamada de ${item.supervisor_nome}`}><ArrowRight size={17} /></button>}
        </div>)}</div>
      </section>
    </div>
    <section className="surface completion"><Check size={25} strokeWidth={1.5} className="completion-icon" /><div className="completion-copy"><h2>Fechamento das equipes</h2><p>{resumo.total_equipes_finalizadas} de {resumo.total_equipes} equipes com colaboradores finalizaram a chamada.</p></div><span className="completion-value">{resumo.total_equipes > 0 ? Math.round(resumo.total_equipes_finalizadas / resumo.total_equipes * 100) : 0}%</span></section>
  </>;
}
