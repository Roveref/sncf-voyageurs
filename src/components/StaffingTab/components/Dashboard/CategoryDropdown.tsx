import React, { memo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";
import { CATEGORY_LABELS, CATEGORY_TREE } from "../../constants";
import { CATEGORY_THEME } from "../../constants/theme";
import { dropdownFieldSx } from "./DropdownSelect";

// ─── Props ──────────────────────────────────────────────────────────────────
interface CategoryDropdownProps {
  selected: string | string[];
  onChange: (value: string | string[]) => void;
}

// ─── Hierarchical category dropdown (Pipeline-style TextField + Chips) ──────
const CategoryDropdown = memo(({ selected, onChange }: CategoryDropdownProps) => {
  const [open, setOpen] = useState(false);
  const arr = Array.isArray(selected) ? selected : [];

  const toggle = useCallback(
    (sub: string) => {
      const cur = Array.isArray(selected) ? selected : [];
      const next = cur.includes(sub) ? cur.filter((x: string) => x !== sub) : [...cur, sub];
      onChange(next.length === 0 ? "all" : next);
    },
    [selected, onChange]
  );

  const toggleGroup = useCallback(
    (subs: string[]) => {
      const cur = Array.isArray(selected) ? selected : [];
      const allSelected = subs.every((s: string) => cur.includes(s));
      let next;
      if (allSelected) {
        next = cur.filter((x) => !subs.includes(x));
      } else {
        next = [...new Set([...cur, ...subs])];
      }
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
        label="Category"
        variant="outlined"
        onClick={handleToggleOpen}
        value=""
        InputProps={{
          readOnly: true,
          startAdornment: arr.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
              {arr.map((sub) => (
                <Chip
                  key={sub}
                  label={CATEGORY_LABELS[sub] || sub}
                  size="small"
                  onDelete={(e) => {
                    e.stopPropagation();
                    toggle(sub);
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
              width: 320,
              borderRadius: 3,
              border: 1,
              borderColor: "grey.200",
              py: 0.5,
              zIndex: 20,
              maxHeight: 360,
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
                All categories
              </Typography>
            </Button>
            <Divider sx={{ my: 0.25 }} />

            {CATEGORY_TREE.map((group) => {
              const allSel = group.subs.every((s) => arr.includes(s));
              const someSel = !allSel && group.subs.some((s) => arr.includes(s));
              return (
                <Box key={group.main}>
                  <Button
                    onClick={() => toggleGroup(group.subs)}
                    fullWidth
                    sx={{
                      justifyContent: "flex-start",
                      px: 1.5,
                      py: 0.75,
                      textTransform: "none",
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
                        borderColor: allSel ? "primary.main" : someSel ? "primary.light" : "grey.300",
                        bgcolor: allSel ? "primary.main" : someSel ? "primary.100" : "transparent",
                      }}
                    >
                      {allSel && <CheckIcon sx={{ fontSize: 12, color: "white" }} />}
                      {someSel && !allSel && (
                        <Box sx={{ width: 8, height: 2, bgcolor: "primary.main", borderRadius: 0.5 }} />
                      )}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: "bold",
                        color: "grey.500",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {group.label}
                    </Typography>
                  </Button>
                  {group.subs.map((sub) => {
                    const sel = arr.includes(sub);
                    const t = CATEGORY_THEME[sub] || { bg: "#f3f4f6", text: "#374151" };
                    return (
                      <Button
                        key={sub}
                        onClick={() => toggle(sub)}
                        fullWidth
                        sx={{
                          justifyContent: "flex-start",
                          pl: 4,
                          pr: 1.5,
                          py: 0.5,
                          textTransform: "none",
                          fontSize: "0.875rem",
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
                            bgcolor: t.bg,
                            color: t.text,
                          }}
                        >
                          {CATEGORY_LABELS[sub] || sub}
                        </Box>
                      </Button>
                    );
                  })}
                </Box>
              );
            })}
          </Paper>
        </>
      )}
    </Box>
  );
});
CategoryDropdown.displayName = "CategoryDropdown";

export default CategoryDropdown;
