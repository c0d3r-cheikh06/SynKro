"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, mounted, toggleTheme } = useTheme();
  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      data-sk-theme={mounted ? theme : undefined}
      aria-label={
        mounted
          ? isDark
            ? "Activer le thème clair"
            : "Activer le thème sombre"
          : "Basculer entre le thème clair et le thème sombre"
      }
      aria-pressed={mounted ? isDark : undefined}
      title={
        mounted
          ? isDark
            ? "Passer au thème clair"
            : "Passer au thème sombre"
          : "Changer de thème"
      }
      className="group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-all duration-200 hover:border-[var(--primary-subtle-border)] hover:bg-[var(--surface-secondary)] active:scale-95"
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <Sun
          aria-hidden="true"
          className="sk-theme-icon sk-theme-sun absolute h-4 w-4 transition-transform duration-300 group-hover:rotate-12"
        />
        <Moon
          aria-hidden="true"
          className="sk-theme-icon sk-theme-moon absolute h-4 w-4 transition-transform duration-300 group-hover:-rotate-12"
        />
      </span>
    </button>
  );
}
