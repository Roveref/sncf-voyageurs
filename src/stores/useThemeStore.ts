import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface ThemeState {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  devtools(
    (set) => ({
      darkMode: localStorage.getItem("darkMode") === "true",
      toggleDarkMode: () => {
        set((s) => {
          const next = !s.darkMode;
          localStorage.setItem("darkMode", String(next));
          return { darkMode: next };
        });
      },
    }),
    { name: "ThemeStore" }
  )
);
