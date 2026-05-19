"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

export default function AcessoNegadoPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldAlert size={34} />
        </div>

        <h1 className="mt-6 text-2xl font-black text-slate-900 dark:text-slate-100">
          Acesso negado
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Você não tem permissão para acessar esta página. Caso precise de
          acesso, fale com um administrador.
        </p>

        <button
          onClick={() => router.push("/")}
          className="mt-6 rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-yellow-400"
        >
          Voltar ao dashboard
        </button>
      </div>
    </main>
  );
}
