import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { resetAllStores } from "./helpers";

interface AuthUser {
  username: string;
  displayName: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      token: localStorage.getItem("jwt"),
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem("jwt", token);
        set({ token, user });
      },
      logout: () => {
        localStorage.removeItem("jwt");
        set({ token: null, user: null });
        resetAllStores();
      },
    }),
    { name: "AuthStore" }
  )
);
