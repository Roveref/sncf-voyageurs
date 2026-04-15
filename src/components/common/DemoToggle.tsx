/**
 * DemoToggle — Bascule données réelles / données fictives (demo)
 *
 * En mode demo, le backend sert des dummy data depuis dashboard-demo.db.
 */

import { memo, useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { getDemoStatus, activateDemo, deactivateDemo, saveChanges } from "../../services/api";
import { useUserDataStore } from "../../stores/useUserDataStore";
import { queryClient } from "../../queries";

interface DemoToggleProps {
  darkMode?: boolean;
  onModeChange?: (demo: boolean) => void;
}

const DemoToggle = memo(({ darkMode, onModeChange }: DemoToggleProps) => {
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDemoStatus()
      .then((s) => setDemo(s.demo))
      .catch(() => {});
  }, []);

  const handleToggle = useCallback(async () => {
    setLoading(true);
    try {
      if (demo) {
        await deactivateDemo();
        setDemo(false);
        onModeChange?.(false);
      } else {
        // Flush pending sync to real DB before switching to demo DB
        try {
          await saveChanges({});
        } catch {
          /* best effort */
        }
        // Clear editor states so real-data edits don't leak into demo
        useUserDataStore.getState().setEditorStates({});
        await activateDemo();
        setDemo(true);
        onModeChange?.(true);
      }
      // Invalidate all React Query cache so data is refetched from the new DB
      await queryClient.invalidateQueries();
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [demo, onModeChange]);

  const purple = darkMode ? "#ce93d8" : "#9c27b0";
  const muted = darkMode ? "rgba(255,255,255,0.4)" : "text.disabled";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1.5,
        py: 0.25,
        borderRadius: 1.5,
        bgcolor: demo ? (darkMode ? "rgba(156, 39, 176, 0.2)" : "rgba(156, 39, 176, 0.08)") : "transparent",
        transition: "all 0.2s ease",
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          fontSize: "0.8rem",
          color: demo ? purple : muted,
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        Demo
      </Typography>
      <Switch
        size="small"
        checked={demo}
        onChange={handleToggle}
        disabled={loading}
        inputProps={{ "aria-label": "Toggle demo mode" }}
        sx={{
          "& .MuiSwitch-switchBase.Mui-checked": { color: purple },
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: purple },
        }}
      />
    </Box>
  );
});

DemoToggle.displayName = "DemoToggle";

export default DemoToggle;
