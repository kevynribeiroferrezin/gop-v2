import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./ts-loader.mjs";
const { calendarMonth, adjacentMonth } = loadTs("src/lib/calendar.ts");

test("calendário posiciona dias na semana e inclui fevereiro bissexto", () => {
  const leap = calendarMonth("2024-02");
  assert.equal(leap.dates.length, 29);
  assert.equal(leap.offset, 4);
  assert.equal(leap.end, "2024-02-29");
  assert.equal(calendarMonth("2026-02").dates.length, 28);
  assert.equal(calendarMonth("2026-02").offset, 0);
  assert.equal(calendarMonth("2026-10").end, "2026-10-31");
});

test("navegação mensal cruza anos e rejeita mês inválido", () => {
  assert.equal(adjacentMonth("2026-01", -1), "2025-12");
  assert.equal(adjacentMonth("2026-12", 1), "2027-01");
  for (const month of ["", "2026-00", "2026-13", "26-02", "2026-2", "0000-01", "1899-12"]) assert.throws(() => calendarMonth(month));
});
