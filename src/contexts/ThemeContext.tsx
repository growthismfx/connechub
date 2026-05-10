import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeId = "default" | "ios" | "glass" | "samsung" | "midnight";

export const THEMES: { id: ThemeId; name: string; description: string; preview: string }[] = [
  { id: "default", name: "Sunrise", description: "Soft cream and peach default", preview: "linear-gradient(135deg,#ffe5c4,#fbc4d4)" },
  { id: "ios", name: "iOS", description: "Clean Apple-style light UI", preview: "linear-gradient(135deg,#f7f7fa,#e3eaf5)" },
  { id: "glass", name: "Crystal Glass", description: "Frosted blur with subtle tint", preview: "linear-gradient(135deg,rgba(180,210,255,.6),rgba(255,180,220,.5))" },
  { id: "samsung", name: "Samsung One", description: "Bold colours, rounded surfaces", preview: "linear-gradient(135deg,#1a73e8,#7b61ff)" },
  { id: "midnight", name: "Midnight", description: "Deep dark with neon accents", preview: "linear-gradient(135deg,#0f172a,#312e81)" },
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
