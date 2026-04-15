/**
 * GroupSettingsDialog — Modal for choosing grouping mode (none, serviceLine, segment, two-level).
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../common/DialogTransition";
import Divider from "@mui/material/Divider";
import Radio from "@mui/material/Radio";
import { alpha, useTheme } from "@mui/material/styles";

interface GroupSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  groupBy: string;
  onGroupByChange: (value: string) => void;
}

const GROUP_OPTIONS = [
  { value: "none", label: "No grouping", desc: "Flat list of all items" },
  { value: "serviceLine", label: "Service Line", desc: "Group by Service Line 1" },
  { value: "segment", label: "Segment", desc: "Group by Sub Segment Code" },
];

const HIERARCHY_OPTIONS = [
  { value: "slThenSegment", label: "Service Line \u2192 Segment", desc: "Service Line first, then Segment" },
  { value: "segmentThenSl", label: "Segment \u2192 Service Line", desc: "Segment first, then Service Line" },
];

const GroupSettingsDialog = memo(({ open, onClose, groupBy, onGroupByChange }: GroupSettingsDialogProps) => {
  const theme = useTheme();

  const renderOption = (opt: { value: string; label: string; desc: string }) => (
    <Box
      key={opt.value}
      onClick={() => {
        onGroupByChange(opt.value);
        onClose();
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1,
        borderRadius: 1.5,
        cursor: "pointer",
        mb: 0.5,
        border: `2px solid ${groupBy === opt.value ? theme.palette.primary.main : "transparent"}`,
        bgcolor: groupBy === opt.value ? alpha(theme.palette.primary.main, 0.06) : "transparent",
        "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
        transition: "background-color 0.15s, border-color 0.15s",
      }}
    >
      <Radio checked={groupBy === opt.value} size="small" sx={{ p: 0 }} />
      <Box>
        <Typography variant="body2" fontWeight={groupBy === opt.value ? 700 : 500} sx={{ fontSize: "0.85rem" }}>
          {opt.label}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {opt.desc}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={DialogTransition}
      PaperProps={{ sx: { borderRadius: 2.5, p: 2.5, minWidth: 320, maxWidth: 360 } }}
    >
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, px: 0.5 }}>
        Group by
      </Typography>
      {GROUP_OPTIONS.map(renderOption)}
      <Divider sx={{ my: 1 }} />
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, px: 0.5, display: "block" }}>
        Two-level hierarchy
      </Typography>
      {HIERARCHY_OPTIONS.map(renderOption)}
    </Dialog>
  );
});

GroupSettingsDialog.displayName = "GroupSettingsDialog";

export default GroupSettingsDialog;
