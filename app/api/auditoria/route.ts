import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  entidade: string;
  entidadeId?: string | number | null;
  acao: string;
  detalhes?: Record<string, unknown>;
};

type AuditQuery = {
  id: string;
  actor_role: string | null;
  entidade: string;
  entidade_id: string | null;
  acao: string;
  detalhes: Record<string, unknown>;
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL nao encontrada");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY nao encontrada");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  db: {
    schema: "gop_v2",
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const ENTIDADES_PERMITIDAS = new Set([
  "funcionarios",
  "presencas",
  "fechamentos_chamada",
  "profiles",
  "supervisores",
  "auth.users",
]);

const ACOES_PERMITIDAS = new Set([
  "criar",
  "atualizar",
  "ativar",
  "inativar",
  "redefinir_senha",
  "finalizar_chamada",
  "lancar_ferias",
  "salvar_chamada",
]);

async function getAuthenticatedProfile(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return { status: 401 as const, error: "Token de autenticacao nao informado." };
  }

  const token = authorization.replace("Bearer ", "");

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return { status: 401 as const, error: "Usuario nao autenticado." };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role, ativo")
    .eq("user_id", user.id)
    .single();

  if (!profile?.ativo) {
    return { status: 403 as const, error: "Usuario sem permissao." };
  }

  return { user, profile };
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedProfile(request);

    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (auth.profile.role !== "admin") {
      return NextResponse.json(
        { error: "Apenas administradores podem consultar auditoria." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const entidade = searchParams.get("entidade");
    const limiteParam = Number(searchParams.get("limit") ?? "80");
    const limite = Number.isFinite(limiteParam)
      ? Math.min(Math.max(limiteParam, 1), 200)
      : 80;

    let query = supabaseAdmin
      .from("audit_logs")
      .select(
        "id, actor_role, entidade, entidade_id, acao, detalhes, created_at, profiles:actor_profile_id(nome, email)"
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
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel carregar a auditoria." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const userAgent = request.headers.get("user-agent");

    const auth = await getAuthenticatedProfile(request);

    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as Body;

    if (
      !ENTIDADES_PERMITIDAS.has(body.entidade) ||
      !ACOES_PERMITIDAS.has(body.acao)
    ) {
      return NextResponse.json(
        { error: "Evento de auditoria invalido." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: auth.user.id,
      actor_profile_id: auth.profile.id,
      actor_role: auth.profile.role,
      entidade: body.entidade,
      entidade_id:
        body.entidadeId === undefined || body.entidadeId === null
          ? null
          : String(body.entidadeId),
      acao: body.acao,
      detalhes: body.detalhes ?? {},
      ip: forwardedFor?.split(",")[0]?.trim() || null,
      user_agent: userAgent,
    });

    if (error) {
      return NextResponse.json(
        { error: "Nao foi possivel registrar auditoria." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel registrar auditoria." },
      { status: 500 }
    );
  }
}
