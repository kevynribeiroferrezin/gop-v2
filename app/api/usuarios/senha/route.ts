import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validarSenhaForte } from "../../../../src/lib/password";

type Body = {
  userId: string;
  novaSenha: string;
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

export async function PATCH(request: Request) {
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
        { error: "Apenas administradores podem redefinir senha." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Body;

    const userId = body.userId;
    const novaSenha = body.novaSenha;

    if (!userId) {
      return NextResponse.json(
        { error: "ID do usuário não informado." },
        { status: 400 }
      );
    }

    if (!novaSenha) {
      return NextResponse.json(
        { error: "Nova senha obrigatoria." },
        { status: 400 }
      );
    }

    const senhaValidada = validarSenhaForte(novaSenha);

    if (!senhaValidada.valid) {
      return NextResponse.json(
        { error: senhaValidada.message },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        password: novaSenha,
      }
    );

    if (updateError) {
      return NextResponse.json(
        { error: "Nao foi possivel redefinir a senha." },
        { status: 400 }
      );
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: user.id,
      actor_profile_id: profileAdmin.id,
      actor_role: profileAdmin.role,
      entidade: "auth.users",
      entidade_id: userId,
      acao: "redefinir_senha",
      detalhes: {},
    });

    return NextResponse.json({
      success: true,
      message: "Senha redefinida com sucesso.",
    });
  } catch {
    return NextResponse.json(
      { error: INTERNAL_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}
