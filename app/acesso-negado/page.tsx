"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import Brand from "../../src/components/Brand";
import ThemeToggle from "../../src/components/ThemeToggle";

export default function AcessoNegadoPage() {
  const router = useRouter();

  return (
    <main className="standalone-page">
      <div className="standalone-toolbar"><Brand /><ThemeToggle /></div>
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
          className="button-primary mt-6"
        >
          Voltar à visão geral
        </button>
      </div>
    </main>
  );
}
