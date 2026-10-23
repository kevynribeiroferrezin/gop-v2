export type AttendanceStatus = "presente" | "falta" | "atraso" | "atestado" | "folga" | "ferias" | "afastado";
export type AttendanceDetails = {
  falta_justificada: boolean | null; falta_motivo: string | null;
  atraso_motivo: "transporte" | "compromisso" | "medico" | "outro" | null;
  atraso_detalhe: string | null; atraso_tem_atestado: boolean | null;
  atestado_cid: string | null; folga_tipo: "escala" | "banco_horas" | "feriado" | null;
  afastamento_motivo: string | null;
};
export const emptyDetails: AttendanceDetails = { falta_justificada: null, falta_motivo: null, atraso_motivo: null, atraso_detalhe: null, atraso_tem_atestado: null, atestado_cid: null, folga_tipo: null, afastamento_motivo: null };
export function normalizeDetails(status: AttendanceStatus, details: AttendanceDetails): AttendanceDetails {
  const text = (value: string | null) => value?.trim() || null;
  return { ...emptyDetails,
    ...(status === "falta" ? { falta_justificada: details.falta_justificada, falta_motivo: details.falta_justificada ? text(details.falta_motivo) : null } : {}),
    ...(status === "atraso" ? { atraso_motivo: details.atraso_motivo, atraso_detalhe: text(details.atraso_detalhe), atraso_tem_atestado: details.atraso_motivo === "medico" ? details.atraso_tem_atestado : null } : {}),
    ...(status === "atestado" || (status === "atraso" && details.atraso_motivo === "medico" && details.atraso_tem_atestado) ? { atestado_cid: text(details.atestado_cid) } : {}),
    ...(status === "folga" ? { folga_tipo: details.folga_tipo } : {}),
    ...(status === "afastado" ? { afastamento_motivo: text(details.afastamento_motivo) } : {}),
  };
}
export function detailError(status: AttendanceStatus, input: AttendanceDetails) {
  const details = normalizeDetails(status, input);
  if (status === "falta" && details.falta_justificada === null) return "Informe se a falta é justificada.";
  if (status === "falta" && details.falta_justificada && !details.falta_motivo) return "Informe o motivo da falta justificada.";
  if (status === "atraso" && !["transporte", "compromisso", "medico", "outro"].includes(details.atraso_motivo ?? "")) return "Selecione o motivo do atraso.";
  if (status === "atraso" && details.atraso_motivo === "outro" && !details.atraso_detalhe) return "Descreva o motivo do atraso.";
  if (status === "atraso" && details.atraso_motivo === "medico" && details.atraso_tem_atestado === null) return "Informe se o atraso médico possui atestado.";
  if (status === "folga" && !["escala", "banco_horas", "feriado"].includes(details.folga_tipo ?? "")) return "Selecione o tipo de folga.";
  if (status === "afastado" && !details.afastamento_motivo) return "Informe o motivo do afastamento.";
  if ((details.atestado_cid?.length ?? 0) > 20) return "O CID deve ter até 20 caracteres.";
  if ([details.falta_motivo, details.atraso_detalhe, details.afastamento_motivo].some((value) => (value?.length ?? 0) > 2000)) return "Os motivos devem ter até 2.000 caracteres.";
  return null;
}
