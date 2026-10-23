"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, mounted, toggleTheme } = useTheme();
  const dark = mounted && theme === "dark";
  return (
    <button type="button" onClick={toggleTheme} className="theme-toggle"
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={dark ? "Ativar modo claro" : "Ativar modo escuro"}>
      <span className={!dark ? "selected" : ""}><Sun size={15} /></span>
      <span className={dark ? "selected" : ""}><Moon size={15} /></span>
    </button>
  );
}
