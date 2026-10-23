import { NextResponse } from "next/server";
import { authenticate } from "../../../src/lib/supabase/server";
import { RequestError, readJsonObject, newUserInput } from "../../../src/lib/api-security";
import { validarSenhaForte } from "../../../src/lib/password";

const INTERNAL_ERROR_MESSAGE =
  "Nao foi possivel concluir a solicitacao. Tente novamente em instantes.";

export async function POST(request: Request) {
  try {
    const { user, profile: profileAdmin, supabaseAdmin } = await authenticate(request);
    const { nome, email, senha, role, codigoSupervisor, regionalId } =
      newUserInput(await readJsonObject(request));

    const senhaValidada = validarSenhaForte(senha);

    if (!senhaValidada.valid) {
      return NextResponse.json(
        { error: senhaValidada.message },
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
      message: "Usuario criado com sucesso.",
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
