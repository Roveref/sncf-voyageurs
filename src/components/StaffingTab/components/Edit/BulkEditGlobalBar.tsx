import React, { memo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import { brand } from "../../../../config/brandConfig";
import { barSx, barBtnInactive, barBtnAccent, BAR_GAP } from "./bulkEditTypes";
import type { EditAction } from "./bulkEditTypes";

// ── BulkEditGlobalBar ──

export interface BulkEditGlobalBarProps {
  effectiveLeft: number;
  readOnly: boolean;
  revertAllPreview: boolean;
  onToggleRevertAll: () => void;
  actionLog: EditAction[];
  redoStack: EditAction[];
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
  onApply: () => void;
  applyDisabled: boolean;
}

/** Describe an edit action for the undo/redo tooltip */
function describeAction(a: EditAction): string {
  const name = a.groupKey.split("::")[0] || "assignment";
  const dates =
    a.produced.length > 0 ? `${a.produced[0].startDate} -> ${a.produced[a.produced.length - 1].endDate}` : "";
  const utilInfo = a.produced.length > 0 ? ` ${a.produced[0].utilization}%` : "";
  const labels: Record<string, string> = {
    create: "Create",
    delete: "Delete",
    split_delete: "Truncate",
    reduce_util: "Adjust %",
    reduce_days: "Reduce days",
    reduce_util_multi: "Adjust %",
    update_field: "Edit",
  };
  return `${labels[a.type] || a.type} ${name}${dates ? ` (${dates}${utilInfo})` : ""}`;
}

export const BulkEditGlobalBar = memo(
  ({
    effectiveLeft,
    readOnly,
    revertAllPreview,
    onToggleRevertAll,
    actionLog,
    redoStack,
    onUndo,
    onRedo,
    onClose,
    onApply,
    applyDisabled,
  }: BulkEditGlobalBarProps) => {
    const [undoRedoHover, setUndoRedoHover] = useState<"undo" | "redo" | null>(null);

    const handleMouseLeave = useCallback(() => setUndoRedoHover(null), []);
    const handleUndoHover = useCallback(() => setUndoRedoHover("undo"), []);
    const handleRedoHover = useCallback(() => setUndoRedoHover("redo"), []);

    const lastAction = actionLog.length > 0 ? actionLog[actionLog.length - 1] : null;
    const nextRedo = redoStack.length > 0 ? redoStack[redoStack.length - 1] : null;
    const undoCount = actionLog.length;
    const redoCount = redoStack.length;

    return (
      <Box sx={barSx}>
        {/* Left col -- same width as assignment info in edit ToolBar */}
        <Box sx={{ flexShrink: 0, px: 1.25, display: "flex", alignItems: "center" }} style={{ width: effectiveLeft }} />
        {/* Right col -- actions + cancel/apply, same position as edit ToolBar */}
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: `${BAR_GAP}px`, minWidth: 0, pr: 1.5 }}>
          {/* Revert All toggle + Undo/Redo (hidden in readOnly) */}
          {!readOnly && (
            <>
              <Button
                size="small"
                onClick={onToggleRevertAll}
                sx={{
                  ...barBtnInactive,
                  fontWeight: 600,
                  ...(revertAllPreview
                    ? { bgcolor: brand.primaryDark, color: "#fff", "&:hover": { bgcolor: "#b91c1c" } }
                    : { color: brand.primaryDark, "&:hover": { bgcolor: "#fef2f2" } }),
                }}
              >
                Revert All
              </Button>

              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

              {/* Undo / Redo with description */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }} onMouseLeave={handleMouseLeave}>
                <Box onMouseEnter={handleUndoHover}>
                  <IconButton
                    size="small"
                    aria-label="Undo last change"
                    disabled={!lastAction}
                    onClick={onUndo}
                    sx={{ p: 0.5, color: "text.secondary", "&.Mui-disabled": { color: "text.disabled" } }}
                  >
                    <UndoIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
                <Box onMouseEnter={handleRedoHover}>
                  <IconButton
                    size="small"
                    aria-label="Redo last change"
                    disabled={!nextRedo}
                    onClick={onRedo}
                    sx={{ p: 0.5, color: "text.secondary", "&.Mui-disabled": { color: "text.disabled" } }}
                  >
                    <RedoIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
                {undoRedoHover === "undo" && lastAction && (
                  <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", whiteSpace: "nowrap" }}>
                    Undo ({undoCount}): {describeAction(lastAction)}
                  </Typography>
                )}
                {undoRedoHover === "redo" && nextRedo && (
                  <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", whiteSpace: "nowrap" }}>
                    Redo ({redoCount}): {describeAction(nextRedo)}
                  </Typography>
                )}
              </Box>
            </>
          )}

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Cancel & Apply (hidden in readOnly) */}
          {!readOnly && (
            <>
              <Button size="small" onClick={onClose} sx={barBtnInactive}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={applyDisabled}
                onClick={onApply}
                sx={{
                  ...barBtnAccent(true),
                  "&.Mui-disabled": { bgcolor: brand.secondaryLightest, color: brand.secondaryLight },
                }}
              >
                Apply
              </Button>
            </>
          )}
        </Box>
      </Box>
    );
  }
);
BulkEditGlobalBar.displayName = "BulkEditGlobalBar";
