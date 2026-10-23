import { STATUS_LABELS, WORK_MODES, type AttendanceRow } from "./workspace-types";

export function monthPeriod(today: string, previous = false) {
  const [year, month] = today.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - (previous ? 2 : 1), 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  return { start: first.toISOString().slice(0, 10), end: previous ? last.toISOString().slice(0, 10) : today };
}

export function validatePeriod(start: string, end: string) {
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!valid(start) || !valid(end) || end < start) throw new Error("Informe um período válido.");
  if ((Date.parse(end) - Date.parse(start)) / 86400000 >= 31) throw new Error("Selecione um período de até 31 dias.");
}

// Nao exportar silenciosamente apenas a primeira pagina do PostgREST.
export async function collectPages<T>(fetchPage: (offset: number, end: number) => Promise<T[]>) {
  const result: T[] = [];
  let offset = 0;
  while (offset <= 50000) {
    const page = await fetchPage(offset, offset + 999);
    if (page.length === 0) return result;
    if (result.length + page.length > 50000) throw new Error("Mais de 50 mil registros. Reduza o período antes de exportar.");
    result.push(...page);
    // O projeto pode impor um max_rows menor que o tamanho solicitado.
    // So uma pagina vazia confirma que a leitura terminou.
    offset += page.length;
  }
  throw new Error("Reduza o período antes de exportar.");
}

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  // Excel interpreta =,+,-,@ e controles iniciais como formulas.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function attendanceCsv(rows: AttendanceRow[]) {
  const table: unknown[][] = [["Data", "Matrícula", "Colaborador", "Nome Smart", "Modalidade", "Cargo", "Supervisor", "Status", "Registro manual", "Chamada"]];
  for (const row of rows) table.push([
    row.data_referencia, row.matricula, row.funcionario_nome, row.nome_smart,
    WORK_MODES[row.modalidade_trabalho] ?? "Não informado", row.cargo_nome, row.supervisor_nome,
    STATUS_LABELS[row.status_presenca] ?? row.status_presenca,
    row.possui_registro_manual ? "Sim" : "Não",
    row.chamada_pendente ? "Pendente" : "Sem pendência",
  ]);
  return "\uFEFF" + table.map((line) => line.map(csvCell).join(";")).join("\r\n");
}

export function pendingCalls(rows: AttendanceRow[]) {
  const groups = new Map<string, { date: string; supervisorId: string; supervisor: string; employees: number }>();
  for (const row of rows) {
    if (!row.chamada_pendente) continue;
    const key = `${row.data_referencia}:${row.supervisor_id}`;
    const group = groups.get(key) ?? { date: row.data_referencia, supervisorId: row.supervisor_id, supervisor: row.supervisor_nome, employees: 0 };
    group.employees++;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.supervisor.localeCompare(b.supervisor));
}

export function pendingCallsCsv(rows: AttendanceRow[]) {
  const table: unknown[][] = [["Data da chamada", "Supervisor", "Colaboradores pendentes", "Situação"]];
  for (const item of pendingCalls(rows)) table.push([item.date, item.supervisor, item.employees, "Chamada não finalizada"]);
  return "\uFEFF" + table.map((line) => line.map(csvCell).join(";")).join("\r\n");
}
export function downloadCsv(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
