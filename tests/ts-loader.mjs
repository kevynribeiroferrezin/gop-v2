import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import ts from "typescript";

// Executa as funcoes reais TS; apenas dependencias externas recebem doubles.
export function loadTs(file, external = {}, cache = new Map()) {
  const path = resolve(file);
  if (cache.has(path)) return cache.get(path);
  const loaded = { exports: {} };
  cache.set(path, loaded.exports);
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  function require(name) {
    if (name in external) return external[name];
    if (name.startsWith(".")) return loadTs(resolve(dirname(path), `${name}.ts`), external, cache);
    throw new Error(`Dependencia nao simulada: ${name}`);
  }
  new Function("require", "module", "exports", "process", compiled)(
    require, loaded, loaded.exports, { env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-only-not-a-real-key",
    } }
  );
  return loaded.exports;
}
