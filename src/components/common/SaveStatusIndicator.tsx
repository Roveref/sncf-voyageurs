import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import { useLoadingStore } from "../../stores/useLoadingStore";

const SaveStatusIndicator = memo(() => {
  const syncStatus = useLoadingStore((s) => s.syncStatus);
  const lastSavedAt = useLoadingStore((s) => s.lastSavedAt);

  if (syncStatus === "idle") return null;

  const timeAgo = lastSavedAt ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}` : "";

  return (
    <Tooltip title={syncStatus === "error" ? "Failed to save changes" : timeAgo}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1 }}>
        {syncStatus === "saving" && (
          <>
            <CircularProgress size={14} sx={{ color: "rgba(255,255,255,0.7)" }} />
            <Typography variant="body2" sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>
              Saving...
            </Typography>
          </>
        )}
        {syncStatus === "saved" && (
          <>
            <CheckCircleIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }} />
            <Typography variant="body2" sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
              Saved
            </Typography>
          </>
        )}
        {syncStatus === "error" && (
          <>
            <WarningIcon sx={{ fontSize: 16, color: "#ff6b6b" }} />
            <Typography variant="body2" sx={{ fontSize: "0.75rem", color: "#ff6b6b" }}>
              Error
            </Typography>
          </>
        )}
      </Box>
    </Tooltip>
  );
});

SaveStatusIndicator.displayName = "SaveStatusIndicator";

export { SaveStatusIndicator };
