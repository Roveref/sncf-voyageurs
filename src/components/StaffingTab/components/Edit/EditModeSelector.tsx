import { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import UndoIcon from "@mui/icons-material/Undo";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import CompressIcon from "@mui/icons-material/Compress";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import { BAR_GAP, barBtnDanger, barBtnAccent, barLabel, barInputSx } from "./bulkEditTypes";
import { brand } from "../../../../config/brandConfig";
import type { InsertMode } from "./bulkEditTypes";

// ── Edit mode actions (truncate, adjust %, reduce days, revert) ──

interface EditActionsProps {
  isDeleted: boolean;
  pendingAction: "truncate" | "reduce_util" | "reduce_days" | "revert" | "";
  onPendingActionChange: (action: "truncate" | "reduce_util" | "reduce_days" | "revert" | "") => void;
  reduceUtil: number;
  onReduceUtilChange: (val: number) => void;
  reduceDays: number;
  onReduceDaysChange: (val: number) => void;
  workingDays: number;
  onRevert?: () => void;
  onRevertCancel?: () => void;
}

const EditActions = memo(
  ({
    isDeleted,
    pendingAction,
    onPendingActionChange,
    reduceUtil,
    onReduceUtilChange,
    reduceDays,
    onReduceDaysChange,
    workingDays,
    onRevert,
    onRevertCancel,
  }: EditActionsProps) => {
    if (isDeleted) {
      if (!onRevert) return null;
      return (
        <Button
          size="small"
          startIcon={<UndoIcon sx={{ fontSize: 12 }} />}
          onClick={() => {
            const toggling = pendingAction === "revert";
            onPendingActionChange(toggling ? "" : "revert");
            if (!toggling) onRevert();
            else if (onRevertCancel) onRevertCancel();
          }}
          sx={barBtnAccent(pendingAction === "revert")}
        >
          Revert
        </Button>
      );
    }

    return (
      <>
        <Button
          size="small"
          startIcon={<ContentCutIcon sx={{ fontSize: 12 }} />}
          onClick={() => onPendingActionChange(pendingAction === "truncate" ? "" : "truncate")}
          sx={barBtnDanger(pendingAction === "truncate")}
        >
          Truncate
        </Button>
        <Button
          size="small"
          startIcon={<TrendingDownIcon sx={{ fontSize: 12 }} />}
          onClick={() => onPendingActionChange(pendingAction === "reduce_util" ? "" : "reduce_util")}
          sx={barBtnAccent(pendingAction === "reduce_util")}
        >
          Adjust %
        </Button>
        <Button
          size="small"
          startIcon={<CompressIcon sx={{ fontSize: 12 }} />}
          onClick={() => onPendingActionChange(pendingAction === "reduce_days" ? "" : "reduce_days")}
          sx={barBtnAccent(pendingAction === "reduce_days")}
        >
          Reduce days
        </Button>
        {onRevert && (
          <Button
            size="small"
            startIcon={<UndoIcon sx={{ fontSize: 12 }} />}
            onClick={() => {
              const toggling = pendingAction === "revert";
              onPendingActionChange(toggling ? "" : "revert");
              if (!toggling) onRevert();
              else if (onRevertCancel) onRevertCancel();
            }}
            sx={barBtnAccent(pendingAction === "revert")}
          >
            Revert
          </Button>
        )}
        {pendingAction === "reduce_util" && (
          <>
            <Typography sx={barLabel}>Set to</Typography>
            <TextField
              size="small"
              type="number"
              inputProps={{ min: 0, max: 200, step: 5 }}
              value={reduceUtil}
              onChange={(e) => onReduceUtilChange(Number(e.target.value))}
              sx={{ width: 56, ...barInputSx }}
            />
            <Typography sx={barLabel}>%</Typography>
          </>
        )}
        {pendingAction === "reduce_days" && (
          <>
            <Typography sx={barLabel}>Keep</Typography>
            <TextField
              size="small"
              type="number"
              inputProps={{ min: 1, max: workingDays, step: 1 }}
              value={reduceDays}
              onChange={(e) => onReduceDaysChange(Number(e.target.value))}
              sx={{ width: 56, ...barInputSx }}
            />
            <Typography sx={barLabel}>/ {workingDays}d</Typography>
          </>
        )}
      </>
    );
  }
);
EditActions.displayName = "EditActions";

// ── Create mode conflict resolution (fill_extend, fill_truncate, replace, fit_in) ──

interface ConflictModeSelectorProps {
  insertMode: InsertMode;
  onInsertModeChange: (mode: InsertMode) => void;
  fillExtendDisabled: boolean;
  fillTruncDisabled: boolean;
  fitInDisabled: boolean;
}

const modeBtnSx = (active: boolean, disabled?: boolean) => ({
  ...barBtnAccent(active),
  fontSize: "0.65rem",
  ...(disabled
    ? { opacity: 0.35, pointerEvents: "none" as const, color: brand.secondaryLight, bgcolor: "transparent" }
    : {}),
});

const ConflictModeSelector = memo(
  ({
    insertMode,
    onInsertModeChange,
    fillExtendDisabled,
    fillTruncDisabled,
    fitInDisabled,
  }: ConflictModeSelectorProps) => {
    return (
      <>
        <Tooltip
          title={fillExtendDisabled ? "No capacity to extend" : "Extend end date to fit the new assignment"}
          placement="top"
        >
          <span>
            <Button
              size="small"
              disabled={fillExtendDisabled}
              startIcon={<OpenInFullIcon sx={{ fontSize: 12 }} />}
              onClick={() => onInsertModeChange(insertMode === "fill_extend" ? "" : "fill_extend")}
              sx={modeBtnSx(insertMode === "fill_extend", fillExtendDisabled)}
            >
              Fill+Extend
            </Button>
          </span>
        </Tooltip>
        <Tooltip
          title={fillTruncDisabled ? "No capacity after truncation" : "Trim existing assignments to make room"}
          placement="top"
        >
          <span>
            <Button
              size="small"
              disabled={fillTruncDisabled}
              startIcon={<ContentCutIcon sx={{ fontSize: 12 }} />}
              onClick={() => onInsertModeChange(insertMode === "fill_truncate" ? "" : "fill_truncate")}
              sx={modeBtnSx(insertMode === "fill_truncate", fillTruncDisabled)}
            >
              Fill+Truncate
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Delete overlapping assignments entirely" placement="top">
          <Button
            size="small"
            startIcon={<SwapHorizIcon sx={{ fontSize: 12 }} />}
            onClick={() => onInsertModeChange(insertMode === "replace" ? "" : "replace")}
            sx={modeBtnSx(insertMode === "replace")}
          >
            Replace
          </Button>
        </Tooltip>
        <Tooltip
          title={fitInDisabled ? "Cannot fit — total utilization too high" : "Reduce existing utilization to make room"}
          placement="top"
        >
          <span>
            <Button
              size="small"
              disabled={fitInDisabled}
              startIcon={<FitScreenIcon sx={{ fontSize: 12 }} />}
              onClick={() => onInsertModeChange(insertMode === "fit_in" ? "" : "fit_in")}
              sx={modeBtnSx(insertMode === "fit_in", fitInDisabled)}
            >
              Fit in
            </Button>
          </span>
        </Tooltip>
      </>
    );
  }
);
ConflictModeSelector.displayName = "ConflictModeSelector";

// ── Combined EditModeSelector ──

interface EditModeSelectorProps {
  mode: "edit" | "create";
  // Edit mode props
  isDeleted?: boolean;
  pendingAction?: "truncate" | "reduce_util" | "reduce_days" | "revert" | "";
  onPendingActionChange?: (action: "truncate" | "reduce_util" | "reduce_days" | "revert" | "") => void;
  reduceUtil?: number;
  onReduceUtilChange?: (val: number) => void;
  reduceDays?: number;
  onReduceDaysChange?: (val: number) => void;
  workingDays?: number;
  onRevert?: () => void;
  onRevertCancel?: () => void;
  // Create mode props
  insertMode?: InsertMode;
  onInsertModeChange?: (mode: InsertMode) => void;
  fillExtendDisabled?: boolean;
  fillTruncDisabled?: boolean;
  fitInDisabled?: boolean;
}

export const EditModeSelector = memo((props: EditModeSelectorProps) => {
  if (props.mode === "edit") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: `${BAR_GAP}px`, flexShrink: 0 }}>
        <EditActions
          isDeleted={props.isDeleted ?? false}
          pendingAction={props.pendingAction ?? ""}
          onPendingActionChange={props.onPendingActionChange ?? (() => {})}
          reduceUtil={props.reduceUtil ?? 50}
          onReduceUtilChange={props.onReduceUtilChange ?? (() => {})}
          reduceDays={props.reduceDays ?? 5}
          onReduceDaysChange={props.onReduceDaysChange ?? (() => {})}
          workingDays={props.workingDays ?? 0}
          onRevert={props.onRevert}
          onRevertCancel={props.onRevertCancel}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: `${BAR_GAP}px`, flexShrink: 0 }}>
      <ConflictModeSelector
        insertMode={props.insertMode ?? ""}
        onInsertModeChange={props.onInsertModeChange ?? (() => {})}
        fillExtendDisabled={props.fillExtendDisabled ?? false}
        fillTruncDisabled={props.fillTruncDisabled ?? false}
        fitInDisabled={props.fitInDisabled ?? false}
      />
    </Box>
  );
});
EditModeSelector.displayName = "EditModeSelector";
