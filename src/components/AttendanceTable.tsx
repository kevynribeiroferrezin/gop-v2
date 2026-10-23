"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { STATUS_LABELS, WORK_MODES, type AttendanceRow } from "../lib/workspace-types";

export function StatusBadge({ status }: { status: string }) {
  return <span className="status-badge" data-status={status}>{STATUS_LABELS[status] ?? status}</span>;
}
export default function AttendanceTable({ rows, title = "Status dos colaboradores", showDate = false, searchText, onSearchChange }: {
  rows: AttendanceRow[]; title?: string; showDate?: boolean; searchText?: string; onSearchChange?: (value: string) => void;
}) {
  const [internalSearch, setSearch] = useState("");
  const search = searchText ?? internalSearch;
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => rows.filter((row) =>
    `${row.funcionario_nome} ${row.nome_smart ?? ""} ${row.matricula} ${row.supervisor_nome}`.toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR"))), [rows, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / 50));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * 50, (current + 1) * 50);
  return <section className="surface attendance-panel">
    <div className="panel-heading"><div><h2>{title}</h2><p>{filtered.length} registros · status na data da chamada.</p></div>
      <div className="attendance-search"><Search size={16} /><input aria-label={`Buscar em ${title}`} placeholder="Nome, matrícula ou Smart…" value={search} onChange={(event) => { if (onSearchChange) onSearchChange(event.target.value); else setSearch(event.target.value); setPage(0); }} /></div>
    </div>
    <div className="data-table-wrap overflow-x-auto"><table className="data-table w-full min-w-[760px]">
      <caption className="sr-only">{title}</caption><thead className="bg-slate-50 dark:bg-slate-800"><tr>
        {showDate && <th className="px-5 py-4">Data</th>}<th className="px-5 py-4">Colaborador</th><th className="px-5 py-4">Nome Smart</th><th className="px-5 py-4">Modalidade</th><th className="px-5 py-4">Supervisor</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Chamada</th>
      </tr></thead><tbody>
        {visible.map((row) => <tr key={`${row.data_referencia}:${row.funcionario_id}`} className="border-t border-slate-200 dark:border-slate-800">
          {showDate && <td data-label="Data" className="px-5 py-4">{row.data_referencia.split("-").reverse().join("/")}</td>}
          <td data-label="Colaborador" className="px-5 py-4"><p className="font-semibold">{row.funcionario_nome}</p><p className="text-xs text-slate-500 dark:text-slate-400">{row.matricula} · {row.cargo_nome}</p></td>
          <td data-label="Nome Smart" className="px-5 py-4">{row.nome_smart || "—"}</td>
          <td data-label="Modalidade" className="px-5 py-4">{WORK_MODES[row.modalidade_trabalho] ?? "Não informado"}</td>
          <td data-label="Supervisor" className="px-5 py-4">{row.supervisor_nome}</td>
          <td data-label="Status" className="px-5 py-4"><StatusBadge status={row.status_presenca} /></td>
          <td data-label="Chamada" className="px-5 py-4"><span className={`closure-label ${row.chamada_pendente ? "pending" : ""}`}>{row.chamada_pendente ? "Pendente" : "Sem pendência"}</span><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.possui_registro_manual ? "Registro lançado" : "Status padrão"}</p></td>
        </tr>)}
        {visible.length === 0 && <tr><td colSpan={showDate ? 7 : 6} className="empty-state">Nenhum registro para esta seleção.</td></tr>}
      </tbody></table></div>
    <div className="table-pagination"><span>Página {current + 1} de {pages}</span><div><button type="button" className="icon-button" aria-label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={17} /></button><button type="button" className="icon-button" aria-label="Próxima página" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronRight size={17} /></button></div></div>
  </section>;
}
