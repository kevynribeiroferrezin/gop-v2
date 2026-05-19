"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Lock, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "../../src/lib/supabase/client";
import { GENERIC_AUTH_ERROR } from "../../src/lib/errors";

export default function LoginPage() {
  const router = useRouter();
  const [modoRecuperacao, setModoRecuperacao] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [sucessoRecuperacao, setSucessoRecuperacao] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro(null);
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }

    router.push("/");
  }

  async function enviarRecuperacaoSenha(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro(null);
    setSucessoRecuperacao(null);
    setCarregando(true);

    const redirectTo = `${window.location.origin}/resetar-senha`;

    const { error } = await supabase.auth.resetPasswordForEmail(
      emailRecuperacao,
      {
        redirectTo,
      }
    );

    setCarregando(false);

    if (error) {
      setErro(GENERIC_AUTH_ERROR);
      return;
    }

    setSucessoRecuperacao(
      "Enviamos um link de redefinição de senha para o e-mail informado."
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] p-4">
      <div className="mx-auto grid min-h-[calc(100vh-32px)] max-w-7xl grid-cols-1 overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-[0_20px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[420px_1fr]">
        {/* Lado esquerdo - formulário */}
        <section className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-sm">
            {/* Logo */}
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-600">
                <ShieldCheck size={26} />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  GOP V2
                </h1>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-yellow-600">
                  Presenças
                </p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Bem-vindo de volta!
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Faça login para continuar
              </p>
            </div>

            {modoRecuperacao ? (
  <form onSubmit={enviarRecuperacaoSenha} className="space-y-4">
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        E-mail
      </label>

      <div className="relative">
        <Mail
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          type="email"
          value={emailRecuperacao}
          onChange={(event) => setEmailRecuperacao(event.target.value)}
          required
          placeholder="seu@email.com"
          className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
        />
      </div>
    </div>

    {erro && (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {erro}
      </div>
    )}

    {sucessoRecuperacao && (
      <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
        {sucessoRecuperacao}
      </div>
    )}

    <button
      type="submit"
      disabled={carregando}
      className="mt-2 h-12 w-full rounded-xl bg-yellow-500 text-sm font-bold text-slate-950 shadow-[0_10px_25px_rgba(234,179,8,0.30)] transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {carregando ? "Enviando..." : "Enviar link de recuperação"}
    </button>

    <button
      type="button"
      onClick={() => {
        setModoRecuperacao(false);
        setErro(null);
        setSucessoRecuperacao(null);
      }}
      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 transition hover:bg-slate-50"
    >
      Voltar para login
    </button>
  </form>
) : (
  <form onSubmit={entrar} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          E-mail
        </label>

        <div className="relative">
          <Mail
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="seu@email.com"
            className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Senha
        </label>

        <div className="relative">
          <Lock
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type={mostrarSenha ? "text" : "password"}
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
            placeholder="Digite sua senha"
            className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-11 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
          />

          <button
            type="button"
            onClick={() => setMostrarSenha(!mostrarSenha)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 dark:text-slate-200"
            aria-label="Mostrar senha"
          >
            <Eye size={18} />
          </button>
        </div>

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setErro(null);
              setSucessoRecuperacao(null);
              setEmailRecuperacao(email);
              setModoRecuperacao(true);
            }}
            className="text-xs font-semibold text-yellow-600 transition hover:text-yellow-700"
          >
            Esqueceu a senha?
          </button>
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erro}
        </div>
      )}

      <button
        type="submit"
        disabled={carregando}
        className="mt-2 h-12 w-full rounded-xl bg-yellow-500 text-sm font-bold text-slate-950 shadow-[0_10px_25px_rgba(234,179,8,0.30)] transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {carregando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  )}

            <div className="mt-8">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">acesso restrito</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                Sistema interno para controle de presença e supervisão
              </div>
            </div>
          </div>
        </section>

        {/* Lado direito - área visual */}
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 lg:block">
          <div className="absolute -left-24 bottom-[-120px] h-72 w-72 rounded-full bg-white dark:bg-slate-900/10" />
          <div className="absolute -right-24 top-[-80px] h-80 w-80 rounded-full bg-white dark:bg-slate-900/10" />
          <div className="absolute right-20 top-20 h-20 w-20 rounded-full bg-white dark:bg-slate-900/10" />

          <div className="relative z-10 flex h-full flex-col justify-center px-20">
            <div className="max-w-lg">
              <h2 className="text-4xl font-bold leading-tight text-white">
                Gestão de presença simples e eficiente
              </h2>

              <p className="mt-5 max-w-md text-base leading-7 text-yellow-50">
                Controle a frequência da sua equipe de forma rápida, intuitiva e
                segura.
              </p>
            </div>

            <div className="mt-14 flex items-end gap-8">
              {/* Ilustração */}
              <div className="relative">
                <div className="absolute -bottom-8 -left-10 h-28 w-20 rounded-t-full bg-yellow-800/20" />
                <div className="absolute -bottom-8 left-8 h-36 w-24 rounded-t-full bg-yellow-800/20" />

                <div className="relative w-[310px] rounded-2xl bg-white dark:bg-slate-900/95 p-4 shadow-2xl">
                  <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-yellow-400" />
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                  </div>

                  <div className="space-y-3">
                    {[
                      ["Maria Santos", "Presente"],
                      ["João Pereira", "Presente"],
                      ["Ana Costa", "Falta"],
                      ["Carlos Lima", "Presente"],
                    ].map(([nome, status]) => (
                      <div
                        key={nome}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-500" />
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {nome}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Colaborador
                            </p>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                            status === "Presente"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="absolute -right-8 -top-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 text-yellow-600 shadow-xl">
                  <ShieldCheck size={34} />
                </div>
              </div>

              <div className="mb-4 hidden rounded-2xl bg-white dark:bg-slate-900/15 p-5 backdrop-blur-md xl:block">
                <p className="text-sm font-semibold text-white">
                  Chamada rápida
                </p>
                <p className="mt-1 text-xs leading-5 text-yellow-50">
                  Presente vem como padrão.
                  <br />
                  O supervisor marca apenas exceções.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
