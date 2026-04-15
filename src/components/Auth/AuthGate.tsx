import { memo, useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuthStore } from "../../stores/useAuthStore";
import LoginPage from "./LoginPage";

const AuthGate = memo(({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const [checking, setChecking] = useState(true);
  const [authDisabled, setAuthDisabled] = useState(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;

    const check = async () => {
      // Wait for backend to be reachable (retry up to 30 times, 2s apart)
      for (let i = 0; i < 30; i++) {
        try {
          const res = await fetch("/api/health");
          if (res.ok) break;
        } catch {
          // Backend not up yet
        }
        if (!activeRef.current) return;
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!activeRef.current) return;

      try {
        // Probe /api/auth/me without token to detect if auth is disabled
        const res = await fetch("/api/auth/me");
        if (!activeRef.current) return;

        if (res.status === 200 || res.status === 503) {
          // Auth disabled (no JWT_SECRET) — backend returns 200 or 503 "not configured"
          setAuthDisabled(true);
          setAuth("none", { username: "dev", displayName: "Developer" });
        } else if (token) {
          // Auth enabled, verify existing token
          const tokenRes = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
          if (tokenRes.ok) {
            const data = await tokenRes.json();
            setAuth(token, data);
          } else {
            logout();
          }
        }
        // No token + auth enabled → LoginPage (handled by render)
      } catch {
        if (token) logout();
      }

      if (activeRef.current) setChecking(false);
    };

    check();
    return () => {
      activeRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    return (
      <Box
        sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#1a0000" }}
      >
        <CircularProgress sx={{ color: "#CC2931" }} />
      </Box>
    );
  }

  if (authDisabled) return <>{children}</>;
  if (!token || !user) return <LoginPage />;

  return <>{children}</>;
});
AuthGate.displayName = "AuthGate";

export default AuthGate;
