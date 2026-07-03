import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeId = "default" | "ios" | "glass" | "samsung" | "midnight" | "neon" | "material" | "gradient";

export const THEMES: { id: ThemeId; name: string; description: string; preview: string; dark?: boolean }[] = [
  { id: "default", name: "Sunrise", description: "Soft cream and peach", preview: "linear-gradient(135deg,#ffe5c4,#fbc4d4)" },
  { id: "ios", name: "iOS", description: "Clean Apple-style", preview: "linear-gradient(135deg,#f7f7fa,#e3eaf5)" },
  { id: "glass", name: "Crystal Glass", description: "Frosted blur", preview: "linear-gradient(135deg,rgba(180,210,255,.6),rgba(255,180,220,.5))" },
  { id: "samsung", name: "Samsung One", description: "Bold rounded", preview: "linear-gradient(135deg,#1a73e8,#7b61ff)", dark: true },
  { id: "midnight", name: "Midnight", description: "Deep dark neon", preview: "linear-gradient(135deg,#0f172a,#312e81)", dark: true },
  { id: "neon", name: "Neon", description: "Cyberpunk glow", preview: "linear-gradient(135deg,#ff00cc,#3333ff)", dark: true },
  { id: "material", name: "Material You", description: "Google Material 3", preview: "linear-gradient(135deg,#6750a4,#eaddff)" },
  { id: "gradient", name: "Aurora", description: "Vibrant gradient", preview: "linear-gradient(135deg,#fbc2eb,#a6c1ee,#84fab0)" },
];

type Ctx = { theme: ThemeId; setTheme: (t: ThemeId) => void };
const ThemeCtx = createContext<Ctx>({ theme: "default", setTheme: () => {} });

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    return (localStorage.getItem("app-theme") as ThemeId) || "default";
  });

  useEffect(() => {
    const root = document.documentElement;
    THEMES.forEach((t) => root.classList.remove(`theme-${t.id}`));
    root.classList.add(`theme-${theme}`);
    localStorage.setItem("app-theme", theme);
  }, [theme]);

  return <ThemeCtx.Provider value={{ theme, setTheme: setThemeState }}>{children}</ThemeCtx.Provider>;
};

export const useTheme = () => useContext(ThemeCtx);
