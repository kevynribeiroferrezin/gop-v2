"use client";
import { useState } from "react";
import type { Supervisor } from "../lib/workspace-types";
import { supabase } from "../lib/supabase/client";
import { missingSchema } from "../lib/schema-errors";

export default function SupervisorDetailsEditor({ supervisor, onSaved }: { supervisor: Supervisor; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(supervisor.nome);
  const [code, setCode] = useState(supervisor.codigo ?? "");
  const [email, setEmail] = useState(supervisor.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !name.trim() || !code.trim()) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const { error } = await supabase.rpc("editar_supervisor", { p_supervisor_id: supervisor.id, p_nome: name.trim(), p_codigo: code.trim(), p_email: email.trim() || null });
      if (error) { setError(missingSchema(error) ? "A edição de supervisores depende da migração 006 no banco." : "Não foi possível salvar. Confira os dados e o vínculo com sua coordenação."); return; }
      await onSaved(); setSuccess("Dados do supervisor atualizados.");
    } catch { setError("Não foi possível salvar. Tente novamente."); }
    finally { setSaving(false); }
  }
  const changed = name !== supervisor.nome || code !== (supervisor.codigo ?? "") || email !== (supervisor.email ?? "");
  return <form onSubmit={save} className="supervisor-editor" aria-label={`Editar supervisor ${supervisor.nome}`}>
    <label>Nome<input aria-label={`Nome de ${supervisor.nome}`} required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Código<input aria-label={`Código de ${supervisor.nome}`} required maxLength={100} value={code} onChange={(event) => setCode(event.target.value)} /></label>
    <label>E-mail de contato<input aria-label={`E-mail de ${supervisor.nome}`} type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <button className="button-secondary" disabled={saving || !changed}>{saving ? "Salvando…" : "Salvar dados do supervisor"}</button>
    {error && <p className="auth-message error col-span-full" role="alert">{error}</p>}{success && <p className="auth-message success col-span-full" role="status">{success}</p>}
  </form>;
}
