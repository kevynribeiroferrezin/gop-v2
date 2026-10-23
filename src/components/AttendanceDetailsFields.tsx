"use client";
import type { AttendanceDetails, AttendanceStatus } from "../lib/attendance";

export default function AttendanceDetailsFields({ status, value, onChange, disabled = false }: {
  status: AttendanceStatus; value: AttendanceDetails; onChange: (next: AttendanceDetails) => void; disabled?: boolean;
}) {
  const set = (next: Partial<AttendanceDetails>) => onChange({ ...value, ...next });
  const bool = (text: string) => text === "" ? null : text === "sim";
  const cid = <label>CID do atestado<input aria-label="CID do atestado" maxLength={20} placeholder="Não informado no documento" value={value.atestado_cid ?? ""} onChange={(event) => set({ atestado_cid: event.target.value })} /><small>Preencha somente se constar no documento. Caso contrário, deixe em branco.</small></label>;
  if (status === "presente" || status === "ferias") return null;
  return <fieldset className="occurrence-fields" disabled={disabled}><legend>Detalhes da ocorrência</legend>
    {status === "falta" && <><label>A falta é justificada?<select aria-label="A falta é justificada?" value={value.falta_justificada === null ? "" : value.falta_justificada ? "sim" : "nao"} onChange={(event) => set({ falta_justificada: bool(event.target.value), falta_motivo: null })}><option value="">Selecione</option><option value="sim">Sim</option><option value="nao">Não</option></select></label>{value.falta_justificada && <label>Motivo da falta justificada<textarea aria-label="Motivo da falta justificada" maxLength={2000} rows={3} value={value.falta_motivo ?? ""} onChange={(event) => set({ falta_motivo: event.target.value })} /></label>}</>}
    {status === "atraso" && <><label>Motivo do atraso<select aria-label="Motivo do atraso" value={value.atraso_motivo ?? ""} onChange={(event) => set({ atraso_motivo: event.target.value as AttendanceDetails["atraso_motivo"], atraso_tem_atestado: null, atestado_cid: null })}><option value="">Selecione</option><option value="transporte">Transporte</option><option value="compromisso">Compromisso</option><option value="medico">Médico</option><option value="outro">Outro</option></select></label>
      <label>{value.atraso_motivo === "outro" ? "Descreva o motivo do atraso" : "Detalhes do atraso (opcional)"}<textarea aria-label="Detalhes do atraso" maxLength={2000} rows={2} value={value.atraso_detalhe ?? ""} onChange={(event) => set({ atraso_detalhe: event.target.value })} /></label>
      {value.atraso_motivo === "medico" && <label>Possui atestado?<select aria-label="Possui atestado?" value={value.atraso_tem_atestado === null ? "" : value.atraso_tem_atestado ? "sim" : "nao"} onChange={(event) => set({ atraso_tem_atestado: bool(event.target.value), atestado_cid: null })}><option value="">Selecione</option><option value="sim">Sim</option><option value="nao">Não</option></select></label>}{value.atraso_motivo === "medico" && value.atraso_tem_atestado && cid}
    </>}
    {status === "atestado" && cid}
    {status === "folga" && <label>Tipo de folga<select aria-label="Tipo de folga" value={value.folga_tipo ?? ""} onChange={(event) => set({ folga_tipo: event.target.value as AttendanceDetails["folga_tipo"] })}><option value="">Selecione</option><option value="escala">Folga Escala</option><option value="banco_horas">Folga Banco de horas</option><option value="feriado">Folga Feriado</option></select></label>}
    {status === "afastado" && <label>Motivo do afastamento<textarea aria-label="Motivo do afastamento" maxLength={2000} rows={3} value={value.afastamento_motivo ?? ""} onChange={(event) => set({ afastamento_motivo: event.target.value })} /></label>}
  </fieldset>;
}
