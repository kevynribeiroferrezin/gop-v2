"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { supabase } from "../../src/lib/supabase/client";
import { GENERIC_AUTH_ERROR } from "../../src/lib/errors";
import { validarSenhaForte } from "../../src/lib/password";
import Brand from "../../src/components/Brand";
import ThemeToggle from "../../src/components/ThemeToggle";

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

  return <main className="standalone-page">
    <div className="standalone-toolbar"><Brand /><ThemeToggle /></div>
    <section className="surface w-full max-w-md p-7 sm:p-9">
      <p className="eyebrow">Recuperação de acesso</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Uma nova senha.<br />O mesmo espaço de trabalho.</h1>
      <p className="mt-4 mb-7 text-sm leading-6 text-slate-500 dark:text-slate-400">Use pelo menos 10 caracteres, com letras maiúsculas e minúsculas, número e símbolo.</p>
      <form onSubmit={alterarSenha}>
        <div className="auth-field"><label htmlFor="new-password">Nova senha</label><div className="auth-input"><Lock size={17} /><input id="new-password" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={senha} onChange={(event) => setSenha(event.target.value)} required placeholder="Crie uma senha forte" /></div></div>
        <div className="auth-field"><label htmlFor="confirm-password">Confirmar nova senha</label><div className="auth-input"><Lock size={17} /><input id="confirm-password" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={confirmarSenha} onChange={(event) => setConfirmarSenha(event.target.value)} required placeholder="Digite a senha novamente" /></div></div>
        {erro && <p className="auth-message error" role="alert">{erro}</p>}
        {sucesso && <p className="auth-message success" role="status">{sucesso}</p>}
        <button type="submit" disabled={carregando} className="button-primary auth-submit">{carregando ? "Salvando nova senha…" : "Salvar nova senha"}</button>
      </form>
    </section>
  </main>;
}
