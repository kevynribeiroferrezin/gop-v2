import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./ts-loader.mjs";

function fixture({ denied = false, role = "supervisor", modern = false } = {}) {
  const calls = [];
  const own = { supervisor_id: "own", funcionario_id: "employee", id: "employee", nome: "Ana", funcionario_nome: "Ana", status_presenca: "ferias", possui_registro_manual: true };
  const foreign = { ...own, supervisor_id: "foreign", id: "secret", funcionario_id: "secret", nome: "Outra equipe" };
  const profile = { id: "profile", user_id: "user", role, ativo: true, nome: "Supervisor" };
  function query(name) {
    const filters = []; let fields = ""; let offset = 0; let last = 999;
    const q = {
      select(value) { fields = value; return q; },
      eq(key, value) { filters.push([key, value]); return q; },
      in(key, value) { filters.push([key, value]); return q; },
      order() { return q; }, single() { return q; },
      range(first, end) { offset = first; last = end; return q; },
      then(resolve, reject) {
        calls.push({ name, fields, filters });
        let data = []; let error = null;
        if (name === "profiles") data = profile;
        else if (name === "supervisores" && fields === "id") {
          if (role === "coordenador" && !modern) error = { code: "42703" };
          else data = [{ id: "own" }];
        } else if (name === "supervisores") {
          if (!modern && fields.includes("coordenador_profile_id")) error = { code: "42703" };
          else data = [{ id: "own", nome: "Supervisor" }];
        } else if (name === "relatorio_presencas" || name === "vw_colaboradores_acesso") {
          if (denied) error = { code: "42501" };
          else if (!modern) error = { code: name === "relatorio_presencas" ? "PGRST202" : "PGRST205" };
          else data = [own, foreign];
        } else if (name === "get_chamada_por_data" || name === "vw_funcionarios_completo") data = [own, foreign];
        if (Array.isArray(data)) data = data.slice(offset, last + 1);
        return Promise.resolve({ data, error }).then(resolve, reject);
      },
    };
    return q;
  }
  const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: "user" } } } }) }, from: query, rpc: query };
  return { calls, api: loadTs("src/lib/workspace-data.ts", { "./supabase/client": { supabase } }) };
}

test("banco existente: colaboradores e relatórios usam contratos anteriores e mantêm o vínculo", async () => {
  const { api, calls } = fixture();
  const employees = await api.employeeList();
  assert.equal(employees.workFields, false);
  assert.deepEqual(employees.rows.map(x => x.id), ["employee"]);
  const attendance = await api.attendancePeriod("2026-01-01", "2026-01-02");
  assert.equal(attendance.length, 2);
  assert.ok(attendance.every(x => x.supervisor_id === "own" && x.status_presenca === "ferias" && x.chamada_pendente));
  assert.deepEqual(attendance.map(x => x.data_referencia), ["2026-01-01", "2026-01-02"]);
  assert.equal((await api.supervisorList()).length, 1);
  for (const call of calls.filter(x => ["get_chamada_por_data", "vw_funcionarios_completo"].includes(x.name))) {
    assert.ok(call.filters.some(([key, value]) => key === "supervisor_id" && value[0] === "own"));
  }
});

test("banco migrado também filtra respostas pelo supervisor responsável", async () => {
  const { api, calls } = fixture({ modern: true });
  assert.equal((await api.employeeList()).rows.length, 1);
  assert.equal((await api.attendancePeriod("2026-01-01", "2026-01-01")).length, 1);
  assert.ok(!calls.some(x => x.name === "vw_funcionarios_completo" || x.name === "get_chamada_por_data"));
});

test("negação de permissão nunca aciona consultas alternativas", async () => {
  const { api, calls } = fixture({ denied: true });
  await assert.rejects(api.employeeList());
  await assert.rejects(api.attendancePeriod("2026-01-01", "2026-01-01"));
  assert.ok(!calls.some(x => x.name === "vw_funcionarios_completo" || x.name === "get_chamada_por_data"));
});

test("coordenação sem vínculo configurado falha fechada", async () => {
  const { api, calls } = fixture({ role: "coordenador" });
  await assert.rejects(api.employeeList(), /vínculo/);
  assert.ok(!calls.some(x => x.name.startsWith("vw_")));
});

test("calendário consulta somente o colaborador selecionado e rejeita outro supervisor", async () => {
  for (const modern of [false, true]) {
    const { api, calls } = fixture({ modern });
    assert.equal((await api.attendancePeriod("2026-01-01", "2026-01-01", "employee")).length, 1);
    assert.deepEqual(await api.attendancePeriod("2026-01-01", "2026-01-01", "secret"), []);
    for (const call of calls.filter(x => x.name === "relatorio_presencas" || x.name === "get_chamada_por_data")) {
      assert.ok(call.filters.some(([key, value]) => key === "funcionario_id" && ["employee", "secret"].includes(value)));
      assert.ok(call.filters.some(([key, value]) => key === "supervisor_id" && value[0] === "own"));
    }
  }
});
