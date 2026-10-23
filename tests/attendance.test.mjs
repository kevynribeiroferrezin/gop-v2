import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./ts-loader.mjs";
const { emptyDetails, normalizeDetails, detailError } = loadTs("src/lib/attendance.ts");
test("ocorrências condicionais exigem respostas sem apagar o não da justificativa", () => {
  assert.match(detailError("falta",emptyDetails),/justificada/);
  assert.equal(detailError("falta",{...emptyDetails,falta_justificada:false}),null);
  assert.match(detailError("falta",{...emptyDetails,falta_justificada:true}),/motivo/);
  assert.match(detailError("atraso",{...emptyDetails,atraso_motivo:"medico"}),/atestado/);
  assert.equal(detailError("atraso",{...emptyDetails,atraso_motivo:"medico",atraso_tem_atestado:false}),null);
  assert.match(detailError("atraso",{...emptyDetails,atraso_motivo:"outro"}),/Descreva/);
  assert.match(detailError("folga",emptyDetails),/tipo de folga/);
  assert.match(detailError("afastado",emptyDetails),/afastamento/);
  assert.equal(detailError("atestado",emptyDetails),null);
});
test("trocar status remove CID e campos que deixaram de ser pertinentes", () => {
  const input={...emptyDetails,falta_justificada:true,falta_motivo:"Motivo",atestado_cid:"Z00.0",atraso_motivo:"medico",atraso_tem_atestado:true,folga_tipo:"escala"};
  assert.deepEqual(normalizeDetails("presente",input),emptyDetails);
  assert.equal(normalizeDetails("falta",input).atestado_cid,null);
  assert.equal(normalizeDetails("atraso",input).atestado_cid,"Z00.0");
  assert.equal(normalizeDetails("atraso",{...input,atraso_tem_atestado:false}).atestado_cid,null);
  assert.equal(normalizeDetails("folga",input).folga_tipo,"escala");
});
