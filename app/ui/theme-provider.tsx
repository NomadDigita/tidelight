"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

export type Theme = "daylight" | "night" | "blue";
const themes: { id: Theme; name: string; detail: string; swatches: string[] }[] = [
  { id: "daylight", name: "Daylight", detail: "Warm paper, clear ink", swatches: ["#f5f3eb", "#18382f", "#76ae88"] },
  { id: "night", name: "Night Tide", detail: "The original deep sea", swatches: ["#080f11", "#a8ebc8", "#142522"] },
  { id: "blue", name: "Blue Hour", detail: "A cooler evening desk", swatches: ["#0b1020", "#b6c5ff", "#222b4c"] },
];
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({ theme: "night", setTheme: () => {} });
const getTheme = (): Theme => {
  const saved = window.localStorage.getItem("tidelight-theme");
  return saved === "daylight" || saved === "blue" ? saved : "night";
};
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("tidelight-theme-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("tidelight-theme-change", callback); };
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getTheme, (): Theme => "night");
  const setTheme = (next: Theme) => {
    window.localStorage.setItem("tidelight-theme", next);
    window.dispatchEvent(new Event("tidelight-theme-change"));
  };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "daylight" ? "light" : "dark";
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function ThemePicker() {
  const { theme, setTheme } = useContext(ThemeContext);
  return <fieldset className="theme-picker">
    <legend className="sr-only">Choose a color theme</legend>
    {themes.map((option) => <button type="button" key={option.id} className={`theme-option${theme === option.id ? " selected" : ""}`} aria-pressed={theme === option.id} onClick={() => setTheme(option.id)}>
      <span className="theme-swatches" aria-hidden="true">{option.swatches.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>
      <span className="theme-option-copy"><b>{option.name}</b><small>{option.detail}</small></span>
      <span className="theme-check" aria-hidden="true">{theme === option.id ? "✓" : ""}</span>
    </button>)}
  </fieldset>;
}
