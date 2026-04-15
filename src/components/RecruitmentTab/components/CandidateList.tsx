/**
 * CandidateList — Table triable/filtrable/paginée des candidats, inspirée d'OpportunityList.
 * Expand/collapse par ligne, recherche globale, tri par colonnes.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import TablePagination from "@mui/material/TablePagination";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import LinkIcon from "@mui/icons-material/Link";
import { alpha, useTheme } from "@mui/material/styles";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import type { RecruitmentCandidate } from "../../../types/recruitment";
import { parseJobPostings } from "../utils/serviceLineParser";
import { computeProcessDurationDays } from "../utils/calculations";
import { keyframes, timing, easing } from "../../../styles/animations";

// ── Grid layout ──
const GRID_TEMPLATE = "36px minmax(140px, 1.2fr) 100px minmax(100px, 1fr) 100px 80px 90px 36px";
const GRID_GAP = "24px";

// ── Types ──
type SortKey = "name" | "poste" | "serviceLine" | "date" | "age" | "status" | "note";
type SortDir = "asc" | "desc";

interface Props {
  data: RecruitmentCandidate[];
  title?: string;
}

// ── STATUS CHIP ──
const STATUS_CONFIG: Record<string, { label: string; color: "error" | "info" | "success" | "default" }> = {
  rejected: { label: "Rejected", color: "error" },
  active: { label: "Active", color: "info" },
  hired: { label: "Hired", color: "success" },
};

// ── TIMELINE ──
interface TimelineEvent {
  date: string; // YYYY-MM-DD
  label: string;
  detail: string;
  type: "creation" | "hr" | "recruiter" | "evaluation" | "decision";
  decision?: string; // GO / NO GO
}

function buildTimeline(c: RecruitmentCandidate): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // 1. Creation
  if (c.creationDate) {
    events.push({ date: c.creationDate.slice(0, 10), label: "Application", detail: c.poste, type: "creation" });
  }

  // 2. HR Interview
  if (c.hrInterviewDate) {
    events.push({
      date: c.hrInterviewDate,
      label: "HR Interview",
      detail: c.hrInterviewerName || "",
      type: "hr",
      decision: c.hrInterviewDecision || undefined,
    });
  }

  // 3. Evaluation
  if (c.evaluatedBy) {
    // No separate date, use as context
    events.push({ date: "", label: "Evaluation", detail: c.evaluatedBy, type: "evaluation" });
  }

  // 4. Recruiters (in date order)
  const recs = [
    { name: c.recruiter1, date: c.recruiter1Date, decision: c.recruiter1Decision },
    { name: c.recruiter2, date: c.recruiter2Date, decision: c.recruiter2Decision },
    { name: c.recruiter3, date: c.recruiter3Date, decision: c.recruiter3Decision },
  ].filter((r) => r.name);

  for (const r of recs) {
    events.push({
      date: r.date || "",
      label: "Interview",
      detail: r.name,
      type: "recruiter",
      decision: r.decision || undefined,
    });
  }

  // 5. Final decision (from status + lastActivity)
  if (c.status === "hired") {
    events.push({
      date: c.lastActivity?.slice(0, 10) || "",
      label: "Hired",
      detail: "",
      type: "decision",
      decision: "GO",
    });
  } else if (c.status === "rejected") {
    events.push({
      date: c.lastActivity?.slice(0, 10) || "",
      label: "Rejected",
      detail: "",
      type: "decision",
      decision: "NO GO",
    });
  }

  // Sort by date (events without dates go to position based on type)
  return events.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
}

const TYPE_COLORS: Record<string, string> = {
  creation: "#FF3D47",
  hr: "#806659",
  recruiter: "#CC2931",
  evaluation: "#98847A",
  decision: "#10B981",
};

const CandidateTimeline = React.memo(
  ({ candidate }: { candidate: RecruitmentCandidate & { _serviceLines: string[] } }) => {
    const theme = useTheme();
    const events = useMemo(() => buildTimeline(candidate), [candidate]);

    if (events.length <= 1) return null;

    const fmtDate = (d: string) => {
      if (!d) return "";
      const [y, m, day] = d.split("-");
      return `${day}/${m}/${y}`;
    };

    return (
      <Box sx={{ mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          Parcours candidat
        </Typography>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0, overflow: "auto", pb: 1 }}>
          {events.map((ev, i) => {
            const color =
              ev.decision === "NO GO"
                ? theme.palette.error.main
                : ev.decision === "GO"
                  ? theme.palette.success.main
                  : TYPE_COLORS[ev.type] || theme.palette.primary.main;
            const isFinal = ev.type === "decision";
            const circleSize = isFinal ? 16 : 12;

            return (
              <React.Fragment key={i}>
                {/* Step */}
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 90,
                    maxWidth: 130,
                    px: 0.5,
                  }}
                >
                  {/* Label */}
                  <Typography
                    variant="caption"
                    fontWeight={isFinal ? 700 : 500}
                    color={color}
                    sx={{ fontSize: 10, mb: 0.5, textAlign: "center", lineHeight: 1.2 }}
                  >
                    {ev.label}
                  </Typography>
                  {/* Circle */}
                  <Box
                    sx={{
                      width: circleSize,
                      height: circleSize,
                      borderRadius: "50%",
                      bgcolor: color,
                      boxShadow: isFinal ? `0 0 8px ${alpha(color, 0.5)}` : "none",
                      transition: "all 0.2s",
                      flexShrink: 0,
                    }}
                  />
                  {/* Detail */}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: 10, mt: 0.5, textAlign: "center", lineHeight: 1.2, maxWidth: 120 }}
                    noWrap={false}
                  >
                    {ev.detail}
                  </Typography>
                  {/* Date */}
                  {ev.date && (
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: 9, mt: 0.25 }}>
                      {fmtDate(ev.date)}
                    </Typography>
                  )}
                  {/* Decision badge */}
                  {ev.decision && (
                    <Chip
                      label={ev.decision}
                      size="small"
                      color={ev.decision === "GO" ? "success" : "error"}
                      sx={{ fontSize: 9, height: 16, mt: 0.5, fontWeight: 700 }}
                    />
                  )}
                </Box>
                {/* Connector */}
                {i < events.length - 1 && (
                  <Box
                    sx={{
                      width: 32,
                      height: 2,
                      bgcolor: alpha(theme.palette.text.disabled, 0.3),
                      alignSelf: "center",
                      mt: 1.8, // align with circles
                      flexShrink: 0,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Box>
      </Box>
    );
  }
);
CandidateTimeline.displayName = "CandidateTimeline";

// ── LINK TO STAFFING NEED ──
const LinkToNeedSection = memo(
  ({
    candidateId,
    candidateName,
    candidateGrade,
  }: {
    candidateId: string;
    candidateName: string;
    candidateGrade: string;
  }) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const allNeeds = useUserDataStore((s) => s.staffingNeeds);

    // Flatten all needs across opportunities
    const openNeeds = useMemo(() => {
      const result: Array<{
        id: string;
        opportunityId: string;
        grade: string;
        startDate: string;
        endDate: string;
        status?: string;
      }> = [];
      Object.entries(allNeeds).forEach(([oppId, needs]) => {
        needs.forEach((n) => {
          if (!n.status || n.status === "open" || n.status === "partiallyFilled") {
            result.push({
              id: n.id,
              opportunityId: oppId,
              grade: n.grade,
              startDate: n.startDate,
              endDate: n.endDate,
              status: n.status,
            });
          }
        });
      });
      return result;
    }, [allNeeds]);

    const handleLink = async (needId: string) => {
      try {
        const { apiFetch } = await import("../../../services/api");
        const API_BASE = import.meta.env.VITE_API_BASE || "/api";
        await apiFetch(`${API_BASE}/staffing/needs/${needId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignedTo: candidateName }),
        });
      } catch {
        /* best effort */
      }
      setAnchorEl(null);
    };

    if (openNeeds.length === 0) return null;

    return (
      <Box sx={{ mt: 1.5 }}>
        <Button
          size="small"
          startIcon={<LinkIcon />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ textTransform: "none", fontSize: "0.8rem" }}
        >
          Link to Staffing Need
        </Button>
        <Popover
          open={!!anchorEl}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <Box sx={{ p: 1, maxHeight: 300, overflow: "auto", minWidth: 280 }}>
            <Typography variant="caption" color="text.secondary" sx={{ px: 1, pb: 0.5, display: "block" }}>
              Open staffing needs ({openNeeds.length})
            </Typography>
            {openNeeds.map((need) => (
              <MenuItem key={need.id} onClick={() => handleLink(need.id)} sx={{ fontSize: "0.8rem", py: 0.75 }}>
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {need.grade} — {need.startDate} → {need.endDate}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Opp: {need.opportunityId}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Box>
        </Popover>
      </Box>
    );
  }
);
LinkToNeedSection.displayName = "LinkToNeedSection";

// ── ROW ──
const CandidateRow = React.memo(
  ({
    candidate,
    index,
  }: {
    candidate: RecruitmentCandidate & { _serviceLines: string[]; _age: number | null };
    index: number;
  }) => {
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    const statusConf = STATUS_CONFIG[candidate.status] || { label: candidate.status, color: "default" as const };

    const formatDate = (d: string) => {
      if (!d) return "-";
      return d.slice(0, 10).split("-").reverse().join("/");
    };

    return (
      <Box
        sx={{
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        {/* Main row */}
        <Box
          onClick={() => setOpen((o) => !o)}
          sx={{
            display: "grid",
            gridTemplateColumns: GRID_TEMPLATE,
            columnGap: GRID_GAP,
            alignItems: "center",
            px: 2.5,
            py: 1.5,
            cursor: "pointer",
            borderRadius: 3,
            bgcolor: open ? alpha(theme.palette.primary.main, 0.08) : "#f8f9fa",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
            animation: `fadeInUp ${timing.normal} ${easing.elegant} ${Math.min(index, 20) * 50}ms both`,
            ...keyframes.fadeInUp,
            transition: `background-color ${timing.fast} ${easing.elegant}, box-shadow ${timing.fast} ${easing.elegant}`,
            "&:hover": {
              bgcolor: open ? alpha(theme.palette.primary.main, 0.12) : "#eceef0",
            },
          }}
        >
          {/* Expand */}
          <IconButton size="small" sx={{ p: 0.25 }}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>

          {/* Name */}
          <Typography variant="body2" fontWeight={600} noWrap>
            {candidate.firstName} {candidate.lastName}
          </Typography>

          {/* Poste / Grade */}
          <Chip
            label={candidate.gradeBucket}
            size="small"
            variant="outlined"
            sx={{
              fontSize: 11,
              height: 22,
              borderColor:
                candidate.gradeBucket === "Consultant+"
                  ? theme.palette.warning.main
                  : candidate.gradeBucket === "Analyst"
                    ? theme.palette.info.main
                    : theme.palette.text.disabled,
              color:
                candidate.gradeBucket === "Consultant+"
                  ? theme.palette.warning.dark
                  : candidate.gradeBucket === "Analyst"
                    ? theme.palette.info.dark
                    : theme.palette.text.secondary,
            }}
          />

          {/* Service Lines (first 2) */}
          <Box sx={{ display: "flex", gap: 0.5, overflow: "hidden" }}>
            {candidate._serviceLines.slice(0, 2).map((sl) => (
              <Chip
                key={sl}
                label={sl.length > 18 ? sl.slice(0, 16) + "..." : sl}
                size="small"
                sx={{ fontSize: 10, height: 20 }}
              />
            ))}
            {candidate._serviceLines.length > 2 && (
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: "20px" }}>
                +{candidate._serviceLines.length - 2}
              </Typography>
            )}
          </Box>

          {/* Date */}
          <Typography variant="body2" color="text.secondary" fontSize={12}>
            {formatDate(candidate.creationDate)}
          </Typography>

          {/* Age */}
          <Typography
            variant="body2"
            fontSize={12}
            fontWeight={candidate._age && candidate._age > 90 ? 700 : 400}
            color={
              candidate._age && candidate._age > 90
                ? "warning.main"
                : candidate._age && candidate._age > 30
                  ? "text.primary"
                  : "text.secondary"
            }
            sx={{ textAlign: "right" }}
          >
            {candidate._age != null ? `${candidate._age}j` : "-"}
          </Typography>

          {/* Status */}
          <Chip
            label={statusConf.label}
            size="small"
            color={statusConf.color}
            sx={{ fontSize: 11, height: 22, fontWeight: 600 }}
          />

          {/* Note */}
          <Box sx={{ textAlign: "right" }}>
            {candidate.note != null ? (
              <Typography variant="body2" fontWeight={600} fontSize={13}>
                {candidate.note.toFixed(1)}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.disabled">
                -
              </Typography>
            )}
          </Box>
        </Box>

        {/* Expanded details */}
        <Collapse
          in={open}
          timeout={{ enter: 300, exit: 200 }}
          unmountOnExit
          sx={{ transition: `height ${timing.normal} ${easing.elegant} !important` }}
        >
          <Box
            sx={{
              animation: open ? `fadeIn ${timing.normal} ${easing.elegant} both` : "none",
              ...keyframes.fadeIn,
              px: 2.5,
              pb: 1.5,
            }}
          >
            <Divider sx={{ mb: 2.5 }} />

            {/* ── Timeline ── */}
            <CandidateTimeline candidate={candidate} />

            {/* ── Details grid ── */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 3, mt: 2.5 }}>
              {/* Contact info */}
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}
                >
                  <PersonOutlineIcon sx={{ fontSize: 16 }} /> Contact
                </Typography>
                {candidate.email && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                    <EmailOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                    <Typography variant="body2" fontSize={13}>
                      {candidate.email}
                    </Typography>
                  </Box>
                )}
                {candidate.phone && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                    <PhoneOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                    <Typography variant="body2" fontSize={13}>
                      {candidate.phone}
                    </Typography>
                  </Box>
                )}
                {candidate.linkedinUrl && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <OpenInNewIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                    <Typography
                      variant="body2"
                      fontSize={13}
                      component="a"
                      href={candidate.linkedinUrl}
                      target="_blank"
                      rel="noopener"
                      sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                    >
                      LinkedIn
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Recruitment info */}
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}
                >
                  <WorkOutlineIcon sx={{ fontSize: 16 }} /> Recruitment
                </Typography>
                {candidate.grade && (
                  <Typography variant="body2" fontSize={13} sx={{ mb: 0.5 }}>
                    <strong>ATS Grade:</strong> {candidate.grade}
                  </Typography>
                )}
                {candidate.candidateStatus && (
                  <Typography variant="body2" fontSize={13} sx={{ mb: 0.5 }}>
                    <strong>Channel:</strong> {candidate.candidateStatus}
                  </Typography>
                )}
                {candidate.tags && (
                  <Typography variant="body2" fontSize={13} sx={{ mb: 0.5 }}>
                    <strong>Tags:</strong> {candidate.tags}
                  </Typography>
                )}
                {candidate.note != null && (
                  <Typography variant="body2" fontSize={13}>
                    <strong>Score:</strong> {candidate.note.toFixed(1)}
                  </Typography>
                )}
              </Box>

              {/* Service lines */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Job Offers
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {candidate._serviceLines.map((sl) => (
                    <Chip key={sl} label={sl} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                  ))}
                  {candidate._serviceLines.length === 0 && (
                    <Typography variant="body2" color="text.disabled" fontSize={12}>
                      None
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Link to Staffing Need */}
            <LinkToNeedSection
              candidateId={candidate.id}
              candidateName={`${candidate.firstName} ${candidate.lastName}`}
              candidateGrade={candidate.gradeBucket}
            />
          </Box>
        </Collapse>
      </Box>
    );
  }
);
CandidateRow.displayName = "CandidateRow";

// ── MAIN COMPONENT ──
const CandidateList = React.memo(({ data, title = "Candidates" }: Props) => {
  const theme = useTheme();

  // Search
  const [searchText, setSearchText] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());

  const toggleStatus = (s: string) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
    setPage(0);
  };

  // Enrich candidates with computed fields
  const enriched = useMemo(
    () =>
      data.map((c) => ({
        ...c,
        _serviceLines: parseJobPostings(c.jobPostings),
        _age: computeProcessDurationDays(c),
      })),
    [data]
  );

  // Filter
  const filtered = useMemo(() => {
    let result = enriched;
    if (statusFilter.size > 0) {
      result = result.filter((c) => statusFilter.has(c.status));
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (c) =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.poste.toLowerCase().includes(q) ||
          c.gradeBucket.toLowerCase().includes(q) ||
          c._serviceLines.some((sl) => sl.toLowerCase().includes(q)) ||
          c.candidateStatus.toLowerCase().includes(q) ||
          c.tags.toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, searchText, statusFilter]);

  // Sort
  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("desc");
      return key;
    });
    setPage(0);
  }, []);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
        case "poste":
          return dir * a.gradeBucket.localeCompare(b.gradeBucket);
        case "serviceLine":
          return dir * (a._serviceLines[0] || "").localeCompare(b._serviceLines[0] || "");
        case "date":
          return dir * a.creationDate.localeCompare(b.creationDate);
        case "age":
          return dir * ((a._age ?? 0) - (b._age ?? 0));
        case "status":
          return dir * a.status.localeCompare(b.status);
        case "note":
          return dir * ((a.note ?? -1) - (b.note ?? -1));
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Paginate
  const paginated = useMemo(
    () => sorted.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
    [sorted, page, rowsPerPage]
  );

  // Reset page on search change
  useEffect(() => setPage(0), [searchText]);

  // Status counts for badges
  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of enriched) {
      map.set(c.status, (map.get(c.status) || 0) + 1);
    }
    return map;
  }, [enriched]);

  const hasFilters = searchText.length > 0 || statusFilter.size > 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        width: "100%",
        overflow: "hidden",
        borderRadius: "24px",
        p: 3,
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        "& *": { scrollbarWidth: "none", msOverflowStyle: "none" },
      }}
    >
      {/* ── Toolbar ── */}
      <Box sx={{ display: "flex", gap: 2, mb: 2.5, flexWrap: "wrap", alignItems: "center" }}>
        <Typography variant="h6" fontWeight={600} sx={{ mr: 1 }}>
          {title}
        </Typography>
        <Chip label={filtered.length} size="small" color="primary" variant="outlined" />

        {/* Search */}
        <TextField
          placeholder="Search..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          size="small"
          sx={{ width: 200, ml: "auto" }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ fontSize: 18, color: "text.secondary", mr: 0.5 }} />,
            endAdornment: searchText ? (
              <IconButton size="small" onClick={() => setSearchText("")} sx={{ p: 0.25 }}>
                <ClearIcon sx={{ fontSize: 16 }} />
              </IconButton>
            ) : null,
          }}
        />

        {/* Status chips */}
        {(["active", "hired", "rejected"] as const).map((s) => {
          const conf = STATUS_CONFIG[s];
          const count = statusCounts.get(s) || 0;
          const active = statusFilter.has(s);
          return (
            <Chip
              key={s}
              label={`${conf.label} (${count})`}
              size="small"
              variant={active ? "filled" : "outlined"}
              color={active ? conf.color : "default"}
              onClick={() => toggleStatus(s)}
              sx={{ fontWeight: active ? 600 : 400 }}
            />
          );
        })}

        {hasFilters && (
          <Chip
            label="Reset"
            size="small"
            onDelete={() => {
              setSearchText("");
              setStatusFilter(new Set());
            }}
          />
        )}
      </Box>

      {/* ── Header ── */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: GRID_TEMPLATE,
          columnGap: GRID_GAP,
          alignItems: "center",
          px: 2,
          py: 1,
          borderBottom: `2px solid ${theme.palette.divider}`,
          mb: 1.5,
        }}
      >
        <Box /> {/* expand placeholder */}
        <TableSortLabel active={sortKey === "name"} direction={sortDir} onClick={() => handleSort("name")}>
          <Typography variant="caption" fontWeight={600}>
            Name
          </Typography>
        </TableSortLabel>
        <TableSortLabel active={sortKey === "poste"} direction={sortDir} onClick={() => handleSort("poste")}>
          <Typography variant="caption" fontWeight={600}>
            Level
          </Typography>
        </TableSortLabel>
        <TableSortLabel
          active={sortKey === "serviceLine"}
          direction={sortDir}
          onClick={() => handleSort("serviceLine")}
        >
          <Typography variant="caption" fontWeight={600}>
            Service Line
          </Typography>
        </TableSortLabel>
        <TableSortLabel active={sortKey === "date"} direction={sortDir} onClick={() => handleSort("date")}>
          <Typography variant="caption" fontWeight={600}>
            Date
          </Typography>
        </TableSortLabel>
        <TableSortLabel active={sortKey === "age"} direction={sortDir} onClick={() => handleSort("age")}>
          <Typography variant="caption" fontWeight={600} sx={{ textAlign: "right", display: "block" }}>
            Age
          </Typography>
        </TableSortLabel>
        <TableSortLabel active={sortKey === "status"} direction={sortDir} onClick={() => handleSort("status")}>
          <Typography variant="caption" fontWeight={600}>
            Status
          </Typography>
        </TableSortLabel>
        <TableSortLabel active={sortKey === "note"} direction={sortDir} onClick={() => handleSort("note")}>
          <Typography variant="caption" fontWeight={600} sx={{ textAlign: "right", display: "block" }}>
            Note
          </Typography>
        </TableSortLabel>
      </Box>

      {/* ── Rows ── */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: "12px", minHeight: 200 }}>
        {paginated.length === 0 ? (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography color="text.secondary">No candidates match the filters</Typography>
          </Box>
        ) : (
          paginated.map((c, i) => <CandidateRow key={c.id} candidate={c} index={i} />)
        )}
      </Box>

      {/* ── Pagination ── */}
      <TablePagination
        rowsPerPageOptions={[15, 25, 50, 100]}
        component="div"
        count={filtered.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        sx={{
          mt: 1,
          "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.875rem" },
        }}
      />
    </Paper>
  );
});
CandidateList.displayName = "CandidateList";

export default CandidateList;
