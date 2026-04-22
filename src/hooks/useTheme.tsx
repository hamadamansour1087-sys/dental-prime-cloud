import { useEffect, useState, useCallback } from "react";

export type ThemeName = "blueprint" | "cyber";

const STORAGE_KEY = "lab-theme";

function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  root.classList.remove("theme-blueprint", "theme-cyber", "dark");
  if (theme === "cyber") {
    root.classList.add("theme-cyber", "dark");
  } else {
    root.classList.add("theme-blueprint");
  }
}

function getInitialTheme(): ThemeName {
  if (typeof window === "undefined") return "blueprint";
  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeName | null;
  return stored === "cyber" || stored === "blueprint" ? stored : "blueprint";
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const setTheme = useCallback((t: ThemeName) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((p) => (p === "blueprint" ? "cyber" : "blueprint")),
    []
  );

  return { theme, setTheme, toggleTheme };
}
