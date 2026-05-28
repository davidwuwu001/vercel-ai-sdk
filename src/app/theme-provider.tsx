"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ThemeMode = "night" | "day";

type ThemeContextValue = {
  theme: ThemeMode;
  toggleTheme: () => void;
};

const THEME_STORAGE_KEY = "neon-agent-lab:theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Always start with "night" on both server and client to avoid hydration mismatch
  const [theme, setTheme] = useState<ThemeMode>("night");

  // Load theme from localStorage after mount and update DOM
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const effectiveTheme = stored === "day" || stored === "night" ? stored : "night";
    document.documentElement.dataset.theme = effectiveTheme;
    // Only sync state if theme differs from initial to minimize re-renders
    if (effectiveTheme !== "night") {
      setTheme(effectiveTheme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: this effect should only run once on mount
  }, []);

  const toggleTheme = useMemo(
    () => () => {
      setTheme((current) => {
        const next = current === "day" ? "night" : "day";
        document.documentElement.dataset.theme = next;
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
        return next;
      });
    },
    []
  );

  const value = useMemo(
    () => ({ theme, toggleTheme }),
    [theme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
