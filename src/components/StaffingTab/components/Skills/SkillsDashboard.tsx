import React, { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupIcon from "@mui/icons-material/Group";
import BarChartIcon from "@mui/icons-material/BarChart";
import SearchIcon from "@mui/icons-material/Search";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import { SKILL_CATEGORY_THEME, SKILL_LEVEL_THEME } from "../../constants/theme";
import { SKILL_LEVEL_LABELS } from "../../constants";
import { SkillChip } from "./SkillChip";
import { SkillsCategoryChart } from "./SkillsCategoryChart";
import { SkillsCoverageMatrix } from "./SkillsCoverageMatrix";

// ── KPI card (same pattern as SummaryDashboard) ─────────────────────────────
const KPICard = memo(({ icon: Icon, title, value, subtitle, color = "blue" }: any) => {
  const palette: Record<string, { bgcolor: string; borderColor: string; color: string }> = {
    blue: { bgcolor: "#eff6ff", borderColor: "#bfdbfe", color: "primary.main" },
    green: { bgcolor: "#ecfdf5", borderColor: "#a7f3d0", color: "#059669" },
    amber: { bgcolor: "#fffbeb", borderColor: "#fde68a", color: "#d97706" },
    purple: { bgcolor: "#faf5ff", borderColor: "#e9d5ff", color: "#9333ea" },
  };
  const iconColor: Record<string, string> = {
    blue: "#3b82f6",
    green: "#10b981",
    amber: "#f59e0b",
    purple: "#a855f7",
  };
  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: "1px solid",
        ...palette[color],
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
      }}
    >
      <Box>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary" }}>{title}</Typography>
        <Typography sx={{ fontSize: "1.875rem", fontWeight: 700, mt: 0.5, color: "text.primary" }}>{value}</Typography>
        {subtitle && <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mt: 0.5 }}>{subtitle}</Typography>}
      </Box>
      <Icon sx={{ fontSize: 28, color: iconColor[color] }} />
    </Paper>
  );
});
KPICard.displayName = "SkillsKPICard";

// ── Top skills list ─────────────────────────────────────────────────────────
const TopSkillsList = memo(({ allSkills, maxCount }: any) => (
  <Box sx={{ "& > * + *": { mt: 0.75 } }}>
    {allSkills.slice(0, 20).map((skill: any) => {
      const theme = SKILL_CATEGORY_THEME[skill.category] || { hex: "#9ca3af" };
      const levelTheme = SKILL_LEVEL_THEME[Math.round(skill.avgLevel)] || SKILL_LEVEL_THEME[0];
      const pct = (skill.employeeCount / maxCount) * 100;
      return (
        <Box key={skill.skillShort} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            component="span"
            title={skill.skillFull}
            sx={{
              width: 112,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              fontSize: "10px",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              bgcolor: theme.hex ? `${theme.hex}20` : "#f3f4f6",
              color: theme.hex || "#374151",
            }}
          >
            {skill.skillShort}
          </Box>
          <Box sx={{ flex: 1, height: 16, bgcolor: "#f3f4f6", borderRadius: "9999px", overflow: "hidden" }}>
            <Box
              sx={{
                height: "100%",
                borderRadius: "9999px",
                width: `${pct}%`,
                bgcolor: theme.hex || "#9ca3af",
                opacity: 0.7,
              }}
            />
          </Box>
          <Typography
            component="span"
            sx={{ width: 32, textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "text.secondary" }}
          >
            {skill.employeeCount}
          </Typography>
          <Typography
            component="span"
            sx={{
              width: 56,
              textAlign: "right",
              fontSize: "10px",
              fontWeight: 500,
              color: levelTheme.hex || "#6b7280",
            }}
          >
            lvl. {skill.avgLevel.toFixed(1)}
          </Typography>
        </Box>
      );
    })}
  </Box>
));
TopSkillsList.displayName = "TopSkillsList";

