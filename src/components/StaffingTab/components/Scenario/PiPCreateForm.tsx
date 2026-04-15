/**
 * PiPCreateForm — Inline need creation form for StaffingNeedsPiP.
 */

import React, { memo, useState, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Collapse from "@mui/material/Collapse";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { alpha, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { GRADE_ORDER } from "../../constants";
import { useUserDataStore } from "../../../../stores/useUserDataStore";

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const EASING = "cubic-bezier(0.23, 1, 0.32, 1)";

interface PiPCreateFormProps {
  search: string;
  onSearchChange: (v: string) => void;
  pipelineJobcodes: Map<string, any> | null;
  accent: string;
}

const PiPCreateForm = memo(({ search, onSearchChange, pipelineJobcodes, accent }: PiPCreateFormProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const success = theme.palette.success.main;

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    grade: "",
    quantity: 1,
    startDate: "",
    endDate: "",
    probability: 1,
    opportunityId: "",
  });

  const pipelineOptions = useMemo(() => {
    if (!pipelineJobcodes) return [];
    const opts: { id: string; label: string }[] = [];
    const seen = new Set<string>();
    pipelineJobcodes.forEach((v, k) => {
      if (!seen.has(k)) {
        seen.add(k);
        opts.push({ id: k, label: v.opportunityName || k });
      }
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [pipelineJobcodes]);

  const saveCreate = useCallback(() => {
    if (!createForm.grade || !createForm.opportunityId) return;
    const newNeed: any = {
      id: generateId(),
      opportunityId: createForm.opportunityId,
      grade: createForm.grade,
      quantity: createForm.quantity,
      utilization: 1,
      startDate: createForm.startDate || null,
      endDate: createForm.endDate || null,
      skills: [],
      probability: createForm.probability,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ds = useUserDataStore.getState();
    const existing = [...(ds.staffingNeeds[createForm.opportunityId] || [])];
    existing.push(newNeed);
    ds.setStaffingNeeds(createForm.opportunityId, existing);
    setCreateForm({ grade: "", quantity: 1, startDate: "", endDate: "", probability: 1, opportunityId: "" });
    setShowCreate(false);
  }, [createForm]);

  return (
    <>
      {/* Search + Create button */}
      <Box sx={{ display: "flex", gap: 0.75, px: 1.5, py: 0.75, flexShrink: 0, alignItems: "center" }}>
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1,
            py: 0.375,
            borderRadius: 2,
            bgcolor: isDark ? alpha("#fff", 0.04) : "#f3f4f6",
            "&:focus-within": { boxShadow: `0 0 0 2px ${alpha(accent, 0.15)}` },
            transition: `box-shadow 0.2s ${EASING}`,
          }}
        >
          <SearchIcon sx={{ fontSize: 15, color: "text.disabled" }} />
          <TextField
            size="small"
            variant="standard"
            placeholder="Search..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            fullWidth
            InputProps={{ disableUnderline: true, sx: { fontSize: "0.75rem", height: 26 } }}
          />
        </Box>
        <Tooltip title="Create a need" arrow>
          <IconButton
            size="small"
            onClick={() => setShowCreate((v) => !v)}
            sx={{
              p: 0.5,
              color: showCreate ? accent : "text.disabled",
              bgcolor: showCreate ? alpha(accent, 0.08) : "transparent",
              "&:hover": { bgcolor: alpha(accent, 0.1) },
            }}
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Create need form */}
      <Collapse in={showCreate} timeout={200}>
        <Box sx={{ px: 1.5, pb: 1 }}>
          <Box
            sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(accent, 0.03), border: `1px solid ${alpha(accent, 0.08)}` }}
          >
            <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: accent, mb: 0.75 }}>New need</Typography>
            <Box sx={{ display: "flex", gap: 0.75, mb: 0.75 }}>
              <Select
                size="small"
                value={createForm.opportunityId}
                onChange={(e) => setCreateForm((f) => ({ ...f, opportunityId: e.target.value as string }))}
                displayEmpty
                sx={{ flex: 2, fontSize: "0.72rem", "& .MuiSelect-select": { py: 0.5 } }}
              >
                <MenuItem value="" disabled sx={{ fontSize: "0.72rem" }}>
                  Opportunity...
                </MenuItem>
                {pipelineOptions.map((o) => (
                  <MenuItem key={o.id} value={o.id} sx={{ fontSize: "0.72rem" }}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
              <Select
                size="small"
                value={createForm.grade}
                onChange={(e) => setCreateForm((f) => ({ ...f, grade: e.target.value as string }))}
                displayEmpty
                sx={{ flex: 1.5, fontSize: "0.72rem", "& .MuiSelect-select": { py: 0.5 } }}
              >
                <MenuItem value="" disabled sx={{ fontSize: "0.72rem" }}>
                  Grade...
                </MenuItem>
                {[...GRADE_ORDER].reverse().map((g) => (
                  <MenuItem key={g} value={g} sx={{ fontSize: "0.72rem" }}>
                    {g}
                  </MenuItem>
                ))}
              </Select>
              <TextField
                size="small"
                type="number"
                value={createForm.quantity}
                onChange={(e) => setCreateForm((f) => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                sx={{ width: 48, "& input": { py: 0.5, fontSize: "0.72rem", textAlign: "center" } }}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
              <TextField
                size="small"
                type="date"
                label="Start"
                value={createForm.startDate}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                sx={{ flex: 1, "& input": { py: 0.5, fontSize: "0.68rem" } }}
              />
              <TextField
                size="small"
                type="date"
                label="End"
                value={createForm.endDate}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                sx={{ flex: 1, "& input": { py: 0.5, fontSize: "0.68rem" } }}
              />
              <IconButton
                size="small"
                onClick={saveCreate}
                disabled={!createForm.grade || !createForm.opportunityId}
                sx={{ color: success, "&.Mui-disabled": { color: "text.disabled" } }}
              >
                <CheckIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" onClick={() => setShowCreate(false)} sx={{ color: "text.disabled" }}>
                <CloseIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Collapse>
    </>
  );
});

PiPCreateForm.displayName = "PiPCreateForm";

export default PiPCreateForm;
