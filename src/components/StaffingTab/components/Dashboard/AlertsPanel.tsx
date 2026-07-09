import React, { memo, useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import GroupIcon from "@mui/icons-material/Group";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { ALERT_TYPES, ALERT_SEVERITY, countAlertsBySeverity, filterAlertsBySeverity } from "../../utils/alertsUtils";
import { easing } from "../../../../styles/animations";

// ─── Config ──────────────────────────────────────────────────────────────────
const ALERT_CONFIG = {
  [ALERT_TYPES.OVERLOAD]: {
    icon: TrendingUpIcon,
    label: "Overloaded",
    bgColor: "#fef2f2",
    borderColor: "#fecaca",
    textColor: "#991b1b",
    iconColor: "#ef4444",
    headerBg: "#fef2f2",
    headerHoverBg: "#fee2e2",
  },
  [ALERT_TYPES.UNDERUTILIZATION]: {
    icon: TrendingDownIcon,
    label: "Underutilized",
    bgColor: "#fefce8",
    borderColor: "#fde68a",
    textColor: "#854d0e",
    iconColor: "#eab308",
    headerBg: "#fefce8",
    headerHoverBg: "#fef9c3",
  },
  [ALERT_TYPES.END_MISSION_SOON]: {
    icon: AccessTimeIcon,
    label: "Assignment ending soon",
    bgColor: "#fff7ed",
    borderColor: "#fed7aa",
    textColor: "#9a3412",
    iconColor: "#f97316",
    headerBg: "#fff7ed",
    headerHoverBg: "#ffedd5",
  },
  [ALERT_TYPES.NO_ASSIGNMENT]: {
    icon: GroupIcon,
    label: "No billable assignment",
    bgColor: "#faf5ff",
    borderColor: "#e9d5ff",
    textColor: "#6b21a8",
    iconColor: "#a855f7",
    headerBg: "#faf5ff",
    headerHoverBg: "#f3e8ff",
  },
  [ALERT_TYPES.HIGH_AVAILABILITY]: {
    icon: InfoIcon,
    label: "High availability",
    bgColor: "#eff6ff",
    borderColor: "#bfdbfe",
    textColor: "#1e40af",
    iconColor: "#3b82f6",
    headerBg: "#eff6ff",
    headerHoverBg: "#dbeafe",
  },
};

const SEVERITY_CONFIG = {
  [ALERT_SEVERITY.CRITICAL]: { dotColor: "#ef4444", label: "Critical", textColor: "#b91c1c", bgColor: "#fee2e2" },
  [ALERT_SEVERITY.WARNING]: { dotColor: "#eab308", label: "Warning", textColor: "#a16207", bgColor: "#fef9c3" },
  [ALERT_SEVERITY.INFO]: { dotColor: "#3b82f6", label: "Info", textColor: "#1d4ed8", bgColor: "#dbeafe" },
};

// Severity sort order: critical first
const SEV_ORDER = { [ALERT_SEVERITY.CRITICAL]: 0, [ALERT_SEVERITY.WARNING]: 1, [ALERT_SEVERITY.INFO]: 2 };

// Group display order
const TYPE_ORDER = [
  ALERT_TYPES.OVERLOAD,
  ALERT_TYPES.END_MISSION_SOON,
  ALERT_TYPES.NO_ASSIGNMENT,
  ALERT_TYPES.UNDERUTILIZATION,
  ALERT_TYPES.HIGH_AVAILABILITY,
];

// ─── Alert row (compact, fully clickable) ────────────────────────────────────
const AlertRow = memo(({ alert, onNavigate }: any) => {
  const sev = SEVERITY_CONFIG[alert.severity];
  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: 1,
        borderRadius: 3,
        bgcolor: "white",
        borderColor: "divider",
        transition: `background-color 0.3s ${easing.elegant}, border-color 0.3s ${easing.elegant}`,
        ...(onNavigate && {
          cursor: "pointer",
          "&:hover": { borderColor: "primary.light", bgcolor: "rgba(59,130,246,0.04)" },
        }),
        ...(!onNavigate && {
          "&:hover": { borderColor: "grey.200" },
        }),
      }}
      onClick={onNavigate ? () => onNavigate(alert.employee.empId) : undefined}
      title={onNavigate ? `View ${alert.employee.name}` : undefined}
    >
      <Box
        component="span"
        sx={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, bgcolor: sev.dotColor }}
        title={sev.label}
      />
      <Typography variant="body2" sx={{ flex: 1, color: "grey.800" }} noWrap>
        {alert.message}
      </Typography>
      {alert.assignment && (
        <Typography variant="caption" sx={{ color: "grey.400", flexShrink: 0 }}>
          End: {alert.assignment.endDate}
        </Typography>
      )}
      {onNavigate && <ChevronRightIcon sx={{ fontSize: 14, color: "grey.300", flexShrink: 0 }} />}
    </Paper>
  );
});
AlertRow.displayName = "AlertRow";

