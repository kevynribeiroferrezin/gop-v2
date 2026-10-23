import { NextResponse } from "next/server";
import { authenticate } from "../../../../src/lib/supabase/server";
import { RequestError, readJsonObject, passwordInput } from "../../../../src/lib/api-security";
import { validarSenhaForte } from "../../../../src/lib/password";

const INTERNAL_ERROR_MESSAGE =
  "Nao foi possivel concluir a solicitacao. Tente novamente em instantes.";

export async function PATCH(request: Request) {
  try {
    const { user, profile: profileAdmin, supabaseAdmin } = await authenticate(request);
    const { userId, novaSenha } = passwordInput(await readJsonObject(request));

    const senhaValidada = validarSenhaForte(novaSenha);

    if (!senhaValidada.valid) {
      return NextResponse.json(
        { error: senhaValidada.message },
        { status: 400 }
      );
    }

    // A service role pode operar no Auth inteiro. Restringir ao cadastro GOP.
    const { data: target, error: targetError } = await supabaseAdmin
      .from("profiles").select("id").eq("user_id", userId).single();
    if (targetError || !target) {
      return NextResponse.json({ error: "Usuario indisponivel." }, { status: 404 });
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
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: INTERNAL_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}
