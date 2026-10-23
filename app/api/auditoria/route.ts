import { NextResponse } from "next/server";
import { authenticate } from "../../../src/lib/supabase/server";
import { RequestError, readJsonObject } from "../../../src/lib/api-security";

type AuditQuery = {
  id: string;
  actor_role: string | null;
  entidade: string;
  entidade_id: string | null;
  acao: string;
  created_at: string;
  profiles?: {
    nome: string | null;
    email: string | null;
  } | null;
};

type AuditQueryRow = Omit<AuditQuery, "profiles"> & {
  profiles?:
    | {
        nome: string | null;
        email: string | null;
      }
    | {
        nome: string | null;
        email: string | null;
      }[]
    | null;
};

const ENTIDADES_PERMITIDAS = new Set([
  "funcionarios",
  "presencas",
  "fechamentos_chamada",
  "profiles",
  "supervisores",
  "auth.users",
]);

export async function GET(request: Request) {
  try {
    const { supabaseAdmin } = await authenticate(request);

    const { searchParams } = new URL(request.url);
    const entidade = searchParams.get("entidade");
    const limiteParam = Number(searchParams.get("limit") ?? "80");
    const limite = Number.isFinite(limiteParam)
      ? Math.min(Math.max(limiteParam, 1), 200)
      : 80;

    let query = supabaseAdmin
      .from("audit_logs")
      .select(
        "id, actor_role, entidade, entidade_id, acao, created_at, profiles:actor_profile_id(nome, email)"
      )
      .order("created_at", { ascending: false })
      .limit(limite);

    if (entidade && ENTIDADES_PERMITIDAS.has(entidade)) {
      query = query.eq("entidade", entidade);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Nao foi possivel carregar a auditoria." },
        { status: 400 }
      );
    }

    const logs = ((data ?? []) as AuditQueryRow[]).map((item) => ({
      ...item,
      profiles: Array.isArray(item.profiles)
        ? item.profiles[0] ?? null
        : item.profiles ?? null,
    }));

    return NextResponse.json({ logs });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Nao foi possivel carregar a auditoria." },
      { status: 500 }
    );
  }
}

// Relatos do cliente nao comprovam que uma alteracao aconteceu. A origem e
// explicita; eventos administrativos reais continuam registrados no servidor.
export async function POST(request: Request) {
  try {
    const { user, profile, supabaseAdmin } = await authenticate(request, false);
    const body = await readJsonObject(request);
    const allowed = profile.role === "admin"
      ? ["funcionarios", "presencas", "fechamentos_chamada", "profiles", "supervisores"]
      : profile.role === "rh" ? ["funcionarios"] : profile.role === "supervisor" ? ["presencas", "fechamentos_chamada"] : [];
    const actions = ["criar", "atualizar", "ativar", "inativar", "finalizar_chamada", "lancar_ferias", "salvar_chamada"];
    if (typeof body.entidade !== "string" || !allowed.includes(body.entidade) ||
      typeof body.acao !== "string" || !actions.includes(body.acao) ||
      (body.entidadeId != null &&
        !["string", "number"].includes(typeof body.entidadeId)) ||
      String(body.entidadeId ?? "").length > 128) {
      throw new RequestError("Evento invalido.");
    }
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: user.id,
      actor_profile_id: profile.id,
      actor_role: profile.role,
      entidade: body.entidade,
      entidade_id: body.entidadeId == null ? null : String(body.entidadeId),
      acao: "relato_cliente",
      // Nao persistir detalhes livres, IP ou User-Agent controlados pelo cliente.
      detalhes: { origem: "client_report", verificado: false, acao_informada: body.acao },
    });
    if (error) throw new Error("Falha ao registrar relato.");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Nao foi possivel registrar auditoria." }, { status: 500 });
  }
}
