/**
 * AddedNeedsList — Shows existing persisted needs AND staged new needs.
 * Existing needs are clickable to edit, staged needs have edit/remove.
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { getGradeColor, getGradeAbbr } from "../../StaffingTab/constants";
import { computeWorkingDays } from "../staffingNeedUtils";
import type { StagedNeed } from "./types";
import type { StaffingNeedItem } from "../../../types/actions";

interface AddedNeedsListProps {
  existingNeeds: StaffingNeedItem[];
  stagedNeeds: StagedNeed[];
  editingNeedId: string | null;
  editingExistingNeedId: string | null;
  lastAddedId: string | null;
  onEditStaged: (need: StagedNeed) => void;
  onRemoveStaged: (id: string) => void;
  onEditExisting: (need: StaffingNeedItem) => void;
  onDeleteExisting: (id: string) => void;
}

const fmtDate = (d: string) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "";

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  open: { bg: "rgba(59,130,246,0.1)", color: "#1d4ed8", label: "Open" },
  partiallyFilled: { bg: "rgba(245,158,11,0.1)", color: "#b45309", label: "Partial" },
  filled: { bg: "rgba(16,185,129,0.1)", color: "#047857", label: "Filled" },
  cancelled: { bg: "rgba(156,163,175,0.1)", color: "#6b7280", label: "Cancelled" },
};

const AddedNeedsList = memo(
  ({
    existingNeeds,
    stagedNeeds,
    editingNeedId,
    editingExistingNeedId,
    lastAddedId,
    onEditStaged,
    onRemoveStaged,
    onEditExisting,
    onDeleteExisting,
  }: AddedNeedsListProps) => {
    const theme = useTheme();
    const totalCount = existingNeeds.length + stagedNeeds.length;

    const renderNeedRow = (
      id: string,
      grade: string,
      startDate: string,
      endDate: string,
      utilization: number,
      quantity: number | undefined,
      status: string | undefined,
      assignedTo: string | undefined,
      isExisting: boolean,
      isEditingThis: boolean,
      isFlash: boolean,
      onClick: () => void,
      onDelete?: () => void
    ) => {
      const gc = getGradeColor(grade);
      const wd = startDate && endDate ? computeWorkingDays(startDate, endDate) : 0;
      const qty = quantity || 1;
      const statusInfo = STATUS_COLORS[status || "open"] || STATUS_COLORS.open;

      return (
        <Box
          key={id}
          onClick={onClick}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            py: 0.75,
            px: 1.25,
            bgcolor: isEditingThis ? alpha(gc.bg, 0.45) : "background.default",
            borderRadius: 2,
            cursor: "pointer",
            border: isEditingThis ? `1.5px solid ${gc.border}` : "1.5px solid transparent",
            transition: "all 0.15s ease",
            "&:hover": { bgcolor: alpha(gc.bg, 0.3) },
            ...(isFlash && {
              animation: "flashGlow 0.7s ease",
              "@keyframes flashGlow": {
                "0%, 100%": { boxShadow: "none" },
                "50%": { boxShadow: `0 0 12px ${alpha(theme.palette.success.main, 0.5)}` },
              },
            }),
          }}
        >
          {/* Grade */}
          <Chip
            label={getGradeAbbr(grade)}
            size="small"
            sx={{ height: 22, fontSize: "0.65rem", fontWeight: 700, bgcolor: gc.bg, color: gc.text, flexShrink: 0 }}
          />

          {/* Quantity */}
          {qty > 1 && (
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: gc.text, flexShrink: 0 }}>
              {qty}&times;
            </Typography>
          )}

          {/* Assigned person */}
          {assignedTo && (
            <Typography
              sx={{
                fontSize: "0.68rem",
                fontWeight: 600,
                color: "text.primary",
                flexShrink: 0,
                maxWidth: 90,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {assignedTo}
            </Typography>
          )}

          {/* Dates */}
          <Typography
            sx={{
              fontSize: "0.72rem",
              color: "text.secondary",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fmtDate(startDate)} &ndash; {fmtDate(endDate)}
            {wd > 0 && <> &middot; {wd}d</>}
          </Typography>

          {/* Utilization */}
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "text.secondary", flexShrink: 0 }}>
            {Math.round(utilization)}%
          </Typography>

          {/* Status badge (existing only) */}
          {isExisting && status && (
            <Chip
              label={statusInfo.label}
              size="small"
              sx={{ height: 18, fontSize: "0.52rem", fontWeight: 600, bgcolor: statusInfo.bg, color: statusInfo.color }}
            />
          )}

          {/* New badge (staged only) */}
          {!isExisting && (
            <Chip
              label="New"
              size="small"
              sx={{
                height: 18,
                fontSize: "0.52rem",
                fontWeight: 600,
                bgcolor: alpha(theme.palette.success.main, 0.1),
                color: theme.palette.success.dark,
              }}
            />
          )}

          {/* Edit indicator */}
          {isEditingThis && <EditIcon sx={{ fontSize: 13, color: gc.text, flexShrink: 0 }} />}

          {/* Delete/remove */}
          {onDelete && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              sx={{
                width: 22,
                height: 22,
                flexShrink: 0,
                color: "text.disabled",
                "&:hover": { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.08) },
              }}
            >
              <CloseIcon sx={{ fontSize: 13 }} />
            </IconButton>
          )}
        </Box>
      );
    };

    return (
      <Box
        sx={{
          bgcolor: "background.paper",
          borderRadius: 2.5,
          p: 2,
          flexShrink: 0,
          maxHeight: 200,
          overflow: "auto",
          scrollbarWidth: "thin",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography
            variant="overline"
            sx={{ fontSize: "0.65rem", fontWeight: 700, color: "text.secondary", letterSpacing: 0.8 }}
          >
            Staffing needs
          </Typography>
          {totalCount > 0 && (
            <Chip
              label={totalCount}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.65rem",
                fontWeight: 700,
                bgcolor: alpha(theme.palette.info.main, 0.1),
                color: theme.palette.info.main,
              }}
            />
          )}
        </Box>

        {totalCount === 0 ? (
          <Box sx={{ py: 2.5, textAlign: "center", borderRadius: 2, bgcolor: "background.default" }}>
            <Typography sx={{ fontSize: "0.78rem", color: "text.disabled" }}>Aucun besoin pour le moment</Typography>
            <Typography sx={{ fontSize: "0.68rem", color: "text.disabled", mt: 0.25 }}>
              Remplissez le formulaire puis cliquez sur « + Ajouter »
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {/* Existing persisted needs */}
            {existingNeeds.length > 0 && (
              <>
                {existingNeeds.map((need) =>
                  renderNeedRow(
                    need.id,
                    need.grade || "",
                    need.startDate || "",
                    need.endDate || "",
                    need.utilization ?? 100,
                    need.quantity,
                    need.status,
                    need.assignedTo || undefined,
                    true,
                    editingExistingNeedId === need.id,
                    false,
                    () => onEditExisting(need),
                    () => onDeleteExisting(need.id)
                  )
                )}
                {stagedNeeds.length > 0 && (
                  <Divider sx={{ my: 0.5 }}>
                    <Typography
                      sx={{
                        fontSize: "0.55rem",
                        fontWeight: 600,
                        color: "text.disabled",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      New
                    </Typography>
                  </Divider>
                )}
              </>
            )}

            {/* Staged new needs */}
            {stagedNeeds.map((need) =>
              renderNeedRow(
                need.id,
                need.grade,
                need.startDate,
                need.endDate,
                need.utilization,
                need.quantity,
                undefined,
                need.preferredPerson || undefined,
                false,
                editingNeedId === need.id,
                lastAddedId === need.id,
                () => onEditStaged(need),
                () => onRemoveStaged(need.id)
              )
            )}
          </Box>
        )}
      </Box>
    );
  }
);

AddedNeedsList.displayName = "AddedNeedsList";
export default AddedNeedsList;
