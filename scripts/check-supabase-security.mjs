import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const env = {};
  const content = readFileSync(".env.local", "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    const rawValue = trimmed.slice(separatorIndex + 1);
    env[key] = rawValue.replace(/^["']|["']$/g, "");
  }

  return env;
}

const env = loadEnvLocal();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: {
    schema: "gop_v2",
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const checks = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

await check("funcao hoje_brasil existe", async () => {
  const { data, error } = await supabase.rpc("hoje_brasil");

  if (error) {
    throw new Error(error.message);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data))) {
    throw new Error(`Retorno inesperado: ${String(data)}`);
  }
});

await check("tabela audit_logs existe", async () => {
  const { error } = await supabase.from("audit_logs").select("id").limit(1);

  if (error) {
    throw new Error(error.message);
  }
});

await check("profiles acessivel pela service role", async () => {
  const { error } = await supabase.from("profiles").select("id").limit(1);

  if (error) {
    throw new Error(error.message);
  }
});

for (const item of checks) {
  const status = item.ok ? "OK" : "FALHOU";
  console.log(`${status} - ${item.name}${item.message ? `: ${item.message}` : ""}`);
}

if (checks.some((item) => !item.ok)) {
  console.log(
    "Aplique supabase/sql/001_security_audit_rls.sql e depois rode supabase/sql/002_verify_security.sql no Supabase."
  );
  process.exitCode = 1;
}
