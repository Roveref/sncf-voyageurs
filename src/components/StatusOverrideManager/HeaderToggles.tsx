/**
 * HeaderToggles — Inc/Exc Changes switch
 * Rendered in the header bar outside the management dialog.
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { brand } from "../../config/brandConfig";

interface HeaderTogglesProps {
  modificationsEnabled: "off" | "all" | "changes";
  onToggleModifications?: (next: string) => void;
  onOpenDialog: () => void;
}

const HeaderToggles = memo(({ modificationsEnabled, onToggleModifications, onOpenDialog }: HeaderTogglesProps) => {
  return (
    <>
      {/* Three-state toggle: off (Exc. Changes) / all (Inc. Changes) / changes (Changes Only) */}
      <Tooltip
        title={
          {
            off: "Changes excluded — source data only",
            all: "Changes included — source data + modifications",
            changes: "Changes only — click label to manage",
          }[modificationsEnabled]
        }
      >
        <FormControlLabel
          control={
            <Switch
              checked={modificationsEnabled !== "off"}
              onChange={() => {
                const next: Record<string, string> = { all: "changes", changes: "off", off: "all" };
                onToggleModifications?.(next[modificationsEnabled]);
              }}
              sx={{
                "& .MuiSwitch-switchBase": {
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                },
                "& .MuiSwitch-switchBase.Mui-checked": {
                  color: modificationsEnabled === "changes" ? "#9575CD" : undefined,
                },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                  backgroundColor: modificationsEnabled === "changes" ? "#7E57C2" : brand.primaryDark,
                },
                "& .MuiSwitch-track": {
                  backgroundColor: "rgba(255,255,255,0.3)",
                  transition: "background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                },
                "& .MuiSwitch-thumb": {
                  transition: "background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                },
              }}
            />
          }
          label={
            <Box
              onClick={(e) => {
                if (modificationsEnabled !== "off") {
                  e.preventDefault();
                  onOpenDialog();
                }
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                cursor: modificationsEnabled !== "off" ? "pointer" : "default",
              }}
            >
              <EditNoteIcon
                sx={{ mr: 0.5, fontSize: 18, color: "white", transition: "color 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
              />
              <Typography variant="body2" fontWeight={500} sx={{ fontSize: "0.8rem", color: "white" }}>
                {{ all: "Inc. Changes", changes: "Changes Only", off: "Exc. Changes" }[modificationsEnabled]}
              </Typography>
            </Box>
          }
          sx={{
            bgcolor: "rgba(255,255,255,0.1)",
            borderRadius: 2,
            px: 1.5,
            py: 0.25,
            "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
          }}
        />
      </Tooltip>
    </>
  );
});

HeaderToggles.displayName = "HeaderToggles";

export default HeaderToggles;
