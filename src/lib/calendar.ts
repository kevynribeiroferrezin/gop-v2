export function calendarMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < "1900-01" || month > "9999-12") throw new Error("Selecione um mês válido.");
  const [year, number] = month.split("-").map(Number);
  const start = `${month}-01`;
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { start, end: `${month}-${String(count).padStart(2, "0")}`, offset: new Date(`${start}T12:00:00Z`).getUTCDay(),
    dates: Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`) };
}

export function adjacentMonth(month: string, direction: -1 | 1) {
  calendarMonth(month);
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + direction, 1)).toISOString().slice(0, 7);
}