// ─── Collapsible group ───────────────────────────────────────────────────────
const AlertGroup = memo(({ type, alerts, defaultOpen, onNavigate }: any) => {
  const [open, setOpen] = useState(defaultOpen);
  const config = ALERT_CONFIG[type];
  const Icon = config.icon;

  // Count by severity within group
  const sevCounts = useMemo(() => {
    const c: Record<string, number> = {};
    alerts.forEach((a: any) => {
      c[a.severity] = (c[a.severity] || 0) + 1;
    });
    return c;
  }, [alerts]);

  // Sort alerts: critical first
  const sorted = useMemo(
    () =>
      [...alerts].sort(
        (a: any, b: any) =>
          ((SEV_ORDER as Record<string, number>)[a.severity] ?? 9) -
          ((SEV_ORDER as Record<string, number>)[b.severity] ?? 9)
      ),
    [alerts]
  );

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, borderColor: config.borderColor, overflow: "hidden" }}>
      <Button
        onClick={() => setOpen((o: boolean) => !o)}
        fullWidth
        sx={{
          justifyContent: "flex-start",
          gap: 1.5,
          px: 2,
          py: 1.5,
          bgcolor: config.headerBg,
          textTransform: "none",
          "&:hover": { bgcolor: config.headerHoverBg },
        }}
      >
        {open ? (
          <ExpandMoreIcon sx={{ fontSize: 16, color: config.iconColor }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 16, color: config.iconColor }} />
        )}
        <Icon sx={{ fontSize: 20, color: config.iconColor }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: config.textColor }}>
          {config.label}
        </Typography>
        <Chip
          label={alerts.length}
          size="small"
          sx={{
            ml: 0.5,
            fontWeight: "bold",
            fontSize: "0.75rem",
            bgcolor: config.bgColor,
            color: config.textColor,
          }}
        />
        {/* Severity mini-dots */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, ml: "auto" }}>
          {sevCounts[ALERT_SEVERITY.CRITICAL] > 0 && (
            <Box
              component="span"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                fontSize: "11px",
                color: "#ef4444",
                fontWeight: 500,
              }}
            >
              <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#ef4444" }} />
              {sevCounts[ALERT_SEVERITY.CRITICAL]}
            </Box>
          )}
          {sevCounts[ALERT_SEVERITY.WARNING] > 0 && (
            <Box
              component="span"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                fontSize: "11px",
                color: "#ca8a04",
                fontWeight: 500,
              }}
            >
              <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#eab308" }} />
              {sevCounts[ALERT_SEVERITY.WARNING]}
            </Box>
          )}
          {sevCounts[ALERT_SEVERITY.INFO] > 0 && (
            <Box
              component="span"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                fontSize: "11px",
                color: "primary.main",
                fontWeight: 500,
              }}
            >
              <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#3b82f6" }} />
              {sevCounts[ALERT_SEVERITY.INFO]}
            </Box>
          )}
        </Box>
      </Button>
      {open && (
        <Box
          sx={{
            px: 1.5,
            pb: 1.5,
            pt: 0.5,
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
            bgcolor: "rgba(255,255,255,0.6)",
          }}
        >
          {sorted.map((alert, idx) => (
            <AlertRow key={`${alert.employee.empId}-${idx}`} alert={alert} onNavigate={onNavigate} />
          ))}
        </Box>
      )}
    </Paper>
  );
});
AlertGroup.displayName = "AlertGroup";

