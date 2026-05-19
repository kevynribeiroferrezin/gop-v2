import { supabase } from "./supabase/client";

type AuditPayload = {
  entidade: string;
  entidadeId?: string | number | null;
  acao: string;
  detalhes?: Record<string, unknown>;
};

export async function registrarAuditoria(payload: AuditPayload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return false;
  }

  const response = await fetch("/api/auditoria", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  return response.ok;
}

