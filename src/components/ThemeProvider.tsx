"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
const ThemeContext = createContext<{
  theme: Theme; mounted: boolean; toggleTheme: () => void;
} | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    function sync() {
      let saved: string | null = null;
      try { saved = localStorage.getItem("theme"); } catch { /* Navegacao privada. */ }
      const next = saved === "dark" || saved === "light" ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      applyTheme(next);
      setTheme(next);
      setMounted(true);
    }
    queueMicrotask(sync);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const storage = (event: StorageEvent) => { if (event.key === "theme" || event.key === null) sync(); };
    window.addEventListener("storage", storage);
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener("storage", storage);
      media.removeEventListener("change", sync);
    };
  }, []);
  function toggleTheme() {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
    try { localStorage.setItem("theme", next); } catch { /* A escolha funciona nesta aba. */ }
  }
  return <ThemeContext.Provider value={{ theme, mounted, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme precisa estar dentro do ThemeProvider");
  return context;
}
