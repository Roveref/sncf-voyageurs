import React, { useCallback, useState, useEffect, useMemo, useRef, memo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import Popover from "@mui/material/Popover";
import Popper from "@mui/material/Popper";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import PersonIcon from "@mui/icons-material/Person";
import WorkIcon from "@mui/icons-material/Work";
import PsychologyIcon from "@mui/icons-material/Psychology";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BusinessIcon from "@mui/icons-material/Business";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { easing } from "../../../../styles/animations";
import { getPresetButtonSx } from "../../../shared/DateRangeFilter";
import { formatLocalDate } from "../../utils/dateUtils";
import { getRealEmpId } from "../../utils/empIdUtils";
import { PRESETS, TIMEFRAME_TO_PRESET, computeShortPresetRange } from "./dateRangePresets";
import { StableControls, FilterRow as FilterRowComp } from "./StaffingFilterControls";

// ─── Sub-component A: date-dependent section (DatePickers + presets + direction) ──────────────
// Re-renders on every timeline pan — intentional, these controls show the current date range.
// Isolated so the stable controls (search, granularity, etc.) can memo bail-out.

const SCOPE_PLACEHOLDERS: Record<string, string> = {
  "": "Search…",
  person: "Person…",
  project: "Project…",
  skill: "Skill…",
  account: "Account…",
};
const SCOPE_BUTTONS = [
  { key: "person", icon: PersonIcon, tip: "Search persons" },
  { key: "project", icon: WorkIcon, tip: "Search projects" },
  { key: "account", icon: BusinessIcon, tip: "Search accounts" },
  { key: "skill", icon: PsychologyIcon, tip: "Search skills" },
] as const;
const MAX_SUGGESTIONS = 8;

const DateRangeSection = memo(
  ({
    activePreset,
    direction,
    handlePresetClick,
    handleDirectionToggle,
    searchValue,
    onSearchChange,
    searchScope,
    onSearchScopeChange,
    searchEmployees,
    searchTags,
    onSearchTagsChange,
    autoSort,
    onAutoSortToggle,
    pipelineJobcodes,
  }: any) => {
    const theme = useTheme();

    // Debounced search
    const [localSearch, setLocalSearch] = useState(searchValue);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => {
      setLocalSearch(searchValue);
    }, [searchValue]);
    useEffect(() => () => clearTimeout(searchTimerRef.current), []);
    const handleLocalSearch = useCallback(
      (val: string) => {
        setLocalSearch(val);
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => onSearchChange(val), 250);
      },
      [onSearchChange]
    );

    // Autocomplete dropdown
    const searchFieldRef = useRef<HTMLDivElement>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const [tagsPopoverOpen, setTagsPopoverOpen] = useState(false);
    const tagsChipRef = useRef<HTMLDivElement>(null);

    // Build suggestions from employees
    const suggestions = useMemo(() => {
      const q = localSearch.toLowerCase().trim();
      if (q.length < 2 || !searchEmployees?.length) return [];
      const scope = searchScope || "";
      const groups: {
        type: string;
        label: string;
        icon: typeof PersonIcon;
        items: { text: string; detail?: string }[];
      }[] = [];

      // Persons
      if (!scope || scope === "person") {
        const seen = new Set<string>();
        const items: { text: string; detail?: string }[] = [];
        for (const emp of searchEmployees) {
          const realId = getRealEmpId(emp);
          if (seen.has(realId)) continue;
          if (emp.name.toLowerCase().includes(q) || emp.empId.toLowerCase().includes(q)) {
            seen.add(realId);
            items.push({ text: emp.name, detail: emp.grade || undefined });
            if (items.length >= MAX_SUGGESTIONS) break;
          }
        }
        if (items.length) groups.push({ type: "person", label: "Persons", icon: PersonIcon, items });
      }

      // Projects (MDS assignments + SAP projects)
      if (!scope || scope === "project") {
        const seen = new Set<string>();
        const items: { text: string; detail?: string }[] = [];
        for (const emp of searchEmployees) {
          for (const a of emp.assignments || []) {
            const key = a.jobNo || a.jobName;
            if (seen.has(key)) continue;
            if (a.jobName.toLowerCase().includes(q) || (a.jobNo && a.jobNo.toLowerCase().includes(q))) {
              seen.add(key);
              items.push({ text: a.jobName, detail: a.jobNo || undefined });
              if (items.length >= MAX_SUGGESTIONS) break;
            }
          }
          for (const sp of emp._sapProjects || []) {
            const key = sp.code || sp.name;
            if (seen.has(key)) continue;
            if (sp.name.toLowerCase().includes(q) || (sp.code && sp.code.toLowerCase().includes(q))) {
              seen.add(key);
              items.push({ text: sp.name, detail: sp.code || undefined });
              if (items.length >= MAX_SUGGESTIONS) break;
            }
          }
          if (items.length >= MAX_SUGGESTIONS) break;
        }
        if (items.length) groups.push({ type: "project", label: "Projects", icon: WorkIcon, items });
      }

      // Skills
      if (!scope || scope === "skill") {
        const seen = new Set<string>();
        const items: { text: string; detail?: string }[] = [];
        for (const emp of searchEmployees) {
          for (const s of emp.skills || []) {
            const key = s.skillShort;
            if (seen.has(key)) continue;
            if (s.skillShort.toLowerCase().includes(q) || s.skillFull.toLowerCase().includes(q)) {
              seen.add(key);
              items.push({ text: s.skillShort, detail: s.skillFull !== s.skillShort ? s.skillFull : undefined });
              if (items.length >= MAX_SUGGESTIONS) break;
            }
          }
          if (items.length >= MAX_SUGGESTIONS) break;
        }
        if (items.length) groups.push({ type: "skill", label: "Skills", icon: PsychologyIcon, items });
      }

      // Accounts (from pipelineJobcodes)
      if ((!scope || scope === "account") && pipelineJobcodes) {
        const seen = new Set<string>();
        const items: { text: string; detail?: string }[] = [];
        for (const [, entry] of pipelineJobcodes) {
          const acct = entry.account;
          if (!acct || seen.has(acct)) continue;
          if (acct.toLowerCase().includes(q)) {
            seen.add(acct);
            items.push({ text: acct });
            if (items.length >= MAX_SUGGESTIONS) break;
          }
        }
        if (items.length) groups.push({ type: "account", label: "Accounts", icon: BusinessIcon, items });
      }

      return groups;
    }, [localSearch, searchScope, searchEmployees, searchTags, pipelineJobcodes]);

    // Flatten for keyboard nav
    const flatItems = useMemo(() => {
      const flat: { text: string; type: string }[] = [];
      for (const g of suggestions) {
        for (const item of g.items) flat.push({ text: item.text, type: g.type });
      }
      return flat;
    }, [suggestions]);

    const showDropdown = dropdownOpen && localSearch.trim().length >= 2 && suggestions.length > 0;

    const isTagSelected = useCallback(
      (text: string, type: string) => {
        return (searchTags || []).some((t: any) => t.text === text && t.type === type);
      },
      [searchTags]
    );

    const toggleSuggestion = useCallback(
      (text: string, type: string) => {
        if (onSearchTagsChange) {
          const tags = searchTags || [];
          const exists = tags.some((t: any) => t.text === text && t.type === type);
          if (exists) {
            onSearchTagsChange(tags.filter((t: any) => !(t.text === text && t.type === type)));
          } else {
            const newTag: any = { text, type };
            if (type === "skill") newTag.minLevel = 1;
            onSearchTagsChange([...tags, newTag]);
          }
          handleLocalSearch("");
        } else {
          handleLocalSearch(text);
          if (onSearchScopeChange && !searchScope) onSearchScopeChange(type);
          setDropdownOpen(false);
        }
        setHighlightIdx(-1);
      },
      [handleLocalSearch, onSearchScopeChange, searchScope, onSearchTagsChange, searchTags]
    );

    const setTagLevel = useCallback(
      (text: string, level: number) => {
        if (onSearchTagsChange && searchTags) {
          onSearchTagsChange(
            searchTags.map((t: any) => (t.type === "skill" && t.text === text ? { ...t, minLevel: level } : t))
          );
        }
      },
      [onSearchTagsChange, searchTags]
    );

    const getTagLevel = useCallback(
      (text: string) => {
        const tag = (searchTags || []).find((t: any) => t.type === "skill" && t.text === text);
        return tag?.minLevel ?? 1;
      },
      [searchTags]
    );

    const removeTag = useCallback(
      (idx: number) => {
        if (onSearchTagsChange && searchTags) {
          onSearchTagsChange(searchTags.filter((_: any, i: number) => i !== idx));
        }
      },
      [onSearchTagsChange, searchTags]
    );

    const handleSearchKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        // Backspace on empty input removes last tag
        if (e.key === "Backspace" && !localSearch && searchTags?.length) {
          removeTag(searchTags.length - 1);
          return;
        }
        if (!showDropdown) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlightIdx((i) => (i + 1) % flatItems.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlightIdx((i) => (i <= 0 ? flatItems.length - 1 : i - 1));
        } else if (e.key === "Enter" && highlightIdx >= 0 && highlightIdx < flatItems.length) {
          e.preventDefault();
          toggleSuggestion(flatItems[highlightIdx].text, flatItems[highlightIdx].type);
        } else if (e.key === "Escape") {
          setDropdownOpen(false);
          setHighlightIdx(-1);
        }
      },
      [showDropdown, highlightIdx, flatItems, toggleSuggestion, localSearch, searchTags, removeTag]
    );

    const BTN_HEIGHT = 36;
    const presetButtonSx = (isActive: boolean) => ({
      ...getPresetButtonSx(isActive, {
        activeBg: theme.palette.grey[400],
        activeHoverBg: theme.palette.grey[500],
        inactiveBg: "#eeeeee",
        inactiveHoverBg: "#e0e0e0",
        activeColor: theme.palette.getContrastText(theme.palette.grey[400]),
        inactiveColor: theme.palette.text.secondary,
      }),
      minWidth: 56,
      height: BTN_HEIGHT,
    });

    return (
      <>
        {/* Left column — search bar is the flex variable, absorbs remaining space */}
        <Box
          sx={{
            flex: 1,
            minWidth: 200,
            display: "flex",
            alignItems: "center",
            gap: 1,
            borderRight: "1px solid",
            borderColor: "divider",
            pr: 2,
          }}
        >
          <Box sx={{ pt: 1 }}>
            <SearchIcon color="primary" />
          </Box>
          <ClickAwayListener
            onClickAway={() => {
              setDropdownOpen(false);
              if (searchTags?.length) handleLocalSearch("");
            }}
          >
            <Box sx={{ flex: 1, minWidth: 120, position: "relative" }}>
              <TextField
                ref={searchFieldRef}
                size="small"
                fullWidth
                value={localSearch}
                onChange={(e) => {
                  handleLocalSearch(e.target.value);
                  setDropdownOpen(true);
                  setHighlightIdx(-1);
                }}
                onFocus={() => {
                  if (localSearch.trim().length >= 2) setDropdownOpen(true);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchTags?.length ? "" : SCOPE_PLACEHOLDERS[searchScope || ""] || "Search…"}
                aria-label="Search employees"
                variant="standard"
                sx={{
                  "& .MuiInput-underline:before": { display: "none" },
                  "& .MuiInput-underline:after": { display: "none" },
                  "& .MuiInputBase-root": {
                    minHeight: 40,
                    alignItems: "center",
                    fontSize: "0.875rem",
                    flexWrap: "nowrap",
                    overflow: "hidden",
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    px: 1.5,
                  },
                  "& .MuiInputBase-input": {
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    py: 0,
                  },
                }}
                InputProps={{
                  startAdornment: searchTags?.length ? (
                    <InputAdornment
                      position="start"
                      ref={tagsChipRef}
                      sx={{ mr: 0.5, flexShrink: 0, gap: 0.75, cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTagsPopoverOpen((prev) => !prev);
                      }}
                    >
                      {(() => {
                        const counts: Record<string, number> = {};
                        for (const t of searchTags) counts[t.type] = (counts[t.type] || 0) + 1;
                        return Object.entries(counts).map(([type, count]) => {
                          const ScopeIcon = SCOPE_BUTTONS.find((b) => b.key === type)?.icon;
                          return (
                            <Chip
                              key={type}
                              icon={ScopeIcon ? <ScopeIcon sx={{ fontSize: "13px !important" }} /> : undefined}
                              label={count}
                              size="small"
                              sx={{
                                height: 24,
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                bgcolor: theme.palette.primary.main,
                                color: "#fff",
                                "& .MuiChip-icon": { color: "#fff" },
                                "& .MuiChip-label": { px: 0.5 },
                              }}
                            />
                          );
                        });
                      })()}
                    </InputAdornment>
                  ) : undefined,
                  endAdornment:
                    localSearch || searchTags?.length ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label="Clear search"
                          onClick={() => {
                            handleLocalSearch("");
                            setDropdownOpen(false);
                            if (onSearchTagsChange) onSearchTagsChange([]);
                          }}
                          sx={{ color: "grey.400", p: 0.25, "&:hover": { color: "grey.600" } }}
                        >
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                }}
              />
              <Popper
                open={showDropdown}
                anchorEl={searchFieldRef.current}
                placement="bottom-start"
                style={{ zIndex: theme.zIndex.modal + 1, width: searchFieldRef.current?.offsetWidth || 300 }}
              >
                <Paper elevation={8} sx={{ maxHeight: 360, overflow: "auto", mt: 0.5, borderRadius: 1.5 }}>
                  <MenuList dense sx={{ py: 0.5 }}>
                    {(() => {
                      let flatIdx = 0;
                      return suggestions.map((group) => {
                        const GroupIcon = group.icon;
                        return (
                          <div key={group.type}>
                            {suggestions.length > 1 && (
                              <ListSubheader
                                sx={{
                                  lineHeight: "28px",
                                  fontSize: "0.7rem",
                                  fontWeight: 700,
                                  color: "text.secondary",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  bgcolor: "background.paper",
                                }}
                              >
                                <GroupIcon sx={{ fontSize: 14 }} /> {group.label}
                              </ListSubheader>
                            )}
                            {group.items.map((item) => {
                              const idx = flatIdx++;
                              const checked = isTagSelected(item.text, group.type);
                              const isSkill = group.type === "skill";
                              const currentLevel = isSkill && checked ? getTagLevel(item.text) : 0;
                              return (
                                <MenuItem
                                  key={`${group.type}-${item.text}`}
                                  selected={idx === highlightIdx}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    toggleSuggestion(item.text, group.type);
                                  }}
                                  sx={{ fontSize: "0.8rem", py: 0.25, px: 1 }}
                                >
                                  <Checkbox
                                    size="small"
                                    checked={checked}
                                    inputProps={{ "aria-label": `Select ${item.text}` }}
                                    sx={{ p: 0.25, mr: 0.5 }}
                                  />
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                      width: "100%",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {suggestions.length <= 1 && (
                                      <GroupIcon sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }} />
                                    )}
                                    <Typography noWrap sx={{ fontSize: "0.8rem" }}>
                                      {item.text}
                                    </Typography>
                                    {item.detail && !isSkill && (
                                      <Typography
                                        noWrap
                                        sx={{ fontSize: "0.7rem", color: "text.disabled", ml: "auto", flexShrink: 0 }}
                                      >
                                        {item.detail}
                                      </Typography>
                                    )}
                                    {isSkill && checked && (
                                      <Box
                                        sx={{ ml: "auto", display: "flex", gap: 0.25, flexShrink: 0 }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                      >
                                        {[1, 2, 3, 4].map((lvl) => (
                                          <Box
                                            key={lvl}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setTagLevel(item.text, lvl);
                                            }}
                                            sx={{
                                              width: 20,
                                              height: 20,
                                              borderRadius: 0.5,
                                              fontSize: "0.65rem",
                                              fontWeight: 700,
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              cursor: "pointer",
                                              backgroundColor:
                                                lvl <= currentLevel
                                                  ? theme.palette.primary.main
                                                  : theme.palette.grey[200],
                                              color:
                                                lvl <= currentLevel
                                                  ? theme.palette.primary.contrastText
                                                  : "text.secondary",
                                              "&:hover": {
                                                backgroundColor:
                                                  lvl <= currentLevel
                                                    ? theme.palette.primary.dark
                                                    : theme.palette.grey[300],
                                              },
                                            }}
                                          >
                                            {lvl}
                                          </Box>
                                        ))}
                                      </Box>
                                    )}
                                  </Box>
                                </MenuItem>
                              );
                            })}
                          </div>
                        );
                      });
                    })()}
                  </MenuList>
                </Paper>
              </Popper>
              <Popover
                open={tagsPopoverOpen}
                anchorEl={tagsChipRef.current}
                onClose={() => setTagsPopoverOpen(false)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{ paper: { sx: { mt: 0.5, borderRadius: 1.5, minWidth: 200 } } }}
              >
                <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 0.75 }}>
                  {searchTags?.map((tag: any, i: number) => {
                    const ScopeIcon = SCOPE_BUTTONS.find((b) => b.key === tag.type)?.icon;
                    const isSkill = tag.type === "skill";
                    const currentLevel = isSkill ? (tag.minLevel ?? 1) : 0;
                    return (
                      <Box key={`${tag.type}-${tag.text}`} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <Chip
                          label={tag.text}
                          size="small"
                          icon={ScopeIcon ? <ScopeIcon sx={{ fontSize: "14px !important" }} /> : undefined}
                          onDelete={() => {
                            removeTag(i);
                            if (searchTags.length <= 1) setTagsPopoverOpen(false);
                          }}
                          sx={{ height: 26, fontSize: "0.75rem", "& .MuiChip-deleteIcon": { fontSize: 14 } }}
                        />
                        {isSkill && (
                          <Box sx={{ display: "flex", gap: 0.25 }}>
                            {[1, 2, 3, 4].map((lvl) => (
                              <Box
                                key={lvl}
                                onClick={() => setTagLevel(tag.text, lvl)}
                                sx={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 0.5,
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  backgroundColor:
                                    lvl <= currentLevel ? theme.palette.primary.main : theme.palette.grey[200],
                                  color: lvl <= currentLevel ? "#fff" : "text.secondary",
                                  "&:hover": {
                                    backgroundColor:
                                      lvl <= currentLevel ? theme.palette.primary.dark : theme.palette.grey[300],
                                  },
                                }}
                              >
                                {lvl}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Popover>
            </Box>
          </ClickAwayListener>
          <IconButton
            onClick={onAutoSortToggle}
            size="small"
            aria-label={autoSort !== false ? "Disable auto-sort" : "Enable auto-sort"}
            sx={{
              ml: 1,
              width: 36,
              height: 36,
              borderRadius: 1,
              backgroundColor: autoSort !== false ? theme.palette.grey[400] : theme.palette.grey[100],
              color: autoSort !== false ? theme.palette.getContrastText(theme.palette.grey[400]) : "text.secondary",
              transition: `background-color 0.2s ${easing.bounce}, color 0.2s ${easing.bounce}`,
              "&:hover": { backgroundColor: autoSort !== false ? theme.palette.grey[500] : theme.palette.grey[200] },
            }}
            title={autoSort !== false ? "Auto-sort enabled" : "Auto-sort disabled"}
          >
            <SwapVertIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Short presets + Past/Future direction toggle */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {(direction === "past" ? PRESETS.past : PRESETS.future).map((preset) => (
            <Button
              key={preset.id}
              onClick={() => handlePresetClick(preset.id)}
              size="small"
              sx={presetButtonSx(activePreset === preset.id)}
            >
              {preset.label}
            </Button>
          ))}
          <Tooltip title={direction === "future" ? "Future view — click for past" : "Past view — click for future"}>
            <Button
              onClick={handleDirectionToggle}
              size="small"
              sx={{
                minWidth: 0,
                px: 1,
                height: BTN_HEIGHT,
                bgcolor: direction === "past" ? theme.palette.warning.light : theme.palette.info.light,
                color: direction === "past" ? theme.palette.warning.dark : theme.palette.info.dark,
                "&:hover": {
                  bgcolor: direction === "past" ? theme.palette.warning.main : theme.palette.info.main,
                  color: "#fff",
                  transform: "scale(1.05)",
                },
              }}
            >
              {direction === "future" ? (
                <ArrowForwardIcon sx={{ fontSize: 18 }} />
              ) : (
                <ArrowBackIcon sx={{ fontSize: 18 }} />
              )}
            </Button>
          </Tooltip>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ borderColor: "divider", mx: 0.5 }} />
      </>
    );
  }
);

DateRangeSection.displayName = "DateRangeSection";

// Re-export FilterRow for backward compatibility
export { FilterRowComp as FilterRow };

// ─── Main component ────────────────────────────────────────────────────────────────────────────
/**
 * Staffing DateRangeFilter — date pickers, short-term presets with past/future
 * toggle, and granularity selector.
 *
 * Split into 3 memo sub-components:
 *   DateRangeSection  — date-dependent (re-renders on pan, ~20ms)
 *   StableControls    — stable on pan (search, gran, heatmap, zoom) → memo bail-out
 *   FilterRow         — stable on pan (filter controls Row 2) → memo bail-out
 */
const StaffingDateRangeFilter = memo(
  ({
    isStuck,
    merged,
    timelineStart,
    timelineEnd,
    timeframe,
    customDateRange,
    onTimeframeChange,
    setCustomDateRangeDirect,
    resetTimeline,
    granularity,
    onGranularityChange,
    heatmapMode,
    onHeatmapModeChange,
    chargeableCombined,
    onChargeableCombinedChange,
    dataSourceDebug,
    onDataSourceDebugChange,
    searchValue,
    onSearchChange,
    searchScope,
    onSearchScopeChange,
    searchEmployees,
    searchTags,
    onSearchTagsChange,
    onReset,
    hasSapData,
    autoSort,
    onAutoSortToggle,
    pipelineJobcodes,
  }: any) => {
    const [direction, setDirection] = useState("future");
    const lastPresetByDirection = useRef<Record<string, string>>({ future: "9M", past: "LY" });

    const presetsForDirection = direction === "past" ? PRESETS.past : PRESETS.future;

    const activePreset = useMemo(() => {
      if (!customDateRange.enabled && TIMEFRAME_TO_PRESET[timeframe]) {
        return TIMEFRAME_TO_PRESET[timeframe];
      }
      if (customDateRange.enabled) {
        for (const preset of presetsForDirection) {
          const { startDate: expStart, endDate: expEnd } = computeShortPresetRange(preset, direction);
          const startDiff = Math.abs(timelineStart.getTime() - expStart.getTime());
          const endDiff = Math.abs(timelineEnd.getTime() - expEnd.getTime());
          if (startDiff < 2 * 86400000 && endDiff < 2 * 86400000) return preset.id;
        }
        return "custom";
      }
      return null;
    }, [timeframe, customDateRange.enabled, timelineStart, timelineEnd, direction, presetsForDirection]);

    const handlePresetClick = useCallback(
      (presetId: string) => {
        if (activePreset === presetId) {
          resetTimeline();
          return;
        }
        lastPresetByDirection.current[direction] = presetId;
        const preset = presetsForDirection.find((p) => p.id === presetId);
        if (preset) {
          const { startDate, endDate } = computeShortPresetRange(preset, direction);
          setCustomDateRangeDirect(formatLocalDate(startDate), formatLocalDate(endDate));
        }
      },
      [activePreset, direction, presetsForDirection, setCustomDateRangeDirect, resetTimeline]
    );

    const handleDirectionToggle = useCallback(() => {
      const newDirection = direction === "future" ? "past" : "future";
      setDirection(newDirection);
      const savedPresetId = lastPresetByDirection.current[newDirection];
      const presets = newDirection === "past" ? PRESETS.past : PRESETS.future;
      const preset = presets.find((p) => p.id === savedPresetId) || presets[presets.length - 1];
      const { startDate, endDate } = computeShortPresetRange(preset, newDirection);
      setCustomDateRangeDirect(formatLocalDate(startDate), formatLocalDate(endDate));
    }, [direction, setCustomDateRangeDirect]);

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          borderRadius: merged ? "24px 24px 0 0" : 3,
          transition: "box-shadow 0.3s ease, border-radius 0.3s ease, border-color 0.3s ease",
          p: 2,
          bgcolor: "background.paper",
          position: "relative",
          zIndex: 1,
          ...(isStuck && {
            boxShadow: "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            ...(merged && { clipPath: "inset(-20px -20px 0px -20px)" }),
          }),
        }}
      >
        <DateRangeSection
          activePreset={activePreset}
          direction={direction}
          handlePresetClick={handlePresetClick}
          handleDirectionToggle={handleDirectionToggle}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchScope={searchScope}
          onSearchScopeChange={onSearchScopeChange}
          searchEmployees={searchEmployees}
          searchTags={searchTags}
          onSearchTagsChange={onSearchTagsChange}
          autoSort={autoSort}
          onAutoSortToggle={onAutoSortToggle}
          pipelineJobcodes={pipelineJobcodes}
        />
        <StableControls
          granularity={granularity}
          onGranularityChange={onGranularityChange}
          heatmapMode={heatmapMode}
          onHeatmapModeChange={onHeatmapModeChange}
          chargeableCombined={chargeableCombined}
          onChargeableCombinedChange={onChargeableCombinedChange}
          dataSourceDebug={dataSourceDebug}
          onDataSourceDebugChange={onDataSourceDebugChange}
          hasSapData={hasSapData}
          onReset={onReset}
        />
      </Box>
    );
  }
);

StaffingDateRangeFilter.displayName = "StaffingDateRangeFilter";

export default StaffingDateRangeFilter;
