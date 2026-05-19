"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  LogOut,
  UserCheck,
  Users,
  UserCog,
} from "lucide-react";
import { supabase } from "../lib/supabase/client";
import ThemeToggle from "./ThemeToggle";

type Role = "admin" | "supervisor" | "rh";

type SidebarProps = {
  active: "dashboard" | "chamada" | "colaboradores" | "usuarios";
};

type MenuItem = {
  label: string;
  path: string;
  active: SidebarProps["active"];
  icon: React.ReactNode;
  roles: Role[];
};

export default function Sidebar({ active }: SidebarProps) {
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    async function carregarPerfil() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (data?.role) {
        setRole(data.role as Role);
      }
    }

    carregarPerfil();
  }, [router]);

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const menus: MenuItem[] = [
    {
      label: "Dashboard",
      path: "/",
      active: "dashboard",
      icon: <CalendarCheck size={18} />,
      roles: ["admin", "supervisor", "rh"],
    },
    {
      label: "Chamada",
      path: "/chamada",
      active: "chamada",
      icon: <UserCheck size={18} />,
      roles: ["admin", "supervisor"],
    },
    {
      label: "Colaboradores",
      path: "/colaboradores",
      active: "colaboradores",
      icon: <Users size={18} />,
      roles: ["admin", "rh", "supervisor"],
    },
    {
      label: "Usuários",
      path: "/usuarios",
      active: "usuarios",
      icon: <UserCog size={18} />,
      roles: ["admin"],
    },
  ];

  const menusPermitidos = role
    ? menus.filter((menu) => menu.roles.includes(role))
    : [];

  return (
    <>
      <aside className="hidden w-72 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
        <div className="flex h-full flex-col p-6">
          <div className="mb-10">
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
              GOP V2
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-yellow-600">
              Presenças
            </p>
          </div>

          <nav className="space-y-2">
            {menusPermitidos.map((menu) => {
              const ativo = active === menu.active;

              return (
                <button
                  key={menu.path}
                  onClick={() => router.push(menu.path)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                    ativo
                      ? "bg-yellow-50 font-bold text-yellow-700 dark:bg-yellow-950 dark:text-yellow-200"
                      : "font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {menu.icon}
                  {menu.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <ThemeToggle />

            <button
              onClick={sair}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_16px_45px_rgba(15,23,42,0.16)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${Math.max(
                menusPermitidos.length,
                1
              )}, minmax(0, 1fr))`,
            }}
          >
            {menusPermitidos.map((menu) => {
              const ativo = active === menu.active;

              return (
                <button
                  key={menu.path}
                  type="button"
                  onClick={() => router.push(menu.path)}
                  aria-label={menu.label}
                  title={menu.label}
                  className={`flex h-12 items-center justify-center rounded-xl transition ${
                    ativo
                      ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-200"
                      : "text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {menu.icon}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={sair}
            aria-label="Sair"
            title="Sair"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>
    </>
  );
}
