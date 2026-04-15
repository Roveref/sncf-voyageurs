import React, { memo, useState, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LayersIcon from "@mui/icons-material/Layers";
import TuneIcon from "@mui/icons-material/Tune";
import FilterListIcon from "@mui/icons-material/FilterList";
import {
  UTILIZATION_FILTERS,
  UTILIZATION_FILTER_LABELS,
  getFilterSummary,
  getUniqueGrades,
  getUniqueSubTeams,
  getUniqueServiceLines,
} from "../../utils/filterUtils";
import { CATEGORY_LABELS, CATEGORY_TREE } from "../../constants";
import { easing } from "../../../../styles/animations";
import { CascadeFilterRow, ActiveChips } from "./FilterSubComponents";

// ─── Main SearchFilter (Pipeline/Bookings-aligned) ──────────────────────────
export const SearchFilter = memo(
  ({
    filters,
    onFilterChange,
    projects = [],
    employees = [],
    totalCount,
    filteredCount,
    groupingLevels = [],
    onGroupingChange,
    managerFilter = "all",
    onManagerChange,
    managerList = [],
    collapsedGroups,
    onCollapsedGroupsChange,
    groupedEmployees,
    hasSapData = false,
  }: any) => {
    const theme = useTheme();
    const [showAdvanced, setShowAdvanced] = useState(false);
    const grades = useMemo(() => getUniqueGrades(employees), [employees]);
    const subTeams = useMemo(() => getUniqueSubTeams(employees), [employees]);
    const serviceLines = useMemo(() => getUniqueServiceLines(employees), [employees]);

    const update = useCallback((patch: any) => onFilterChange({ ...filters, ...patch }), [filters, onFilterChange]);

    const removeFilter = useCallback(
      (key: string) => {
        if (key === "hideTu100") {
          update({ hideTu100: false });
          return;
        }
        if (key === "hideTuAboveTarget") {
          update({ hideTuAboveTarget: false });
          return;
        }
        if (key === "gradeTransitionOnly") {
          update({ gradeTransitionOnly: false });
          return;
        }
        if (key === "churnFilter") {
          update({ churnFilter: "" });
          return;
        }
        if (key === "sapFilter") {
          update({ sapFilter: "all" });
          return;
        }
        if (key === "dispo") {
          update({ dispoMin: 0, dispoMax: 100 });
          return;
        }
        if (key === "skill") {
          update({ skillSearch: "", skillMinLevel: 0 });
          return;
        }
        if (key.startsWith("cascade_")) {
          const idx = parseInt(key.split("_")[1], 10);
          const next = (filters.cascadeFilters || []).filter((_: any, i: number) => i !== idx);
          update({ cascadeFilters: next });
          return;
        }
        if (key === "categories") {
          update({ categories: [] });
          return;
        }
        if (key.startsWith("tag_")) {
          const idx = parseInt(key.split("_")[1], 10);
          const next = (filters.searchTags || []).filter((_: any, i: number) => i !== idx);
          update({ searchTags: next });
          return;
        }
        const defaults: Record<string, string> = {
          search: "",
          utilization: UTILIZATION_FILTERS.ALL,
          project: "all",
          grades: "all",
          subTeams: "all",
          serviceLine: "all",
        };
        if (key === "search") {
          update({ search: "", searchScope: "" });
          return;
        }
        update({ [key]: defaults[key] });
      },
      [update, filters.cascadeFilters]
    );

    const clearAll = useCallback(() => {
      update({
        project: "all",
        minAvailability: 0,
        cascadeFilters: [],
        skillSearch: "",
        skillMinLevel: 0,
      });
    }, [update]);

    const utilizationOpts = Object.entries(UTILIZATION_FILTER_LABELS).map(([v, l]) => ({ value: v, label: l }));
    const projectOpts = [
      { value: "all", label: "All projects" },
      ...projects.map((p: string) => ({ value: p, label: p })),
    ];
    const cascadeCategoryOpts = useMemo(
      () =>
        CATEGORY_TREE.flatMap((g) =>
          g.subs.map((s) => ({ value: s, label: `${g.label} \u203a ${CATEGORY_LABELS[s] || s}` }))
        ),
      []
    );
    const cascadeOptions = useMemo(
      () => ({
        grade: grades.map((g: string) => ({ value: g, label: g })),
        subTeam: subTeams.map((s: string) => ({ value: s, label: s })),
        serviceLine: serviceLines.map((s: string) => ({ value: s, label: s })),
        project: projects.map((p: string) => ({ value: p, label: p })),
        category: cascadeCategoryOpts,
      }),
      [grades, subTeams, serviceLines, projects, cascadeCategoryOpts]
    );

    const cascadeFilters = filters.cascadeFilters || [];
    const usedCascadeCriteria = cascadeFilters.map((f: any) => f.criterion).filter(Boolean);

    const handleCascadeChange = useCallback(
      (idx: number, newFilter: any) => {
        const next = [...(filters.cascadeFilters || [])];
        next[idx] = newFilter;
        update({ cascadeFilters: next });
      },
      [filters.cascadeFilters, update]
    );

    const handleCascadeRemove = useCallback(
      (idx: number) => {
        const next = (filters.cascadeFilters || []).filter((_: any, i: number) => i !== idx);
        update({ cascadeFilters: next });
      },
      [filters.cascadeFilters, update]
    );

    const addCascadeFilter = useCallback(() => {
      if ((filters.cascadeFilters || []).length >= 3) return;
      update({ cascadeFilters: [...(filters.cascadeFilters || []), { criterion: "", value: "" }] });
    }, [filters.cascadeFilters, update]);

    // ── Extracted handlers (stable refs for MUI components) ──────────────────
    const handleProjectChange = useCallback((e: any) => update({ project: e.target.value }), [update]);
    const handleToggleAdvanced = useCallback(() => setShowAdvanced((prev) => !prev), []);
    const handleSkillSearchChange = useCallback((e: any) => update({ skillSearch: e.target.value }), [update]);
    const handleSkillLevelChange = useCallback(
      (e: any) => update({ skillMinLevel: parseInt(e.target.value) || 0 }),
      [update]
    );
    const handleClearSkill = useCallback(() => update({ skillSearch: "", skillMinLevel: 0 }), [update]);
    const handleMinAvailChange = useCallback(
      (e: any) => update({ minAvailability: parseFloat(e.target.value) || 0 }),
      [update]
    );
    const handleGrouping1Change = useCallback(
      (e: any) => {
        const v = e.target.value;
        onGroupingChange(v === "none" ? [] : [v]);
      },
      [onGroupingChange]
    );
    const handleGrouping2Change = useCallback(
      (e: any) => {
        const v = e.target.value;
        onGroupingChange(v === "none" ? [groupingLevels[0]] : [groupingLevels[0], v]);
      },
      [onGroupingChange, groupingLevels]
    );
    const handleGrouping3Change = useCallback(
      (e: any) => {
        const v = e.target.value;
        onGroupingChange(
          v === "none" ? [groupingLevels[0], groupingLevels[1]] : [groupingLevels[0], groupingLevels[1], v]
        );
      },
      [onGroupingChange, groupingLevels]
    );
    const handleToggleCollapseAll = useCallback(() => {
      if (collapsedGroups && collapsedGroups.size > 0) {
        onCollapsedGroupsChange(new Set());
      } else {
        const collectKeys = (groups: any[], parentKey = "") => {
          const keys: any[] = [];
          groups?.forEach((g: any) => {
            const key = parentKey ? `${parentKey}::${g.name}` : g.name;
            keys.push(key);
            if (g.subGroups) keys.push(...collectKeys(g.subGroups, key));
          });
          return keys;
        };
        onCollapsedGroupsChange(new Set(collectKeys(groupedEmployees)));
      }
    }, [collapsedGroups, onCollapsedGroupsChange, groupedEmployees]);
    const handleManagerChange = useCallback((e: any) => onManagerChange(e.target.value), [onManagerChange]);

    const summary = getFilterSummary(filters, totalCount, filteredCount);

    const hasAdvancedFilters = !!(
      (filters.skillSearch && filters.skillSearch.trim()) ||
      filters.minAvailability > 0 ||
      (filters.cascadeFilters && filters.cascadeFilters.length > 0)
    );
    const advancedVisible = showAdvanced || hasAdvancedFilters;

    // Shared button sx for grey-palette toggle buttons
    const toggleBtnSx = (active: boolean) => ({
      minHeight: 48,
      px: 1.5,
      fontWeight: 500,
      fontSize: "0.875rem",
      borderRadius: 1,
      textTransform: "none",
      whiteSpace: "nowrap",
      backgroundColor: active ? theme.palette.grey[400] : theme.palette.grey[100],
      color: active ? theme.palette.getContrastText(theme.palette.grey[400]) : "text.secondary",
      transition: `background-color 0.2s ${easing.bounce}, color 0.2s ${easing.bounce}, transform 0.2s ${easing.bounce}`,
      "&:hover": {
        backgroundColor: active ? theme.palette.grey[500] : theme.palette.grey[200],
        transform: "scale(1.02)",
      },
      "&:active": { transform: "scale(0.98)" },
    });

    return (
      <Box
        sx={{ bgcolor: "background.paper", borderRadius: 2, p: 2, display: "flex", flexDirection: "column", gap: 2 }}
        role="search"
      >
        {/* ── Row 1: Project + Grouping + Manager + Advanced toggle ─────────── */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ pt: 0.5 }}>
            <FilterListIcon color="primary" />
          </Box>

          {/* Project filter */}
          <Box sx={{ minWidth: 180 }}>
            <TextField
              fullWidth
              size="small"
              label="Project"
              variant="outlined"
              value={filters.project === "all" ? "" : filters.project}
              select
              onChange={handleProjectChange}
              sx={{
                "& .MuiInputBase-root": { minHeight: 48 },
                "& .MuiInputBase-input": { fontSize: "0.875rem" },
              }}
            >
              {projectOpts.map((o) => (
                <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.875rem" }}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ borderColor: "divider", mx: 0.5 }} />

          {/* Advanced toggle */}
          <Button
            onClick={handleToggleAdvanced}
            size="small"
            sx={{
              ml: "auto",
              ...toggleBtnSx(advancedVisible),
              px: 2,
            }}
            startIcon={<TuneIcon sx={{ fontSize: 18 }} />}
            endIcon={
              <ExpandMoreIcon
                sx={{
                  fontSize: 16,
                  transition: `transform 0.3s ${easing.elegant}`,
                  transform: advancedVisible ? "rotate(180deg)" : "none",
                }}
              />
            }
          >
            Advanced
          </Button>
        </Box>

        {/* ── Row 3 (collapsible): Advanced filters ─────────────────────────── */}
        {advancedVisible && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            {/* Skill search */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                minHeight: 48,
                border: 1,
                borderColor: "grey.300",
                borderRadius: 1,
                overflow: "hidden",
                bgcolor: "background.paper",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.5 }}>
                <EmojiEventsIcon sx={{ fontSize: 18, color: "grey.400", flexShrink: 0 }} />
                <TextField
                  variant="standard"
                  size="small"
                  value={filters.skillSearch || ""}
                  onChange={handleSkillSearchChange}
                  placeholder="Skill\u2026"
                  sx={{ width: 100, "& .MuiInputBase-input": { py: 0.75, px: 0, fontSize: "0.875rem" } }}
                  InputProps={{ disableUnderline: true }}
                />
              </Box>
              <Select
                variant="standard"
                value={filters.skillMinLevel || 0}
                onChange={handleSkillLevelChange}
                sx={{ height: "100%", px: 1, fontSize: "0.875rem", borderLeft: 1, borderColor: "grey.200" }}
                disableUnderline
              >
                <MenuItem value={0} sx={{ fontSize: "0.875rem" }}>
                  0+
                </MenuItem>
                <MenuItem value={1} sx={{ fontSize: "0.875rem" }}>
                  1+
                </MenuItem>
                <MenuItem value={2} sx={{ fontSize: "0.875rem" }}>
                  2+
                </MenuItem>
                <MenuItem value={3} sx={{ fontSize: "0.875rem" }}>
                  3+
                </MenuItem>
                <MenuItem value={4} sx={{ fontSize: "0.875rem" }}>
                  4
                </MenuItem>
              </Select>
              {filters.skillSearch && (
                <IconButton
                  size="small"
                  onClick={handleClearSkill}
                  sx={{ px: 0.5, color: "grey.400", "&:hover": { color: "grey.600" } }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>

            {/* Min availability */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                minHeight: 48,
                px: 1.5,
                border: 1,
                borderColor: "grey.300",
                borderRadius: 1,
                bgcolor: "background.paper",
              }}
            >
              <Typography sx={{ color: "grey.500", whiteSpace: "nowrap", fontSize: "0.875rem" }}>Min avail:</Typography>
              <TextField
                variant="standard"
                type="number"
                size="small"
                inputProps={{ min: 0, max: 8, step: 0.5 }}
                value={filters.minAvailability || ""}
                onChange={handleMinAvailChange}
                placeholder="0"
                sx={{
                  width: 56,
                  "& .MuiInputBase-input": { py: 0.5, px: 0.5, fontSize: "0.875rem", textAlign: "center" },
                }}
                InputProps={{ disableUnderline: true }}
              />
              <Typography sx={{ color: "grey.400", fontSize: "0.875rem" }}>h/d</Typography>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ borderColor: "divider", mx: 0.5 }} />

            {/* Cascade filters */}
            {cascadeFilters.map((cf: any, i: number) => (
              <CascadeFilterRow
                key={i}
                filter={cf}
                index={i}
                usedCriteria={usedCascadeCriteria}
                options={cascadeOptions}
                onChange={handleCascadeChange}
                onRemove={handleCascadeRemove}
              />
            ))}
            {cascadeFilters.length < 3 && (
              <Button
                onClick={addCascadeFilter}
                size="small"
                sx={{
                  minHeight: 40,
                  textTransform: "none",
                  fontSize: "0.875rem",
                  backgroundColor: theme.palette.grey[100],
                  color: "text.secondary",
                  borderRadius: 1,
                  transition: `background-color 0.2s ${easing.bounce}, transform 0.2s ${easing.bounce}`,
                  "&:hover": { backgroundColor: theme.palette.grey[200], transform: "scale(1.02)" },
                  "&:active": { transform: "scale(0.98)" },
                }}
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              >
                Filter
              </Button>
            )}
          </Box>
        )}

        {/* ── Row 4: Grouping + Manager ─────────────────────────────────────── */}
        {onGroupingChange && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <LayersIcon sx={{ fontSize: 18, color: "grey.400", flexShrink: 0 }} />

            <Select
              value={groupingLevels[0] || "none"}
              onChange={handleGrouping1Change}
              size="small"
              sx={{ minHeight: 48, fontSize: "0.875rem" }}
            >
              <MenuItem value="none" sx={{ fontSize: "0.875rem" }}>
                No grouping
              </MenuItem>
              <MenuItem value="grade" sx={{ fontSize: "0.875rem" }}>
                By Grade
              </MenuItem>
              <MenuItem value="team" sx={{ fontSize: "0.875rem" }}>
                By Team
              </MenuItem>
              <MenuItem value="dm" sx={{ fontSize: "0.875rem" }}>
                By DM
              </MenuItem>
              <MenuItem value="project" sx={{ fontSize: "0.875rem" }}>
                By Project
              </MenuItem>
            </Select>

            {groupingLevels.length >= 1 && (
              <Select
                value={groupingLevels[1] || "none"}
                onChange={handleGrouping2Change}
                size="small"
                sx={{ minHeight: 48, fontSize: "0.875rem" }}
              >
                <MenuItem value="none" sx={{ fontSize: "0.875rem" }}>
                  No sub-grouping
                </MenuItem>
                {groupingLevels[0] !== "grade" && (
                  <MenuItem value="grade" sx={{ fontSize: "0.875rem" }}>
                    + By Grade
                  </MenuItem>
                )}
                {groupingLevels[0] !== "team" && (
                  <MenuItem value="team" sx={{ fontSize: "0.875rem" }}>
                    + By Team
                  </MenuItem>
                )}
                {groupingLevels[0] !== "dm" && (
                  <MenuItem value="dm" sx={{ fontSize: "0.875rem" }}>
                    + By DM
                  </MenuItem>
                )}
                {groupingLevels[0] !== "project" && (
                  <MenuItem value="project" sx={{ fontSize: "0.875rem" }}>
                    + By Project
                  </MenuItem>
                )}
              </Select>
            )}

            {groupingLevels.length >= 2 && (
              <Select
                value={groupingLevels[2] || "none"}
                onChange={handleGrouping3Change}
                size="small"
                sx={{ minHeight: 48, fontSize: "0.875rem" }}
              >
                <MenuItem value="none" sx={{ fontSize: "0.875rem" }}>
                  No 3rd level
                </MenuItem>
                {!groupingLevels.slice(0, 2).includes("grade") && (
                  <MenuItem value="grade" sx={{ fontSize: "0.875rem" }}>
                    + By Grade
                  </MenuItem>
                )}
                {!groupingLevels.slice(0, 2).includes("team") && (
                  <MenuItem value="team" sx={{ fontSize: "0.875rem" }}>
                    + By Team
                  </MenuItem>
                )}
                {!groupingLevels.slice(0, 2).includes("dm") && (
                  <MenuItem value="dm" sx={{ fontSize: "0.875rem" }}>
                    + By DM
                  </MenuItem>
                )}
                {!groupingLevels.slice(0, 2).includes("project") && (
                  <MenuItem value="project" sx={{ fontSize: "0.875rem" }}>
                    + By Project
                  </MenuItem>
                )}
              </Select>
            )}

            {groupingLevels.length > 0 && onCollapsedGroupsChange && (
              <Button onClick={handleToggleCollapseAll} size="small" sx={toggleBtnSx(false)}>
                {collapsedGroups && collapsedGroups.size > 0 ? "Expand all" : "Collapse all"}
              </Button>
            )}

            {managerList.length > 0 && onManagerChange && (
              <>
                <Divider orientation="vertical" flexItem sx={{ borderColor: "divider", mx: 0.5 }} />
                <Select
                  value={managerFilter}
                  onChange={handleManagerChange}
                  size="small"
                  sx={{
                    minHeight: 48,
                    fontSize: "0.875rem",
                    backgroundColor: managerFilter !== "all" ? theme.palette.grey[400] : theme.palette.grey[100],
                    color:
                      managerFilter !== "all"
                        ? theme.palette.getContrastText(theme.palette.grey[400])
                        : "text.secondary",
                    transition: `background-color 0.2s ${easing.bounce}, color 0.2s ${easing.bounce}`,
                  }}
                >
                  <MenuItem value="all" sx={{ fontSize: "0.875rem" }}>
                    All managers
                  </MenuItem>
                  {managerList.map((mgr: any) => (
                    <MenuItem key={mgr.empId} value={mgr.empId} sx={{ fontSize: "0.875rem" }}>
                      {mgr.name} ({mgr.grade}) — {mgr.reportIds.size} report
                      {mgr.reportIds.size > 1 ? "s" : ""}
                    </MenuItem>
                  ))}
                </Select>
              </>
            )}
          </Box>
        )}

        {/* ── Row 5: Active chips + summary ─────────────────────────────────── */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <ActiveChips filters={filters} onRemove={removeFilter} onClearAll={clearAll} />
          <Typography variant="body2" sx={{ color: "grey.400", whiteSpace: "nowrap", fontSize: "0.875rem" }}>
            {summary}
          </Typography>
        </Box>
      </Box>
    );
  }
);

SearchFilter.displayName = "SearchFilter";