// ── Skill search with employee results + availability cross-filter ──────────
const SkillSearchPanel = memo(({ employees }: any) => {
  const [query, setQuery] = useState("");
  const [minLevel, setMinLevel] = useState(0);
  const [maxUtilization, setMaxUtilization] = useState(100);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return employees
      .filter((emp: any) => {
        const hasMatchingSkill = emp.skills?.some(
          (s: any) =>
            (s.skillShort.toLowerCase().includes(q) || s.skillFull.toLowerCase().includes(q)) && s.level >= minLevel
        );
        if (!hasMatchingSkill) return false;
        if (onlyAvailable && emp.availableCapacityHours <= 0) return false;
        if (emp.trueUtilizationRate > maxUtilization) return false;
        return true;
      })
      .map((emp: any) => {
        const matchingSkills = emp.skills.filter(
          (s: any) =>
            (s.skillShort.toLowerCase().includes(q) || s.skillFull.toLowerCase().includes(q)) && s.level >= minLevel
        );
        return { emp, matchingSkills };
      })
      .sort((a: any, b: any) => {
        if (onlyAvailable) {
          const availDiff = b.emp.availableCapacityHours - a.emp.availableCapacityHours;
          if (Math.abs(availDiff) > 0.5) return availDiff;
        }
        return (
          Math.max(...b.matchingSkills.map((s: any) => s.level)) -
          Math.max(...a.matchingSkills.map((s: any) => s.level))
        );
      });
  }, [employees, query, minLevel, maxUtilization, onlyAvailable]);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        <TextField
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills..."
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
        />
        <Select
          size="small"
          value={minLevel}
          onChange={(e) => setMinLevel(parseInt(String(e.target.value)))}
          sx={{ minWidth: 140 }}
        >
          {[0, 1, 2, 3, 4].map((l) => (
            <MenuItem key={l} value={l}>
              Lvl. {l}+ ({SKILL_LEVEL_LABELS[l]})
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          value={maxUtilization}
          onChange={(e) => setMaxUtilization(parseInt(String(e.target.value)))}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value={100}>TU max 100%</MenuItem>
          <MenuItem value={80}>TU max 80%</MenuItem>
          <MenuItem value={50}>TU max 50%</MenuItem>
          <MenuItem value={30}>TU max 30%</MenuItem>
        </Select>
        <Button
          size="small"
          onClick={() => setOnlyAvailable(!onlyAvailable)}
          variant={onlyAvailable ? "contained" : "outlined"}
          sx={{
            textTransform: "none",
            ...(onlyAvailable
              ? { bgcolor: "#ecfdf5", color: "#15803d", borderColor: "#86efac", "&:hover": { bgcolor: "#dcfce7" } }
              : {
                  bgcolor: "#fff",
                  color: "text.secondary",
                  borderColor: "#d1d5db",
                  "&:hover": { bgcolor: "background.default" },
                }),
          }}
        >
          {onlyAvailable ? "Available only" : "All"}
        </Button>
      </Box>

      {query.trim() && (
        <Box sx={{ "& > * + *": { mt: 0.5 }, maxHeight: 320, overflowY: "auto" }}>
          {results.length === 0 ? (
            <Typography sx={{ fontSize: "0.875rem", color: "text.secondary", py: 2, textAlign: "center" }}>
              No employees found
            </Typography>
          ) : (
            <>
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mb: 1 }}>
                {results.length} employee{results.length > 1 ? "s" : ""} found
              </Typography>
              {results.map(({ emp, matchingSkills }: any) => (
                <Box
                  key={emp.empId}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    border: "1px solid #f3f4f6",
                    "&:hover": { bgcolor: "background.default" },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography component="span" sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.primary" }}>
                      {emp.name}
                    </Typography>
                    <Typography component="span" sx={{ fontSize: "0.75rem", color: "text.disabled", ml: 1 }}>
                      {emp.grade}
                    </Typography>
                    {emp.trueUtilizationRate !== undefined && (
                      <Typography
                        component="span"
                        sx={{
                          fontSize: "0.75rem",
                          ml: 1,
                          color:
                            emp.trueUtilizationRate >= 80
                              ? "#10b981"
                              : emp.trueUtilizationRate >= 50
                                ? "#3b82f6"
                                : "#f59e0b",
                        }}
                      >
                        TU {emp.trueUtilizationRate.toFixed(0)}%
                      </Typography>
                    )}
                    {emp.availableCapacityHours > 0 && (
                      <Typography
                        component="span"
                        sx={{ fontSize: "0.75rem", ml: 1, color: "#16a34a", fontWeight: 500 }}
                      >
                        {emp.availableCapacityHours.toFixed(1)}h ({(emp.availableCapacityHours / 8).toFixed(2)}d)
                        avail./d
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                    {matchingSkills.map((s: any, i: number) => (
                      <SkillChip key={i} skill={s} size="sm" />
                    ))}
                  </Box>
                </Box>
              ))}
            </>
          )}
        </Box>
      )}
    </Box>
  );
});
SkillSearchPanel.displayName = "SkillSearchPanel";

