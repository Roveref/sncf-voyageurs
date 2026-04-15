/**
 * StaffingNeedsOverview
 * Consolidated view of all staffing needs across opportunities.
 * Reads staffing needs from useUserDataStore and cross-references
 * with pipeline opportunities for context.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useComputedStore } from "../../../../stores/useComputedStore";
import { useUserDataStore } from "../../../../stores/useUserDataStore";
import { safeJsonParse } from "../../../../utils/safeJson";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import { alpha, useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import EventIcon from "@mui/icons-material/Event";
import BusinessIcon from "@mui/icons-material/Business";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { easing } from "../../../../styles/animations";
import { getGradeColor } from "../../constants";

const GRADE_COLORS: Record<string, string> = {
  Intern: "#9ca3af",
  Analyst: "#6b7280",
  Consultant: "#3b82f6",
  "Senior Consultant": "#2563eb",
  Manager: "#f59e0b",
  "Senior Manager": "#d97706",
  Director: "#8b5cf6",
  Partner: "#ef4444",
};

// Read all staffing needs from store
const readAllStaffingNeeds = () => {
  const all: any[] = [];
  Object.entries(useUserDataStore.getState().staffingNeeds).forEach(([opportunityId, items]) => {
    items.forEach((n) => all.push({ ...n, opportunityId: n.opportunityId || opportunityId }));
  });
  return all;
};

// Read staffing employee index
const readStaffingIndex = () => {
  const raw = localStorage.getItem("staffing_employee_index");
  return raw ? safeJsonParse<any>(raw, null) : null;
};

const StaffingNeedsOverview = ({
  sharedData = [],
  onNavigateToTab,
}: {
  sharedData?: any[];
  onNavigateToTab?: (tab: number) => void;
}) => {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [allNeeds, setAllNeeds] = useState(readAllStaffingNeeds);
  const staffingIndexVersion = useComputedStore((s) => s.staffingIndexVersion);
  const staffingIndex = useMemo(readStaffingIndex, [staffingIndexVersion]);
  const [expandedOpps, setExpandedOpps] = useState<Set<string>>(new Set());

  // Re-read from store when staffingNeeds changes
  const storeNeedsMap = useUserDataStore((s) => s.staffingNeeds);
  useEffect(() => {
    setAllNeeds(readAllStaffingNeeds());
  }, [storeNeedsMap]);

  // Build opportunity lookup from sharedData
  const oppMap = useMemo(() => {
    const map: Record<string, any> = {};
    sharedData.forEach((opp: any) => {
      const id = opp.opportunityId;
      if (id) map[id] = opp;
    });
    return map;
  }, [sharedData]);

  // Group needs by opportunity, apply search filter
  const { grouped, stats } = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const filtered = allNeeds.filter((n) => {
      if (!lowerSearch) return true;
      const opp = oppMap[n.opportunityId];
      const oppName = (opp?.opportunity || opp?.opportunity || "").toLowerCase();
      const account = (opp?.account || "").toLowerCase();
      const gradeLabel = (n.grade || "").toLowerCase();
      const skills = (n.skills || []).join(" ").toLowerCase();
      return (
        oppName.includes(lowerSearch) ||
        account.includes(lowerSearch) ||
        gradeLabel.includes(lowerSearch) ||
        skills.includes(lowerSearch) ||
        n.opportunityId.toLowerCase().includes(lowerSearch)
      );
    });

    const byOpp: Record<string, any[]> = {};
    filtered.forEach((n: any) => {
      const id = n.opportunityId;
      if (!byOpp[id]) byOpp[id] = [];
      byOpp[id].push(n);
    });

    const totalPeople = filtered.reduce((sum: number, n: any) => sum + (n.quantity || 1), 0);
    const profileBreakdown: Record<string, number> = {};
    filtered.forEach((n: any) => {
      const key = n.grade || "Unknown";
      profileBreakdown[key] = (profileBreakdown[key] || 0) + (n.quantity || 1);
    });

    return {
      grouped: byOpp,
      stats: {
        totalNeeds: filtered.length,
        totalPeople,
        totalOpps: Object.keys(byOpp).length,
        allNeeds: allNeeds.length,
        profileBreakdown,
      },
    };
  }, [allNeeds, search, oppMap]);

  // Get current staffing count for an opportunity
  const getStaffedCount = (opportunityId: string) => {
    if (!staffingIndex) return 0;
    const opp = oppMap[opportunityId];
    const jobCode = opp?.jobCode;
    const lookupKeys: string[] = [];
    if (jobCode) lookupKeys.push(String(jobCode).trim());
    lookupKeys.push(String(opportunityId).trim());
    const seen = new Set();
    let count = 0;
    for (const key of lookupKeys) {
      const entries = staffingIndex[key];
      if (!entries) continue;
      for (const entry of entries) {
        if (!seen.has(entry.empId)) {
          seen.add(entry.empId);
          count++;
        }
      }
    }
    return count;
  };

  const toggleOpp = (opportunityId: string) => {
    setExpandedOpps((prev) => {
      const next = new Set(prev);
      next.has(opportunityId) ? next.delete(opportunityId) : next.add(opportunityId);
      return next;
    });
  };

  const opportunityIds = Object.keys(grouped);

  if (allNeeds.length === 0) {
    return (
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 4, textAlign: "center", bgcolor: "background.paper" }}>
        <GroupsIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1.5 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No staffing needs defined
        </Typography>
        <Typography variant="body2" color="text.disabled">
          Define your needs in the "Staffing" tab of each opportunity (Pipeline)
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, bgcolor: "background.paper", overflow: "hidden" }}>
      {/* Header */}
      <Box
        sx={{
          p: 2.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.04)}, ${alpha(theme.palette.primary.main, 0.04)})`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <GroupsIcon sx={{ fontSize: 22, color: theme.palette.info.main }} />
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1rem" }}>
              Staffing needs
            </Typography>
            <Chip
              label={`${stats.totalPeople} person${stats.totalPeople > 1 ? "s" : ""}`}
              size="small"
              color="info"
              sx={{ fontWeight: 600, fontSize: "0.75rem", height: 24 }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {stats.totalOpps} opportunit{stats.totalOpps > 1 ? "ies" : "y"}
          </Typography>
        </Box>

        {/* Profile breakdown chips */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
          {Object.entries(stats.profileBreakdown)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([grade, count]) => {
              const gc = getGradeColor(grade);
              const fallbackColor = GRADE_COLORS[grade] || gc.text || "#6b7280";
              return (
                <Chip
                  key={grade}
                  icon={<PersonIcon sx={{ fontSize: 14 }} />}
                  label={`${grade} x${count}`}
                  size="small"
                  sx={{
                    fontSize: "0.7rem",
                    height: 22,
                    fontWeight: 600,
                    bgcolor: alpha(fallbackColor, 0.1),
                    color: fallbackColor,
                    border: `1px solid ${alpha(fallbackColor, 0.2)}`,
                  }}
                />
              );
            })}
        </Box>

        {/* Search */}
        <TextField
          size="small"
          placeholder="Search by opportunity, account, grade, skills…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "background.paper", fontSize: "0.85rem" },
          }}
        />
      </Box>

      {/* List */}
      <Box sx={{ maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
        {opportunityIds.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No results for "{search}"
            </Typography>
          </Box>
        ) : (
          opportunityIds.map((opportunityId) => {
            const needs = grouped[opportunityId];
            const opp = oppMap[opportunityId];
            const oppName = opp?.opportunity || opp?.opportunity || opportunityId;
            const account = opp?.account || "";
            const jobCode = opp?.jobCode || "";
            const isExpanded = expandedOpps.has(opportunityId);
            const staffedCount = getStaffedCount(opportunityId);
            const totalNeeded = needs.reduce((s: number, n: any) => s + (n.quantity || 1), 0);

            return (
              <Box key={opportunityId} sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                {/* Opportunity header */}
                <Box
                  onClick={() => toggleOpp(opportunityId)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 2.5,
                    py: 1.5,
                    cursor: "pointer",
                    transition: `background-color 0.3s ${easing.elegant}`,
                    "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) },
                  }}
                >
                  <IconButton size="small" sx={{ p: 0 }}>
                    <ExpandMoreIcon
                      sx={{
                        fontSize: 18,
                        color: "text.secondary",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: `transform 0.3s ${easing.elegant}`,
                      }}
                    />
                  </IconButton>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {oppName}
                      </Typography>
                      {jobCode && (
                        <Chip
                          label={jobCode}
                          size="small"
                          sx={{ fontSize: "0.65rem", height: 18, color: "text.secondary", bgcolor: "action.hover" }}
                        />
                      )}
                    </Box>
                    {account && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
                        <BusinessIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {account}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Right side: staffing progress */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Tooltip title={`${staffedCount} staffed / ${totalNeeded} need${totalNeeded > 1 ? "s" : ""}`}>
                      <Chip
                        label={`${staffedCount}/${totalNeeded}`}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          height: 24,
                          bgcolor:
                            staffedCount >= totalNeeded
                              ? alpha("#10b981", 0.1)
                              : staffedCount > 0
                                ? alpha("#f59e0b", 0.1)
                                : alpha("#ef4444", 0.1),
                          color: staffedCount >= totalNeeded ? "#10b981" : staffedCount > 0 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </Tooltip>
                    {opp && onNavigateToTab && (
                      <Tooltip title="View in Pipeline">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToTab(0);
                          }}
                          sx={{ p: 0.5, color: "text.disabled", "&:hover": { color: "primary.main" } }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                {/* Expanded: staffing needs details */}
                <Collapse in={isExpanded}>
                  <Box sx={{ px: 2.5, pb: 2 }}>
                    {needs.map((need: any) => (
                      <Box
                        key={need.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          px: 2,
                          py: 1,
                          mb: 0.5,
                          borderRadius: 1.5,
                          bgcolor: alpha(theme.palette.info.main, 0.02),
                          border: `1px solid ${alpha(theme.palette.info.main, 0.08)}`,
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 28,
                            height: 28,
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            bgcolor: alpha(
                              GRADE_COLORS[need.grade] || getGradeColor(need.grade).text || "#6b7280",
                              0.15
                            ),
                            color: GRADE_COLORS[need.grade] || getGradeColor(need.grade).text || "#6b7280",
                          }}
                        >
                          {need.quantity || 1}
                        </Avatar>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.82rem" }}>
                            {need.grade}
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                            {(need.startDate || need.endDate) && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <EventIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                                <Typography variant="caption" color="text.secondary">
                                  {need.startDate ? new Date(need.startDate).toLocaleDateString("fr-FR") : "?"}
                                  {" → "}
                                  {need.endDate ? new Date(need.endDate).toLocaleDateString("fr-FR") : "?"}
                                </Typography>
                              </Box>
                            )}
                            {need.skills?.length > 0 &&
                              need.skills.map((s: string) => (
                                <Chip
                                  key={s}
                                  label={s}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: "0.6rem",
                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                    color: theme.palette.primary.main,
                                  }}
                                />
                              ))}
                          </Box>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            );
          })
        )}
      </Box>
    </Paper>
  );
};

export default StaffingNeedsOverview;
