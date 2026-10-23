import "server-only";
import { createClient } from "@supabase/supabase-js";
import { bearerToken, RequestError } from "../api-security";

// Inicializacao sob demanda permite build sem credenciais de producao.
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuracao do servidor indisponivel.");
  return createClient(url, key, {
    db: { schema: "gop_v2" },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function authenticate(request: Request, adminOnly = true) {
  // Validar antes de qualquer chamada ao provedor.
  const token = bearerToken(request);
  const supabaseAdmin = getSupabaseAdmin();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new RequestError("Usuario nao autenticado.", 401);

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles").select("id, role, ativo").eq("user_id", user.id).single();
  if (profileError || profile?.ativo !== true ||
    !["admin", "coordenador", "rh", "supervisor"].includes(profile.role) ||
    (adminOnly && profile.role !== "admin")) {
    throw new RequestError("Usuario sem permissao.", 403);
  }
  return { user, profile, supabaseAdmin };
}