// ── Gap analysis (bus factor + training opportunities) ──────────────────────
const GapAnalysis = memo(({ allSkills, _employees }: any) => {
  const gaps = useMemo(() => {
    const busFactorRisks = allSkills.filter((s: any) => s.employeeCount <= 2 && s.avgLevel >= 3).slice(0, 10);

    const trainingOpps = allSkills.filter((s: any) => s.employeeCount >= 5 && s.avgLevel < 2).slice(0, 10);

    return { busFactorRisks, trainingOpps };
  }, [allSkills]);

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
      <Box>
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#ef4444",
            mb: 1,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          <TrackChangesIcon sx={{ fontSize: 14 }} />
          Risque de bus factor (1-2 experts)
        </Typography>
        {gaps.busFactorRisks.length === 0 ? (
          <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>Aucun risque identifié</Typography>
        ) : (
          <Box sx={{ "& > * + *": { mt: 0.5 } }}>
            {gaps.busFactorRisks.map((s: any) => (
              <Box
                key={s.skillShort}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: "#fef2f2",
                  fontSize: "0.75rem",
                }}
              >
                <Typography component="span" sx={{ fontWeight: 500, color: "#b91c1c", fontSize: "inherit" }}>
                  {s.skillShort}
                </Typography>
                <Typography component="span" sx={{ color: "#ef4444", fontSize: "inherit" }}>
                  {s.employeeCount} empl. · lvl. {s.avgLevel.toFixed(1)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
      <Box>
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#d97706",
            mb: 1,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          <EmojiEventsIcon sx={{ fontSize: 14 }} />
          Opportunités de formation (niveau moyen {"<"} 2)
        </Typography>
        {gaps.trainingOpps.length === 0 ? (
          <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>Aucune opportunité identifiée</Typography>
        ) : (
          <Box sx={{ "& > * + *": { mt: 0.5 } }}>
            {gaps.trainingOpps.map((s: any) => (
              <Box
                key={s.skillShort}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: "#fffbeb",
                  fontSize: "0.75rem",
                }}
              >
                <Typography component="span" sx={{ fontWeight: 500, color: "#b45309", fontSize: "inherit" }}>
                  {s.skillShort}
                </Typography>
                <Typography component="span" sx={{ color: "#f59e0b", fontSize: "inherit" }}>
                  {s.employeeCount} empl. · lvl. {s.avgLevel.toFixed(1)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
});
GapAnalysis.displayName = "GapAnalysis";

// ── Main SkillsDashboard ────────────────────────────────────────────────────
export const SkillsDashboard = memo(({ employees, skillsData }: any) => {
  const { catalog } = skillsData;

  const matchedCount = useMemo(() => employees.filter((e: any) => e.skills && e.skills.length > 0).length, [employees]);

  const avgLevel = useMemo(() => {
    const empsWithSkills = employees.filter((e: any) => e.avgSkillLevel > 0);
    if (empsWithSkills.length === 0) return 0;
    return empsWithSkills.reduce((s: number, e: any) => s + e.avgSkillLevel, 0) / empsWithSkills.length;
  }, [employees]);

  const maxEmpCount = catalog.allSkills.length > 0 ? catalog.allSkills[0].employeeCount : 1;

  return (
    <Box sx={{ "& > * + *": { mt: 3 } }}>
      {/* KPI row */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2 }}>
        <KPICard
          icon={EmojiEventsIcon}
          title="Distinct skills"
          value={catalog.allSkills.length}
          subtitle={`${catalog.categories.length} categories`}
          color="purple"
        />
        <KPICard
          icon={GroupIcon}
          title="Employees with skills"
          value={matchedCount}
          subtitle={`out of ${employees.length} (${employees.length > 0 ? Math.round((matchedCount / employees.length) * 100) : 0}%)`}
          color="blue"
        />
        <KPICard
          icon={BarChartIcon}
          title="Average level"
          value={avgLevel.toFixed(1)}
          subtitle="on a scale of 0 to 4"
          color="green"
        />
        <KPICard
          icon={TrackChangesIcon}
          title="Coverage"
          value={`${employees.length > 0 ? Math.round((matchedCount / employees.length) * 100) : 0}%`}
          subtitle="employees with data"
          color="amber"
        />
      </Box>

      {/* Search panel */}
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.5 }}>
        <Typography
          sx={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "text.primary",
            mb: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} />
          Search by skill
        </Typography>
        <SkillSearchPanel employees={employees} />
      </Paper>

      {/* Two columns: category chart + top skills */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2.5 }}>
        <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.5 }}>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "text.primary", mb: 2 }}>
            Distribution by category
          </Typography>
          <SkillsCategoryChart allSkills={catalog.allSkills} />
        </Paper>
        <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.5 }}>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "text.primary", mb: 2 }}>
            Top 20 skills
          </Typography>
          <TopSkillsList allSkills={catalog.allSkills} maxCount={maxEmpCount} />
        </Paper>
      </Box>

      {/* Coverage matrix */}
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.5 }}>
        <SkillsCoverageMatrix employees={employees} allSkills={catalog.allSkills} />
      </Paper>

      {/* Gap analysis */}
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.5 }}>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "text.primary", mb: 2 }}>
          Gap Analysis
        </Typography>
        <GapAnalysis allSkills={catalog.allSkills} employees={employees} />
      </Paper>
    </Box>
  );
});
SkillsDashboard.displayName = "SkillsDashboard";
