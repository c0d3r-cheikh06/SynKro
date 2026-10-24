"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  mounted: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  mounted: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = "synkro-theme";

function applyDomTheme(
  mode: ThemeMode,
  animate: boolean,
  timeoutRef: React.MutableRefObject<number | null>
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (animate) {
    root.classList.add("theme-transition");
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      root.classList.remove("theme-transition");
      timeoutRef.current = null;
    }, 360);
  }

  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  root.setAttribute("data-theme", mode);

  // Clear pre-hydration adopted stylesheet if present
  const win = window as Window & { __synkroPreSheet?: CSSStyleSheet };
  if (win.__synkroPreSheet && document.adoptedStyleSheets) {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== win.__synkroPreSheet
    );
    delete win.__synkroPreSheet;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);
  const transitionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let initial: ThemeMode = "light";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        initial = stored;
      } else if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        initial = "dark";
      }
    } catch {
      initial = "light";
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initial);
    setMounted(true);
    applyDomTheme(initial, false, transitionTimeoutRef);

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === STORAGE_KEY &&
        (event.newValue === "dark" || event.newValue === "light")
      ) {
        setThemeState(event.newValue);
        applyDomTheme(event.newValue, true, transitionTimeoutRef);
      }
    };

    window.addEventListener("storage", handleStorage);
    const timeoutId = transitionTimeoutRef.current;
    return () => {
      window.removeEventListener("storage", handleStorage);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const setTheme = useCallback((nextMode: ThemeMode) => {
    setThemeState(nextMode);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    } catch {
      // Ignore storage quota errors
    }
    applyDomTheme(nextMode, true, transitionTimeoutRef);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage quota errors
      }
      applyDomTheme(next, true, transitionTimeoutRef);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, mounted, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
