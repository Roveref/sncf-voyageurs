import { memo, useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

interface MobileTopToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  heatmapMode: string;
  onHeatmapModeChange: (mode: string) => void;
  groupingMode: string;
  onGroupingModeChange: (mode: string) => void;
  /** Date range presets */
  onPresetClick: (preset: string) => void;
  activePreset?: string;
}

const PRESETS = [
  { key: "4w", label: "4W" },
  { key: "3m", label: "3M" },
  { key: "9m", label: "9M" },
];

const MobileTopToolbar = memo(
  ({
    searchValue,
    onSearchChange,
    heatmapMode,
    onHeatmapModeChange,
    groupingMode,
    onGroupingModeChange,
    onPresetClick,
    activePreset,
  }: MobileTopToolbarProps) => {
    const [searchExpanded, setSearchExpanded] = useState(false);

    return (
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "background.default",
          px: 1,
          pt: 0.75,
          pb: 0.75,
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {/* Row 1: Search + Grouping + Heatmap mode */}
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
          {searchExpanded ? (
            <TextField
              autoFocus
              size="small"
              placeholder="Search employees..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              sx={{ flex: 1 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSearchExpanded(false);
                          onSearchChange("");
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: { height: 36, borderRadius: 2, fontSize: "0.85rem" },
                },
              }}
            />
          ) : (
            <>
              <IconButton
                size="small"
                onClick={() => setSearchExpanded(true)}
                sx={{
                  bgcolor: searchValue ? "primary.main" : "action.hover",
                  color: searchValue ? "white" : "text.secondary",
                  width: 36,
                  height: 36,
                }}
              >
                <SearchIcon sx={{ fontSize: 18 }} />
              </IconButton>

              <Select
                size="small"
                value={groupingMode}
                onChange={(e) => onGroupingModeChange(e.target.value)}
                sx={{ height: 36, fontSize: "0.75rem", minWidth: 75 }}
              >
                <MenuItem value="none">Flat</MenuItem>
                <MenuItem value="grade">Grade</MenuItem>
                <MenuItem value="subTeam">Team</MenuItem>
                <MenuItem value="dm">DM</MenuItem>
              </Select>

              <Select
                size="small"
                value={heatmapMode}
                onChange={(e) => onHeatmapModeChange(e.target.value)}
                sx={{ height: 36, fontSize: "0.75rem", minWidth: 60 }}
              >
                <MenuItem value="tu">TU</MenuItem>
                <MenuItem value="to">TO</MenuItem>
                <MenuItem value="availability">Avail</MenuItem>
                <MenuItem value="variance_hours">dh</MenuItem>
              </Select>

              {/* Presets */}
              <Box sx={{ display: "flex", gap: 0.5, ml: "auto" }}>
                {PRESETS.map(({ key, label }) => (
                  <Chip
                    key={key}
                    label={label}
                    size="small"
                    onClick={() => onPresetClick(key)}
                    sx={{
                      height: 28,
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      bgcolor: activePreset === key ? "primary.main" : "action.hover",
                      color: activePreset === key ? "white" : "text.secondary",
                      "&:hover": { bgcolor: activePreset === key ? "primary.dark" : "action.selected" },
                    }}
                  />
                ))}
              </Box>
            </>
          )}
        </Box>
      </Box>
    );
  }
);
MobileTopToolbar.displayName = "MobileTopToolbar";

export default MobileTopToolbar;
