"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff, Loader2, LockKeyhole, Mail, Minus } from "lucide-react";
import { supabase } from "../../src/lib/supabase/client";
import { GENERIC_AUTH_ERROR } from "../../src/lib/errors";
import Brand from "../../src/components/Brand";
import ThemeToggle from "../../src/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      if (recovery) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/resetar-senha`,
        });
        if (error) { setError(GENERIC_AUTH_ERROR); return; }
        setSuccess(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) { setError("E-mail ou senha inválidos. Confira e tente novamente."); return; }
        router.replace("/");
      }
    } catch { setError(GENERIC_AUTH_ERROR); }
    finally { setLoading(false); }
  }

  return <main className="auth-layout">
    <aside className="auth-story" aria-label="Sobre o GOP">
      <Brand inverse />
      <div className="auth-story-content">
        <p className="auth-kicker"><span /> Menos planilhas. Mais presença.</p>
        <h2>Sua equipe,<br />no mesmo<br /><em>ritmo.</em></h2>
        <p className="auth-story-description">Da primeira chamada ao fechamento do dia. Um só lugar para acompanhar quem faz parte da sua operação.</p>
        <div className="rhythm" aria-hidden="true">
          <div className="rhythm-heading"><span>Uma rotina mais organizada</span><span>SEG — SEX</span></div>
          {["Presenças", "Acompanhamento", "Fechamentos"].map((label, row) => (
            <div className="rhythm-row" key={label}><span>{label}</span>
              {[0, 1, 2, 3, 4].map((day) => <span key={day} className={`rhythm-dot ${row === 2 && day > 2 ? "off" : ""}`}>
                {row === 2 && day > 2 ? <Minus size={12} /> : <Check size={12} />}
              </span>)}
            </div>
          ))}
        </div>
      </div>
      <div className="auth-story-footer"><span>Gestão de pessoas começa no dia a dia.</span><span>GOP / V2</span></div>
    </aside>
    <section className="auth-main">
      <div className="auth-toolbar"><span>SEU ESPAÇO DE TRABALHO</span><ThemeToggle /></div>
      <div className="auth-form">
        <div className="auth-mobile-brand"><Brand /></div>
        <h1>{recovery ? "Vamos recuperar seu acesso." : "Bom ter você por aqui."}</h1>
        <p className="auth-form-intro">{recovery ? "Informe o e-mail da sua conta para receber as instruções de redefinição de senha." : "Entre na sua conta para acompanhar a equipe e organizar as presenças de hoje."}</p>
        <form onSubmit={submit} aria-label={recovery ? "Recuperar acesso" : "Entrar no GOP"}>
          <div className="auth-field"><label htmlFor="login-email">E-mail de acesso</label>
            <div className="auth-input"><Mail size={17} />
              <input id="login-email" type="email" autoComplete="username" inputMode="email" placeholder="voce@empresa.com.br"
                value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
            </div>
          </div>
          {!recovery && <>
            <div className="auth-field"><label htmlFor="login-password">Senha</label>
              <div className="auth-input"><LockKeyhole size={17} />
                <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                  placeholder="Sua senha de acesso" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} />
                <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>
            <button type="button" className="auth-forgot" onClick={() => { setRecovery(true); setError(null); setSuccess(false); }}>Esqueci minha senha</button>
          </>}
          {error && <p className="auth-message error" role="alert">{error}</p>}
          {success && <p className="auth-message success" role="status">Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha.</p>}
          <button type="submit" className="button-primary auth-submit" disabled={loading}>
            {loading ? <Loader2 size={17} className="animate-spin" /> : null}
            {loading ? (recovery ? "Enviando…" : "Entrando…") : recovery ? "Enviar link de recuperação" : "Entrar na plataforma"}
            {!loading && <ArrowRight size={17} />}
          </button>
          {recovery && <button type="button" className="button-secondary auth-back" onClick={() => { setRecovery(false); setError(null); setSuccess(false); }}>Voltar para o login</button>}
        </form>
        <p className="auth-private"><LockKeyhole size={12} /> Acesso exclusivo para usuários autorizados.</p>
      </div>
      <footer className="auth-footer"><span>GOP · Controle de presenças</span><span>Simples no uso. Presente na rotina.</span></footer>
    </section>
  </main>;
}
