import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { loadTs } from "./ts-loader.mjs";

const { themeBootstrap } = loadTs("src/lib/theme.ts");
function boot(saved, systemDark, blocked = false) {
  const root = { style: {}, classList: { toggle(_class, enabled) { root.dark = enabled; } } };
  runInNewContext(themeBootstrap, {
    localStorage: { getItem() { if (blocked) throw new Error("Storage indisponivel"); return saved; } },
    matchMedia: () => ({ matches: systemDark }),
    document: { documentElement: root },
  });
  return root;
}
test("tema salvo tem precedencia sobre a preferencia do sistema", () => {
  assert.equal(boot("dark", false).dark, true);
  assert.equal(boot("light", true).dark, false);
  assert.equal(boot("dark", false).style.colorScheme, "dark");
});
test("primeiro acesso e valores invalidos seguem o tema do sistema", () => {
  assert.equal(boot(null, true).dark, true);
  assert.equal(boot("invalid", false).dark, false);
});
test("armazenamento bloqueado nao impede aplicar o tema", () => {
  assert.equal(boot(null, true, true).style.colorScheme, "dark");
});
