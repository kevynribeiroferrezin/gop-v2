import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validarSenhaForte } from "../../../src/lib/password";

type Body = {
  nome: string;
  email: string;
  senha: string;
  role: "admin" | "supervisor" | "rh";
  codigoSupervisor?: string;
  regionalId?: number | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL não encontrada");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY não encontrada");
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

const INTERNAL_ERROR_MESSAGE =
  "Nao foi possivel concluir a solicitacao. Tente novamente em instantes.";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization) {
      return NextResponse.json(
        { error: "Token de autenticação não informado." },
        { status: 401 }
      );
    }

    const token = authorization.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    const { data: profileAdmin, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, ativo")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profileAdmin) {
      return NextResponse.json(
        { error: "Perfil do usuário não encontrado." },
        { status: 403 }
      );
    }

    if (profileAdmin.role !== "admin" || profileAdmin.ativo !== true) {
      return NextResponse.json(
        { error: "Apenas administradores podem cadastrar usuários." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Body;

    const nome = body.nome?.trim();
    const email = body.email?.trim().toLowerCase();
    const senha = body.senha;
    const role = body.role;
    const codigoSupervisor = body.codigoSupervisor?.trim();
    const regionalId = body.regionalId ?? null;

    if (!nome) {
      return NextResponse.json(
        { error: "Nome é obrigatório." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "E-mail é obrigatório." },
        { status: 400 }
      );
    }

    if (!senha) {
      return NextResponse.json(
        { error: "Senha obrigatoria." },
        { status: 400 }
      );
    }

    const senhaValidada = validarSenhaForte(senha);

    if (!senhaValidada.valid) {
      return NextResponse.json(
        { error: senhaValidada.message },
        { status: 400 }
      );
    }

    if (!["admin", "supervisor", "rh"].includes(role)) {
      return NextResponse.json(
        { error: "Perfil inválido." },
        { status: 400 }
      );
    }

    if (role === "supervisor" && !codigoSupervisor) {
      return NextResponse.json(
        { error: "Código do supervisor é obrigatório." },
        { status: 400 }
      );
    }

    const { data: novoAuth, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: {
          nome,
        },
      });

    if (authError || !novoAuth.user) {
      return NextResponse.json(
        { error: "Nao foi possivel criar o usuario." },
        { status: 400 }
      );
    }

    const novoUserId = novoAuth.user.id;

    const { data: novoProfile, error: profileInsertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: novoUserId,
        nome,
        email,
        role,
        ativo: true,
      })
      .select("id")
      .single();

    if (profileInsertError || !novoProfile) {
      await supabaseAdmin.auth.admin.deleteUser(novoUserId);

      return NextResponse.json(
        { error: "Nao foi possivel criar o perfil do usuario." },
        { status: 400 }
      );
    }

    if (role === "supervisor") {
      const { error: supervisorError } = await supabaseAdmin
        .from("supervisores")
        .insert({
          profile_id: novoProfile.id,
          codigo: codigoSupervisor,
          nome,
          email,
          regional_id: regionalId,
          ativo: true,
        });

      if (supervisorError) {
        await supabaseAdmin.from("profiles").delete().eq("id", novoProfile.id);
        await supabaseAdmin.auth.admin.deleteUser(novoUserId);

        return NextResponse.json(
          { error: "Nao foi possivel criar o vinculo do supervisor." },
          { status: 400 }
        );
      }
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: user.id,
      actor_profile_id: profileAdmin.id,
      actor_role: profileAdmin.role,
      entidade: "profiles",
      entidade_id: novoProfile.id,
      acao: "criar",
      detalhes: {
        role,
        email,
        user_id: novoUserId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Usuário criado com sucesso.",
    });
  } catch {
    return NextResponse.json(
      { error: INTERNAL_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}
