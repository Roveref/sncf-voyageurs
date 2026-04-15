/**
 * NeedSlotRow — Single slot row for StaffingNeedsPiP.
 * Displays need (left) and assignment (right) with drag-and-drop.
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { alpha, useTheme } from "@mui/material/styles";
import type { GradeColor } from "../../constants";

const EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
const fmt = (d: string) => {
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return "?";
  }
};
const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

interface Slot {
  needId: string;
  slotIndex: number;
  grade: string;
  gradeAbbr: string;
  opportunityId: string;
  oppLabel: string;
  startDate: string;
  endDate: string;
  probability: number | null;
  assignedEmpId: string | null;
  assignedName: string | null;
  overrideKey: string | null;
}

interface NeedSlotRowProps {
  slot: Slot;
  gc: GradeColor;
  gradeAbbr: string;
  isScenarioActive: boolean;
  dropTarget: string | null;
  accent: string;
  onNeedDragStart: (e: React.DragEvent, slot: Slot) => void;
  onAssignmentDragStart: (e: React.DragEvent, slot: Slot) => void;
  onSlotDragOver: (e: React.DragEvent, slotKey: string) => void;
  onSlotDragLeave: (e: React.DragEvent) => void;
  onDropOnSlot: (e: React.DragEvent, slot: Slot) => void;
  onStartEdit: (needId: string) => void;
}

const NeedSlotRow = memo(
  ({
    slot,
    gc,
    gradeAbbr,
    isScenarioActive,
    dropTarget,
    accent,
    onNeedDragStart,
    onAssignmentDragStart,
    onSlotDragOver,
    onSlotDragLeave,
    onDropOnSlot,
    onStartEdit,
  }: NeedSlotRowProps) => {
    const theme = useTheme();
    const success = theme.palette.success.main;
    const slotKey = `${slot.needId}_${slot.slotIndex}`;
    const isOver = dropTarget === slotKey;
    const isAssigned = !!slot.assignedName;

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "stretch",
          gap: 1,
          mx: 0.5,
          my: 0.25,
          borderRadius: 2,
          bgcolor: isOver ? alpha(accent, 0.04) : "transparent",
          transition: `background 0.15s ${EASING}`,
          "&:hover .edit-btn": { opacity: 0.5 },
        }}
      >
        {/* LEFT: Need */}
        <Box
          draggable={isScenarioActive && !isAssigned}
          onDragStart={(e) => onNeedDragStart(e, slot)}
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 0.75,
            py: 0.5,
            borderRadius: 1.5,
            bgcolor: alpha(gc.bg, 0.6),
            cursor: isScenarioActive && !isAssigned ? "grab" : "default",
            transition: `transform 0.15s ${EASING}, box-shadow 0.15s ${EASING}`,
            "&:hover":
              isScenarioActive && !isAssigned
                ? { transform: "translateY(-1px)", boxShadow: `0 2px 6px ${alpha("#000", 0.05)}` }
                : {},
            minHeight: 36,
          }}
        >
          <Avatar
            sx={{
              width: 24,
              height: 24,
              fontSize: "0.55rem",
              fontWeight: 800,
              bgcolor: gc.border,
              color: "#fff",
              borderRadius: 1,
            }}
          >
            {gradeAbbr}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: "text.primary", lineHeight: 1.2 }} noWrap>
              {slot.oppLabel}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {(slot.startDate || slot.endDate) && (
                <Typography sx={{ fontSize: "0.55rem", color: "text.disabled" }}>
                  {slot.startDate ? fmt(slot.startDate) : "?"} &ndash; {slot.endDate ? fmt(slot.endDate) : "?"}
                </Typography>
              )}
              {slot.probability != null && slot.probability < 1 && (
                <Typography sx={{ fontSize: "0.52rem", fontWeight: 600, color: "#d97706" }}>
                  {Math.round(slot.probability * 100)}%
                </Typography>
              )}
            </Box>
          </Box>
          {slot.slotIndex === 0 && (
            <IconButton
              className="edit-btn"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit(slot.needId);
              }}
              sx={{ p: 0.125, color: "text.disabled", opacity: 0, "&:hover": { opacity: 1, color: accent } }}
            >
              <EditIcon sx={{ fontSize: 12 }} />
            </IconButton>
          )}
        </Box>

        {/* CENTER */}
        <Box sx={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Box
            sx={{
              width: 14,
              height: 2,
              borderRadius: 1,
              bgcolor: isAssigned ? alpha(success, 0.5) : alpha(theme.palette.text.disabled, 0.12),
            }}
          />
        </Box>

        {/* RIGHT: Assignment */}
        <Box
          draggable={isScenarioActive && isAssigned}
          onDragStart={(e) => onAssignmentDragStart(e, slot)}
          onDragOver={(e) => onSlotDragOver(e, slotKey)}
          onDragLeave={onSlotDragLeave}
          onDrop={(e) => onDropOnSlot(e, slot)}
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 0.75,
            py: 0.5,
            borderRadius: 1.5,
            minHeight: 36,
            bgcolor: isAssigned ? alpha(success, 0.04) : isOver ? alpha(accent, 0.05) : "transparent",
            border: isAssigned
              ? `1px solid ${alpha(success, 0.12)}`
              : `1.5px dashed ${isOver ? accent : alpha(theme.palette.text.disabled, 0.12)}`,
            cursor: isAssigned && isScenarioActive ? "grab" : "default",
            transition: `transform 0.15s ${EASING}, box-shadow 0.15s ${EASING}, background-color 0.15s ${EASING}, border-color 0.15s ${EASING}`,
            "&:hover":
              isAssigned && isScenarioActive
                ? { transform: "translateY(-1px)", boxShadow: `0 2px 6px ${alpha("#000", 0.05)}` }
                : {},
          }}
        >
          {isAssigned ? (
            <>
              <Avatar
                sx={{
                  width: 24,
                  height: 24,
                  fontSize: "0.55rem",
                  fontWeight: 700,
                  bgcolor: alpha(success, 0.12),
                  color: success,
                }}
              >
                {initials(slot.assignedName!)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: "text.primary", lineHeight: 1.2 }} noWrap>
                  {slot.assignedName}
                </Typography>
                <Typography sx={{ fontSize: "0.55rem", color: "text.disabled" }}>&rarr; {slot.oppLabel}</Typography>
              </Box>
              {isScenarioActive && (
                <SwapHorizIcon sx={{ fontSize: 12, color: "text.disabled", opacity: 0.3, flexShrink: 0 }} />
              )}
            </>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: "100%", justifyContent: "center" }}>
              <PersonAddIcon
                sx={{ fontSize: 14, color: isOver ? accent : "text.disabled", opacity: isOver ? 0.7 : 0.25 }}
              />
              <Typography
                sx={{
                  fontSize: "0.62rem",
                  color: isOver ? accent : "text.disabled",
                  fontWeight: isOver ? 600 : 400,
                  fontStyle: isOver ? "normal" : "italic",
                }}
              >
                {isOver ? "Drop" : "Drag here"}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    );
  }
);

NeedSlotRow.displayName = "NeedSlotRow";

export default NeedSlotRow;
