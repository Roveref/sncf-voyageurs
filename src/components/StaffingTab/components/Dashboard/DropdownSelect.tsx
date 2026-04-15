import React, { memo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";

// ─── Shared TextField trigger style (Pipeline-aligned) ──────────────────────
export const dropdownFieldSx = {
  cursor: "pointer",
  "& .MuiInputBase-root": {
    minHeight: 48,
    alignItems: "center",
    cursor: "pointer",
    position: "relative",
    paddingRight: "40px",
  },
  "& .MuiInputBase-input": { cursor: "pointer" },
};

// ─── Props ──────────────────────────────────────────────────────────────────
interface DropdownSelectProps {
  label: string;
  options: string[];
  selected: string | string[];
  onChange: (value: string | string[]) => void;
  colorMap?: Record<string, { bg: string; text: string }> | ((opt: string) => { bg: string; text: string });
  labelFn?: (item: string) => string;
}

// ─── Compact multi-select dropdown (Pipeline-style TextField + Chips) ────────
const DropdownSelect = memo(({ label, options, selected, onChange, colorMap, labelFn }: DropdownSelectProps) => {
  const [open, setOpen] = useState(false);
  const arr = Array.isArray(selected) ? selected : selected && selected !== "all" ? [selected] : [];

  const toggle = useCallback(
    (v: string) => {
      const cur = Array.isArray(selected) ? selected : selected && selected !== "all" ? [selected] : [];
      const next = cur.includes(v) ? cur.filter((x: string) => x !== v) : [...cur, v];
      onChange(next.length === 0 ? "all" : next);
    },
    [selected, onChange]
  );

  const handleToggleOpen = useCallback(() => setOpen((prev) => !prev), []);
  const handleCloseBackdrop = useCallback(() => setOpen(false), []);
  const handleSelectAll = useCallback(() => {
    onChange("all");
    setOpen(false);
  }, [onChange]);

  return (
    <Box sx={{ position: "relative", flex: 1 }}>
      <TextField
        fullWidth
        size="small"
        label={label}
        variant="outlined"
        onClick={handleToggleOpen}
        value=""
        InputProps={{
          readOnly: true,
          startAdornment: arr.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
              {arr.map((item: string) => (
                <Chip
                  key={item}
                  label={labelFn ? labelFn(item) : item}
                  size="small"
                  onDelete={(e) => {
                    e.stopPropagation();
                    toggle(item);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  sx={{ cursor: "grab", "&:active": { cursor: "grabbing" } }}
                />
              ))}
            </Box>
          ),
          endAdornment: (
            <InputAdornment position="end" sx={{ position: "absolute", right: 8 }}>
              <ArrowDropDownIcon />
            </InputAdornment>
          ),
        }}
        sx={dropdownFieldSx}
      />
      {open && (
        <>
          <Box sx={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={handleCloseBackdrop} />
          <Paper
            elevation={4}
            sx={{
              position: "absolute",
              top: "100%",
              left: 0,
              mt: 0.5,
              width: 280,
              borderRadius: 3,
              border: 1,
              borderColor: "grey.200",
              py: 0.5,
              zIndex: 20,
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            <Button
              onClick={handleSelectAll}
              fullWidth
              sx={{
                justifyContent: "flex-start",
                px: 1.5,
                py: 1,
                textTransform: "none",
                fontSize: "0.875rem",
                color: "text.primary",
                "&:hover": { bgcolor: "grey.50" },
              }}
            >
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  border: 1,
                  borderRadius: 0.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mr: 1,
                  borderColor: arr.length === 0 ? "primary.main" : "grey.300",
                  bgcolor: arr.length === 0 ? "primary.main" : "transparent",
                }}
              >
                {arr.length === 0 && <CheckIcon sx={{ fontSize: 12, color: "white" }} />}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 500, color: "grey.700" }}>
                All
              </Typography>
            </Button>
            <Divider sx={{ my: 0.25 }} />
            {options.map((opt: string) => {
              const sel = arr.includes(opt);
              const c =
                typeof colorMap === "function" ? colorMap(opt) : colorMap?.[opt] || { bg: "#f3f4f6", text: "#374151" };
              return (
                <Button
                  key={opt}
                  onClick={() => toggle(opt)}
                  fullWidth
                  sx={{
                    justifyContent: "flex-start",
                    px: 1.5,
                    py: 0.75,
                    textTransform: "none",
                    fontSize: "0.875rem",
                    color: "text.primary",
                    "&:hover": { bgcolor: "grey.50" },
                  }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      border: 1,
                      borderRadius: 0.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mr: 1,
                      borderColor: sel ? "primary.main" : "grey.300",
                      bgcolor: sel ? "primary.main" : "transparent",
                    }}
                  >
                    {sel && <CheckIcon sx={{ fontSize: 12, color: "white" }} />}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      bgcolor: c.bg,
                      color: c.text,
                    }}
                  >
                    {labelFn ? labelFn(opt) : opt}
                  </Box>
                </Button>
              );
            })}
          </Paper>
        </>
      )}
    </Box>
  );
});
DropdownSelect.displayName = "DropdownSelect";

export default DropdownSelect;