// ─── Severity filter pills ───────────────────────────────────────────────────
const SeverityFilters = memo(({ selectedSeverity, onSelect, counts }: any) => {
  const pills = [
    { key: "all", label: "All", count: counts.total },
    {
      key: ALERT_SEVERITY.CRITICAL,
      label: "Critical",
      config: SEVERITY_CONFIG[ALERT_SEVERITY.CRITICAL],
      count: counts[ALERT_SEVERITY.CRITICAL] || 0,
    },
    {
      key: ALERT_SEVERITY.WARNING,
      label: "Warnings",
      config: SEVERITY_CONFIG[ALERT_SEVERITY.WARNING],
      count: counts[ALERT_SEVERITY.WARNING] || 0,
    },
    {
      key: ALERT_SEVERITY.INFO,
      label: "Info",
      config: SEVERITY_CONFIG[ALERT_SEVERITY.INFO],
      count: counts[ALERT_SEVERITY.INFO] || 0,
    },
  ];

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {pills.map((p) => (
        <Chip
          key={p.key}
          onClick={() => onSelect(p.key)}
          icon={
            p.config ? (
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: selectedSeverity === p.key ? "rgba(255,255,255,0.7)" : p.config.dotColor,
                }}
              />
            ) : undefined
          }
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              {p.label}
              {p.count > 0 && (
                <Box
                  component="span"
                  sx={{
                    px: 0.75,
                    borderRadius: "9999px",
                    fontSize: "10px",
                    bgcolor: selectedSeverity === p.key ? "rgba(255,255,255,0.2)" : "grey.200",
                  }}
                >
                  {p.count}
                </Box>
              )}
            </Box>
          }
          size="small"
          sx={{
            fontWeight: 500,
            fontSize: "0.75rem",
            bgcolor: selectedSeverity === p.key ? "grey.800" : "grey.100",
            color: selectedSeverity === p.key ? "white" : "grey.600",
            "&:hover": { bgcolor: selectedSeverity === p.key ? "grey.700" : "grey.200" },
          }}
        />
      ))}
    </Box>
  );
});
SeverityFilters.displayName = "SeverityFilters";

// ─── Main AlertsPanel (modal) ────────────────────────────────────────────────
export const AlertsPanel = memo(({ alerts, isOpen, onClose, onNavigateToEmployee }: any) => {
  const [selectedSeverity, setSelectedSeverity] = useState("all");

  const sevCounts = useMemo(() => {
    const c = countAlertsBySeverity(alerts);
    c.total = alerts.length;
    return c;
  }, [alerts]);

  // Filter by severity, then group by type
  const groups = useMemo(() => {
    const filtered = selectedSeverity === "all" ? alerts : filterAlertsBySeverity(alerts, selectedSeverity);
    const byType: Record<string, any[]> = {};
    filtered.forEach((a: any) => {
      if (!byType[a.type]) byType[a.type] = [];
      byType[a.type].push(a);
    });
    // Ordered groups
    return TYPE_ORDER.filter((t) => byType[t] && byType[t].length > 0).map((t) => ({ type: t, alerts: byType[t] }));
  }, [alerts, selectedSeverity]);

  const totalFiltered = groups.reduce((s, g) => s + g.alerts.length, 0);

  if (!isOpen) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "rgba(0,0,0,0.4)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
      onClick={onClose}
    >
      <Paper
        sx={{
          bgcolor: "grey.50",
          borderRadius: 4,
          boxShadow: 24,
          maxWidth: 768,
          width: "100%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Alerts panel"
      >
        {/* Header */}
        <Box
          sx={{
            px: 2.5,
            py: 2,
            borderBottom: 1,
            borderColor: "grey.200",
            bgcolor: "white",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ p: 1, bgcolor: "#fef3c7", borderRadius: 2 }}>
              <WarningIcon sx={{ fontSize: 20, color: "#d97706" }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: "bold", color: "text.primary" }}>
                Alerts
              </Typography>
              <Typography variant="caption" sx={{ color: "grey.500" }}>
                {alerts.length} alert{alerts.length !== 1 ? "s" : ""} total
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} sx={{ "&:hover": { bgcolor: "grey.100" } }}>
            <CloseIcon sx={{ fontSize: 20, color: "grey.400" }} />
          </IconButton>
        </Box>

        {/* Severity filter */}
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "grey.200", bgcolor: "white" }}>
          <SeverityFilters selectedSeverity={selectedSeverity} onSelect={setSelectedSeverity} counts={sevCounts} />
        </Box>

        {/* Grouped alert list */}
        <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {groups.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6, color: "grey.400" }}>
              <ErrorIcon sx={{ fontSize: 40, mx: "auto", mb: 1.5, color: "grey.300", display: "block" }} />
              <Typography variant="body2">Aucune alerte</Typography>
            </Box>
          ) : (
            groups.map((g) => (
              <AlertGroup
                key={g.type}
                type={g.type}
                alerts={g.alerts}
                defaultOpen={g.alerts.some((a: any) => a.severity === ALERT_SEVERITY.CRITICAL)}
                onNavigate={onNavigateToEmployee}
              />
            ))
          )}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: 1,
            borderColor: "grey.200",
            bgcolor: "white",
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="caption" sx={{ color: "grey.500" }}>
            {totalFiltered} alert{totalFiltered !== 1 ? "s" : ""} shown
          </Typography>
          <Button
            onClick={onClose}
            variant="contained"
            size="small"
            sx={{
              textTransform: "none",
              bgcolor: "grey.800",
              "&:hover": { bgcolor: "grey.700" },
              borderRadius: 2,
            }}
          >
            Close
          </Button>
        </Box>
      </Paper>
    </Box>
  );
});
AlertsPanel.displayName = "AlertsPanel";
