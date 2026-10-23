"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import { missingSchema } from "../lib/schema-errors";

type Reminder = { id: string; data_chamada: string; mensagem: string; created_at: string };
export default function ReminderInbox() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("cobrancas_chamada").select("id, data_chamada, mensagem, created_at")
      .is("lida_em", null).order("created_at", { ascending: false }).limit(20);
    if (!error) { setItems(data ?? []); setError(""); }
    else if (missingSchema(error)) { setItems([]); setError(""); }
    else setError("Não foi possível carregar as solicitações de fechamento.");
  }, []);
  useEffect(() => {
    let live = true;
    queueMicrotask(() => { if (live) void load(); });
    const timer = setInterval(() => { void load(); }, 60000);
    return () => { live = false; clearInterval(timer); };
  }, [load]);
  async function acknowledge(id: string) {
    const { error } = await supabase.from("cobrancas_chamada").update({ lida_em: new Date().toISOString() }).eq("id", id);
    if (error) { setError("Não foi possível marcar a notificação como lida."); return; }
    setItems((current) => current.filter((item) => item.id !== id));
  }
  if (!items.length && !error) return null;
  return <section className="surface reminder-inbox"><h2><Bell size={17} /> Solicitações de fechamento</h2>
    {error && <p role="alert">{error}</p>}
    {items.map((item) => <div className="reminder-item" key={item.id}><div><strong>Chamada de {item.data_chamada.split("-").reverse().join("/")}</strong><p>{item.mensagem}</p></div><button type="button" className="button-secondary" onClick={() => acknowledge(item.id)}>Marcar como lida</button></div>)}
  </section>;
}
