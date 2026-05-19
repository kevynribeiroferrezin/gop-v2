"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { supabase } from "../../src/lib/supabase/client";
import { GENERIC_AUTH_ERROR } from "../../src/lib/errors";
import { validarSenhaForte } from "../../src/lib/password";

export default function ResetarSenhaPage() {
  const router = useRouter();

  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  
  useEffect(() => {
  async function prepararSessaoRecuperacao() {
    setErro(null);

    const url = new URL(window.location.href);

    const code = url.searchParams.get("code");

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setErro("Link de recuperação inválido ou expirado.");
        return;
      }

      window.history.replaceState({}, document.title, "/resetar-senha");
      return;
    }

    const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setErro("Link de recuperação inválido ou expirado.");
        return;
      }

      window.history.replaceState({}, document.title, "/resetar-senha");
    }
  }

  prepararSessaoRecuperacao();
}, []);

  async function alterarSenha(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro(null);
    setSucesso(null);

    if (!senha) {
      setErro("Informe a nova senha.");
      return;
    }

    const senhaValidada = validarSenhaForte(senha);

    if (!senhaValidada.valid) {
      setErro(senhaValidada.message);
      return;
    }

    if (senha !== confirmarSenha) {
      setErro("As senhas não conferem.");
      return;
    }

    setCarregando(true);

    const { error } = await supabase.auth.updateUser({
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setErro(GENERIC_AUTH_ERROR);
      return;
    }

    setSucesso("Senha alterada com sucesso. Você já pode fazer login.");
    await supabase.auth.signOut();

    setTimeout(() => {
      router.push("/login");
    }, 1500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-600">
            <ShieldCheck size={26} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              GOP V2
            </h1>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-yellow-600">
              Redefinir senha
            </p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Criar nova senha</h2>

        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Digite sua nova senha para acessar o sistema.
        </p>

        <form onSubmit={alterarSenha} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Nova senha
            </label>

            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                required
                placeholder="Mínimo 10 caracteres, com letras, número e símbolo"
                className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Confirmar senha
            </label>

            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="password"
                value={confirmarSenha}
                onChange={(event) => setConfirmarSenha(event.target.value)}
                required
                placeholder="Repita a nova senha"
                className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
              />
            </div>
          </div>

          {erro && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {erro}
            </div>
          )}

          {sucesso && (
            <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {sucesso}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="h-12 w-full rounded-xl bg-yellow-500 text-sm font-bold text-slate-950 shadow-[0_10px_25px_rgba(234,179,8,0.30)] transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando ? "Alterando..." : "Alterar senha"}
          </button>
        </form>
      </div>
    </main>
  );
}
