"use client";

import Sidebar from "../../src/components/Sidebar";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Search, ShieldCheck } from "lucide-react";
import { supabase } from "../../src/lib/supabase/client";
import { GENERIC_DATA_ERROR, GENERIC_SAVE_ERROR } from "../../src/lib/errors";
import { registrarAuditoria } from "../../src/lib/audit";
import { validarSenhaForte } from "../../src/lib/password";

type Usuario = {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  role: "admin" | "supervisor" | "rh";
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export default function UsuariosPage() {
  const router = useRouter();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [modoCadastro, setModoCadastro] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    confirmarSenha: "",
    role: "supervisor" as "admin" | "supervisor" | "rh",
    codigoSupervisor: "",
  });

  const [formEdicao, setFormEdicao] = useState({
    nome: "",
    role: "supervisor" as "admin" | "supervisor" | "rh",
    ativo: true,
    codigoSupervisor: "",
    novaSenha: "",
    confirmarNovaSenha: "",
  });

  useEffect(() => {
    async function iniciar() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, ativo")
        .eq("user_id", session.user.id)
        .single();

      if (profileError || !profile) {
        router.push("/login");
        return;
      }

      if (profile.role !== "admin" || profile.ativo !== true) {
        router.push("/acesso-negado");
        return;
      }

      await carregarUsuarios();
    }

    iniciar();
  }, [router]);

  async function carregarUsuarios() {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, nome, email, role, ativo, created_at, updated_at")
      .order("nome", { ascending: true });

    if (error) {
      setErro(GENERIC_DATA_ERROR);
      setCarregando(false);
      return;
    }

    setUsuarios((data ?? []) as Usuario[]);
    setCarregando(false);
  }

  async function cadastrarUsuario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro(null);
    setSucesso(null);
    setSalvando(true);

    if (!form.nome.trim()) {
      setErro("Informe o nome do usuário.");
      setSalvando(false);
      return;
    }

    if (!form.email.trim()) {
      setErro("Informe o e-mail do usuário.");
      setSalvando(false);
      return;
    }

    if (!form.senha) {
      setErro("Informe a senha do usuário.");
      setSalvando(false);
      return;
    }

    const senhaValidada = validarSenhaForte(form.senha);

    if (!senhaValidada.valid) {
      setErro(senhaValidada.message);
      setSalvando(false);
      return;
    }

    if (form.senha !== form.confirmarSenha) {
      setErro("As senhas não conferem.");
      setSalvando(false);
      return;
    }

    if (form.role === "supervisor" && !form.codigoSupervisor.trim()) {
      setErro("Informe o código do supervisor.");
      setSalvando(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    // A criação passa pela API para manter a service role fora do navegador.
    const response = await fetch("/api/usuarios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        nome: form.nome,
        email: form.email,
        senha: form.senha,
        role: form.role,
        codigoSupervisor: form.codigoSupervisor,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setErro(result.error ?? "Erro ao criar usuário.");
      setSalvando(false);
      return;
    }

    setForm({
      nome: "",
      email: "",
      senha: "",
      confirmarSenha: "",
      role: "supervisor",
      codigoSupervisor: "",
    });

    setSucesso("Usuário criado com sucesso.");
    setModoCadastro(false);
    setSalvando(false);

    await carregarUsuarios();
  }

  async function abrirEdicaoUsuario(usuario: Usuario) {
    setErro(null);
    setSucesso(null);
    setUsuarioEditando(usuario);

    let codigoSupervisor = "";

    if (usuario.role === "supervisor") {
      const { data } = await supabase
        .from("supervisores")
        .select("codigo")
        .eq("profile_id", usuario.id)
        .maybeSingle();

      codigoSupervisor = data?.codigo ?? "";
    }

    setFormEdicao({
      nome: usuario.nome,
      role: usuario.role,
      ativo: usuario.ativo,
      codigoSupervisor,
      novaSenha: "",
      confirmarNovaSenha: "",
    });

    setModoCadastro(false);
    setModoEdicao(true);
  }

  async function salvarEdicaoUsuario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!usuarioEditando) {
      return;
    }

    setErro(null);
    setSucesso(null);
    setSalvando(true);

    if (!formEdicao.nome.trim()) {
      setErro("Informe o nome do usuário.");
      setSalvando(false);
      return;
    }

    if (formEdicao.role === "supervisor" && !formEdicao.codigoSupervisor.trim()) {
      setErro("Informe o código do supervisor.");
      setSalvando(false);
      return;
    }

    if (formEdicao.novaSenha || formEdicao.confirmarNovaSenha) {
      const senhaValidada = validarSenhaForte(formEdicao.novaSenha);

      if (!senhaValidada.valid) {
        setErro(senhaValidada.message);
        setSalvando(false);
        return;
      }

      if (formEdicao.novaSenha !== formEdicao.confirmarNovaSenha) {
        setErro("As novas senhas não conferem.");
        setSalvando(false);
        return;
      }
    }

    const confirmarAlteracao = window.confirm(
      formEdicao.novaSenha
        ? `Deseja salvar as alterações e redefinir a senha de ${usuarioEditando.nome}?`
        : `Deseja salvar as alterações do usuário ${usuarioEditando.nome}?`
    );

    if (!confirmarAlteracao) {
      setSalvando(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        nome: formEdicao.nome.trim(),
        role: formEdicao.role,
        ativo: formEdicao.ativo,
      })
      .eq("id", usuarioEditando.id);

    if (profileError) {
      setErro(profileError.message);
      setSalvando(false);
      return;
    }

    if (formEdicao.role === "supervisor") {
      const { data: supervisorExistente, error: supervisorBuscaError } =
        await supabase
          .from("supervisores")
          .select("id")
          .eq("profile_id", usuarioEditando.id)
          .maybeSingle();

      if (supervisorBuscaError) {
        setErro(supervisorBuscaError.message);
        setSalvando(false);
        return;
      }

      if (supervisorExistente) {
        const { error: supervisorUpdateError } = await supabase
          .from("supervisores")
          .update({
            codigo: formEdicao.codigoSupervisor.trim(),
            nome: formEdicao.nome.trim(),
            email: usuarioEditando.email,
            ativo: formEdicao.ativo,
          })
          .eq("id", supervisorExistente.id);

        if (supervisorUpdateError) {
          setErro(supervisorUpdateError.message);
          setSalvando(false);
          return;
        }
      } else {
        const { error: supervisorInsertError } = await supabase
          .from("supervisores")
          .insert({
            profile_id: usuarioEditando.id,
            codigo: formEdicao.codigoSupervisor.trim(),
            nome: formEdicao.nome.trim(),
            email: usuarioEditando.email,
            ativo: formEdicao.ativo,
          });

        if (supervisorInsertError) {
          setErro(supervisorInsertError.message);
          setSalvando(false);
          return;
        }
      }
    } else {
      await supabase
        .from("supervisores")
        .update({
          ativo: false,
        })
        .eq("profile_id", usuarioEditando.id);
    }

    if (formEdicao.novaSenha) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/usuarios/senha", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: usuarioEditando.user_id,
          novaSenha: formEdicao.novaSenha,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErro(result.error ?? "Erro ao redefinir senha.");
        setSalvando(false);
        return;
      }
    }

    await registrarAuditoria({
      entidade: "profiles",
      entidadeId: usuarioEditando.id,
      acao: "atualizar",
      detalhes: {
        role_anterior: usuarioEditando.role,
        role_novo: formEdicao.role,
        ativo_anterior: usuarioEditando.ativo,
        ativo_novo: formEdicao.ativo,
        senha_redefinida: Boolean(formEdicao.novaSenha),
      },
    });

    setSucesso("Usuário atualizado com sucesso.");
    setModoEdicao(false);
    setUsuarioEditando(null);
    setSalvando(false);

    await carregarUsuarios();
  }

  async function alternarStatusUsuario(usuario: Usuario) {
    const confirmar = window.confirm(
      usuario.ativo
        ? `Deseja inativar o usuário ${usuario.nome}?`
        : `Deseja ativar o usuário ${usuario.nome}?`
    );

    if (!confirmar) {
      return;
    }

    setErro(null);
    setSucesso(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        ativo: !usuario.ativo,
      })
      .eq("id", usuario.id);

    if (error) {
      setErro(GENERIC_SAVE_ERROR);
      return;
    }

    if (usuario.role === "supervisor") {
      await supabase
        .from("supervisores")
        .update({
          ativo: !usuario.ativo,
        })
        .eq("profile_id", usuario.id);
    }

    await registrarAuditoria({
      entidade: "profiles",
      entidadeId: usuario.id,
      acao: usuario.ativo ? "inativar" : "ativar",
      detalhes: {
        role: usuario.role,
      },
    });

    setSucesso(
      usuario.ativo
        ? "Usuário inativado com sucesso."
        : "Usuário ativado com sucesso."
    );

    await carregarUsuarios();
  }

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return usuarios;
    }

    return usuarios.filter((item) => {
      return (
        item.nome.toLowerCase().includes(termo) ||
        item.email.toLowerCase().includes(termo) ||
        item.role.toLowerCase().includes(termo)
      );
    });
  }, [busca, usuarios]);

  function labelPerfil(role: string) {
    if (role === "admin") return "Administrador";
    if (role === "rh") return "RH";
    if (role === "supervisor") return "Supervisor";
    return role;
  }

  function classePerfil(role: string) {
    if (role === "admin") {
      return "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-200";
    }

    if (role === "rh") {
      return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200";
    }

    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] dark:bg-slate-950">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-8 py-6 text-sm font-semibold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
          <Loader2 className="animate-spin text-yellow-500" size={20} />
          Carregando usuários...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] pb-24 dark:bg-slate-950 lg:pb-0">
      <div className="flex min-h-screen">
        <Sidebar active="usuarios" />

        <section className="flex-1 p-4 lg:p-8">
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <button
                onClick={() => router.push("/")}
                className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <ArrowLeft size={18} />
                Voltar ao dashboard
              </button>

              <p className="text-sm font-semibold text-yellow-600">
                Acessos do sistema
              </p>

              <h1 className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">
                Usuários
              </h1>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Consulte e gerencie os usuários com acesso ao sistema.
              </p>
            </div>

            {!modoCadastro && !modoEdicao && (
              <button
                onClick={() => {
                  setErro(null);
                  setSucesso(null);
                  setModoEdicao(false);
                  setUsuarioEditando(null);
                  setModoCadastro(true);
                }}
                className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_10px_25px_rgba(234,179,8,0.25)] transition hover:bg-yellow-400"
              >
                Novo usuário
              </button>
            )}
          </header>

          {erro && (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {erro}
            </div>
          )}

          {sucesso && (
            <div className="mb-4 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
              {sucesso}
            </div>
          )}

          {modoCadastro ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-yellow-600">
                    Novo acesso
                  </p>

                  <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                    Cadastrar usuário
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Crie um novo acesso para administrador, RH ou supervisor.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setModoCadastro(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Voltar para lista
                </button>
              </div>

              <form onSubmit={cadastrarUsuario} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Nome completo
                    </label>

                    <input
                      value={form.nome}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          nome: event.target.value,
                        }))
                      }
                      placeholder="Nome do usuário"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      E-mail
                    </label>

                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          email: event.target.value,
                        }))
                      }
                      placeholder="usuario@empresa.com"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Senha
                    </label>

                    <input
                      type="password"
                      value={form.senha}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          senha: event.target.value,
                        }))
                      }
                      placeholder="Mínimo 10 caracteres, com letras, número e símbolo"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Confirmar senha
                    </label>

                    <input
                      type="password"
                      value={form.confirmarSenha}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          confirmarSenha: event.target.value,
                        }))
                      }
                      placeholder="Repita a senha"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Perfil
                    </label>

                    <select
                      value={form.role}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          role: event.target.value as
                            | "admin"
                            | "supervisor"
                            | "rh",
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="supervisor">Supervisor</option>
                      <option value="rh">RH</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  {form.role === "supervisor" && (
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                        Código do supervisor
                      </label>

                      <input
                        value={form.codigoSupervisor}
                        onChange={(event) =>
                          setForm((atual) => ({
                            ...atual,
                            codigoSupervisor: event.target.value,
                          }))
                        }
                        placeholder="Ex: SUP2"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setModoCadastro(false)}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={salvando}
                    className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_10px_25px_rgba(234,179,8,0.25)] transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {salvando ? "Salvando..." : "Salvar usuário"}
                  </button>
                </div>
              </form>
            </section>
          ) : modoEdicao ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-yellow-600">
                    Editar acesso
                  </p>

                  <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                    Editar usuário
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Atualize nome, perfil e status do usuário.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setModoEdicao(false);
                    setUsuarioEditando(null);
                  }}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Voltar para lista
                </button>
              </div>

              <form onSubmit={salvarEdicaoUsuario} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Nome completo
                    </label>

                    <input
                      value={formEdicao.nome}
                      onChange={(event) =>
                        setFormEdicao((atual) => ({
                          ...atual,
                          nome: event.target.value,
                        }))
                      }
                      placeholder="Nome do usuário"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      E-mail
                    </label>

                    <input
                      value={usuarioEditando?.email ?? ""}
                      disabled
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-500 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Perfil
                    </label>

                    <select
                      value={formEdicao.role}
                      onChange={(event) =>
                        setFormEdicao((atual) => ({
                          ...atual,
                          role: event.target.value as
                            | "admin"
                            | "supervisor"
                            | "rh",
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="supervisor">Supervisor</option>
                      <option value="rh">RH</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Status
                    </label>

                    <select
                      value={formEdicao.ativo ? "ativo" : "inativo"}
                      onChange={(event) =>
                        setFormEdicao((atual) => ({
                          ...atual,
                          ativo: event.target.value === "ativo",
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>

                  {formEdicao.role === "supervisor" && (
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                        Código do supervisor
                      </label>

                      <input
                        value={formEdicao.codigoSupervisor}
                        onChange={(event) =>
                          setFormEdicao((atual) => ({
                            ...atual,
                            codigoSupervisor: event.target.value,
                          }))
                        }
                        placeholder="Ex: SUP2"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Nova senha
                    </label>

                    <input
                      type="password"
                      value={formEdicao.novaSenha}
                      onChange={(event) =>
                        setFormEdicao((atual) => ({
                          ...atual,
                          novaSenha: event.target.value,
                        }))
                      }
                      placeholder="Deixe em branco para manter"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Confirmar nova senha
                    </label>

                    <input
                      type="password"
                      value={formEdicao.confirmarNovaSenha}
                      onChange={(event) =>
                        setFormEdicao((atual) => ({
                          ...atual,
                          confirmarNovaSenha: event.target.value,
                        }))
                      }
                      placeholder="Repita a nova senha"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setModoEdicao(false);
                      setUsuarioEditando(null);
                    }}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={salvando}
                    className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_10px_25px_rgba(234,179,8,0.25)] transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {salvando ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    Lista de usuários
                  </h2>

                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Total encontrado: {usuariosFiltrados.length}
                  </p>
                </div>

                <div className="relative w-full lg:w-80">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    placeholder="Buscar por nome, e-mail ou perfil..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-[860px] w-full border-collapse text-center text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
                        Nome
                      </th>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
                        E-mail
                      </th>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
                        Perfil
                      </th>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
                        Status
                      </th>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
                        Criado em
                      </th>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
                        Ações
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {usuariosFiltrados.map((item) => (
                      <tr
                        key={item.id}
                        className="transition hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-300">
                              <ShieldCheck size={20} />
                            </div>

                            <p className="font-black text-slate-900 dark:text-slate-100">
                              {item.nome}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-center text-slate-600 dark:text-slate-300">
                          {item.email}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${classePerfil(
                              item.role
                            )}`}
                          >
                            {labelPerfil(item.role)}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              item.ativo
                                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {item.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-center text-slate-600 dark:text-slate-300">
                          {new Date(item.created_at).toLocaleDateString(
                            "pt-BR"
                          )}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEdicaoUsuario(item)}
                              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => alternarStatusUsuario(item)}
                              className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                                item.ativo
                                  ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900"
                                  : "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-200 dark:hover:bg-green-900"
                              }`}
                            >
                              {item.ativo ? "Inativar" : "Ativar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {usuariosFiltrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"
                        >
                          Nenhum usuário encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
