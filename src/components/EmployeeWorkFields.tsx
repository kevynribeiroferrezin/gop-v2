"use client";
import { WORK_MODES, type WorkMode } from "../lib/workspace-types";

export default function EmployeeWorkFields({ nomeSmart, mode, onChange }: {
  nomeSmart: string; mode: WorkMode; onChange: (next: { nome_smart: string; modalidade_trabalho: WorkMode }) => void;
}) {
  return <div className="grid gap-5 md:grid-cols-2">
    <label className="flex flex-col gap-2 text-sm font-semibold">Nome Smart<input className="h-11 rounded-xl border border-slate-200 px-4 font-normal dark:border-slate-800" aria-label="Nome Smart" type="text" maxLength={200} placeholder="Nome usado no Smart (opcional)" value={nomeSmart} onChange={(event) => onChange({ nome_smart: event.target.value, modalidade_trabalho: mode })} /></label>
    <label className="flex flex-col gap-2 text-sm font-semibold">Modalidade de trabalho<select required aria-label="Modalidade de trabalho" className="h-11 rounded-xl border border-slate-200 px-4 font-normal dark:border-slate-800" value={mode === "nao_informado" ? "" : mode} onChange={(event) => onChange({ nome_smart: nomeSmart, modalidade_trabalho: event.target.value as WorkMode })}><option value="" disabled>Selecione a modalidade</option>{Object.entries(WORK_MODES).filter(([value]) => value !== "nao_informado").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
  </div>;
}
