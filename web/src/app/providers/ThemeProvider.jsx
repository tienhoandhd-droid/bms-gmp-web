// ThemeProvider.jsx — chọn giao diện Hệ thống / Sáng / Tối (G2 17/08/2026).
// data-theme gắn trên <html>; token đọc từ theme/tokens.css. Lưu localStorage.
import React from "react";

const STORAGE_KEY = "bms-theme";
const ThemeContext = React.createContext({ preference: "system", setPreference: () => {} });

function resolveTheme(preference) {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = React.useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || "system"; } catch { return "system"; }
  });
  React.useEffect(() => {
    const apply = () => { document.documentElement.dataset.theme = resolveTheme(preference); };
    apply();
    try { localStorage.setItem(STORAGE_KEY, preference); } catch { /* riêng tư/Safari private — bỏ qua */ }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [preference]);
  const value = React.useMemo(() => ({ preference, setPreference }), [preference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return React.useContext(ThemeContext); }
