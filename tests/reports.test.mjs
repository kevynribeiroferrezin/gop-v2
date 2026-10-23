import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./ts-loader.mjs";
const { attendanceCsv, validatePeriod, collectPages, monthPeriod, pendingCalls, pendingCallsCsv } = loadTs("src/lib/reports.ts");
const { filterScope } = loadTs("src/lib/workspace-types.ts");

test("atalhos mensais lidam com virada de ano e fevereiro bissexto", () => {
  assert.deepEqual(monthPeriod("2026-01-22"), { start: "2026-01-01", end: "2026-01-22" });
  assert.deepEqual(monthPeriod("2026-01-22", true), { start: "2025-12-01", end: "2025-12-31" });
  assert.deepEqual(monthPeriod("2024-03-01", true), { start: "2024-02-01", end: "2024-02-29" });
  for (const date of ["2026-10-22", "2026-03-01", "2024-03-01"]) {
    const period = monthPeriod(date, true); assert.doesNotThrow(() => validatePeriod(period.start, period.end));
  }
});

test("cobrança agrupa por supervisor/data e exclui chamadas finalizadas", () => {
  const row = { data_referencia: "2026-10-22", supervisor_id: "s1", supervisor_nome: "=formula", chamada_pendente: true };
  const rows = [row, { ...row }, { ...row, data_referencia: "2026-10-21" }, { ...row, supervisor_id: "s2", supervisor_nome: "Sup 2" }, { ...row, supervisor_id: "closed", chamada_pendente: false }];
  assert.deepEqual(pendingCalls(rows).map(x => [x.date, x.supervisorId, x.employees]), [["2026-10-21", "s1", 1], ["2026-10-22", "s1", 2], ["2026-10-22", "s2", 1]]);
  const csv = pendingCallsCsv(rows);
  assert.equal(csv.split("\r\n").length, 4); assert.ok(csv.includes("'=formula")); assert.ok(!csv.includes('"closed"'));
  assert.ok(!csv.includes("funcionario_id"));
});

test("CSV preserva acentos e aspas e neutraliza formulas de planilha", () => {
  const csv = attendanceCsv([{ data_referencia: "2026-10-22", matricula: "123", funcionario_nome: '=HYPERLINK("evil")', nome_smart: 'Ana; "Smart"', modalidade_trabalho: "home_office", cargo_nome: "Assistência", supervisor_nome: "@formula", status_presenca: "ferias", possui_registro_manual: true, chamada_pendente: true }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"'=HYPERLINK\(""evil""\)"/);
  assert.match(csv, /"Ana; ""Smart"""/);
  assert.match(csv, /"'@formula"/);
  assert.match(csv, /"Férias"/);
  assert.match(csv, /"Pendente"/);
});
test("periodo invalido ou superior a 31 dias nao gera consulta", () => {
  assert.doesNotThrow(() => validatePeriod("2026-10-01", "2026-10-31"));
  for (const [start, end] of [["2026-02-30", "2026-03-05"], ["", "2026-10-22"], ["2026-10-22", "2026-10-01"], ["2026-10-01", "2026-11-01"]]) assert.throws(() => validatePeriod(start, end));
});
test("paginacao le todos os registros alem dos primeiros mil", async () => {
  const data = Array.from({ length: 2145 }, (_, id) => id);
  const result = await collectPages(async (start, end) => data.slice(start, end + 1));
  assert.deepEqual(result, data);
  const capped = await collectPages(async (start) => data.slice(start, start + 127));
  assert.deepEqual(capped, data);
  await assert.rejects(collectPages(async () => Array(1000).fill(1)), /50 mil/);
});
test("filtro de visao vazio nao mostra todos e permite selecionar um responsavel", () => {
  const data = [{ supervisor_id: "s1", coordenador_profile_id: "c1" }, { supervisor_id: "s2", coordenador_profile_id: "c2" }];
  assert.equal(filterScope(data, { mode: "geral", id: "" }).length, 2);
  assert.equal(filterScope(data, { mode: "coordenador", id: "" }).length, 0);
  assert.deepEqual(filterScope(data, { mode: "coordenador", id: "c1" }), [data[0]]);
  assert.deepEqual(filterScope(data, { mode: "supervisor", id: "s2" }), [data[1]]);
});
