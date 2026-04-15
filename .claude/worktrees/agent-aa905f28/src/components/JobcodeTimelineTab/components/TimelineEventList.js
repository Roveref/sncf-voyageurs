/**
 * TimelineEventList Component
 * Opportunity lifecycle cards with connected progress track,
 * glow effects on latest step, and staggered entrance animations.
 */

import React, { useMemo } from "react";
import { Box, Typography, Chip, Collapse, Grid, Divider, useTheme, alpha, keyframes } from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import TimelineIcon from "@mui/icons-material/Timeline";
import BusinessIcon from "@mui/icons-material/Business";
import EuroIcon from "@mui/icons-material/Euro";
import LabelIcon from "@mui/icons-material/Label";
import GroupIcon from "@mui/icons-material/Group";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { STATUS_TEXT } from "../../../utils/constants";
import { formatDate, formatCurrency, getStreamColor, getStatusChipColor } from "../utils";

/* ─── Keyframes ─── */
const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 currentColor; }
  70%  { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* ─── Helpers ─── */
const getEventIcon = (type) => {
  const sx = { fontSize: 20 };
  switch (type) {
    case "creation":
      return <FolderOpenIcon sx={sx} />;
    case "win":
      return <CheckCircleIcon sx={sx} />;
    case "loss":
      return <CancelIcon sx={sx} />;
    case "status":
      return <TimelineIcon sx={sx} />;
    default:
      return <TimelineIcon sx={sx} />;
  }
};

const getEventLabel = (event) => {
  switch (event.type) {
    case "creation":
      return "Created";
    case "win":
      return "Won";
    case "loss":
      return "Lost";
    case "status":
      return STATUS_TEXT[event.status] || `Status ${event.status}`;
    default:
      return "Event";
  }
};

const getEventColor = (event) => {
  switch (event.type) {
    case "creation":
      return "info";
    case "win":
      return "success";
    case "loss":
      return "error";
    case "status":
      return getStatusChipColor(event.status) || "primary";
    default:
      return "primary";
  }
};

/* ─── LifecycleStep ─── */
const LifecycleStep = React.memo(({ event, isLast, theme }) => {
  const color = getEventColor(event);
  const pc = theme.palette[color]?.main || theme.palette.grey[500];

  return (
    <Box sx={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : 1 }}>
      {/* Node */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minWidth: 72,
          position: "relative",
          zIndex: 2,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            bgcolor: pc,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            boxShadow: `0 3px 12px ${alpha(pc, 0.35)}`,
            mb: 0.75,
            ...(isLast && {
              animation: `${pulse} 2s infinite`,
              color: pc,
            }),
          }}
        >
          {getEventIcon(event.type)}
        </Box>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ color: pc, fontSize: "0.72rem", textAlign: "center", lineHeight: 1.2 }}
        >
          {getEventLabel(event)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.66rem", textAlign: "center" }}>
          {formatDate(event.date)}
        </Typography>
      </Box>

      {/* Connector bar */}
      {!isLast && (
        <Box
          sx={{
            flex: 1,
            height: 3,
            mx: 0.5,
            mt: -3,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${pc}, ${alpha(pc, 0.25)})`,
          }}
        />
      )}
    </Box>
  );
});
LifecycleStep.displayName = "LifecycleStep";

/* ─── OpportunityLifecycleCard ─── */
const OpportunityLifecycleCard = React.memo(({ stream, streamIndex, isExpanded, onToggle, theme }) => {
  const streamColor = getStreamColor(streamIndex);
  const pc = theme.palette[streamColor]?.main || theme.palette.grey[500];
  const statusColor = getStatusChipColor(stream.status);

  const durationText = useMemo(() => {
    if (!stream.firstDate || !stream.lastDate) return null;
    const days = Math.round((stream.lastDate - stream.firstDate) / 86400000);
    if (days === 0) return "Same day";
    if (days < 30) return `${days}d`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months}mo`;
    return `${(days / 365).toFixed(1)}y`;
  }, [stream.firstDate, stream.lastDate]);

  const opp = stream.events[0]?.opportunity;

  return (
    <Box
      sx={{
        mb: 2.5,
        borderRadius: 3,
        overflow: "hidden",
        background: `linear-gradient(135deg, ${alpha(pc, 0.03)} 0%, ${alpha(pc, 0.08)} 100%)`,
        border: `1px solid ${alpha(pc, 0.15)}`,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        animation: `${slideIn} 0.45s ease both`,
        animationDelay: `${streamIndex * 0.08}s`,
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: `0 8px 24px ${alpha(pc, 0.15)}`,
        },
      }}
    >
      {/* Accent top bar */}
      <Box sx={{ height: 4, background: `linear-gradient(90deg, ${pc}, ${alpha(pc, 0.3)})` }} />

      {/* Header */}
      <Box
        onClick={onToggle}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          py: 1.5,
          cursor: "pointer",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: pc,
              flexShrink: 0,
              boxShadow: `0 0 6px ${alpha(pc, 0.5)}`,
            }}
          />
          <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ minWidth: 0, flex: 1 }}>
            {stream.opportunityName}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          {durationText && (
            <Chip
              size="small"
              label={durationText}
              sx={{
                height: 22,
                fontSize: "0.68rem",
                fontWeight: 700,
                bgcolor: alpha(theme.palette.text.secondary, 0.08),
                color: "text.secondary",
              }}
            />
          )}
          <Chip
            size="small"
            label={formatCurrency(stream.revenue)}
            sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700 }}
            variant="outlined"
            color={streamColor}
          />
          <Chip
            size="small"
            label={STATUS_TEXT[stream.status] || `Status ${stream.status}`}
            sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700 }}
            color={statusColor !== "default" ? statusColor : "primary"}
          />
          {isExpanded ? (
            <ExpandLessIcon sx={{ fontSize: 20, color: "text.secondary" }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 20, color: "text.secondary" }} />
          )}
        </Box>
      </Box>

      {/* Progress track */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          px: 3,
          pb: 2.5,
          pt: 0.5,
          overflowX: "auto",
        }}
      >
        {stream.events.map((event, idx) => (
          <LifecycleStep key={event.id} event={event} isLast={idx === stream.events.length - 1} theme={theme} />
        ))}
      </Box>

      {/* Expanded details */}
      <Collapse in={isExpanded}>
        <Divider sx={{ borderColor: alpha(pc, 0.12) }} />
        <Box
          sx={{
            px: 2.5,
            py: 2,
            background: `linear-gradient(180deg, ${alpha(pc, 0.04)} 0%, transparent 100%)`,
          }}
        >
          {opp && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <BusinessIcon sx={{ mr: 1, color: pc, fontSize: 16 }} />
                  <Typography variant="body2" color="text.secondary">
                    Account: <b>{opp["Account"]}</b>
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <EuroIcon sx={{ mr: 1, color: pc, fontSize: 16 }} />
                  <Typography variant="body2" color="text.secondary">
                    Revenue: <b>{formatCurrency(opp["Gross Revenue"] || 0)}</b>
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <LabelIcon sx={{ mr: 1, color: pc, fontSize: 16 }} />
                  <Typography variant="body2" color="text.secondary">
                    Service: <b>{opp["Service Line 1"] || "N/A"}</b>
                  </Typography>
                </Box>
                {opp["Service Offering 1"] && (
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                    <LabelIcon sx={{ mr: 1, color: pc, fontSize: 16 }} />
                    <Typography variant="body2" color="text.secondary">
                      Offering: <b>{opp["Service Offering 1"]}</b>
                    </Typography>
                  </Box>
                )}
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <GroupIcon sx={{ mr: 1, color: pc, fontSize: 16 }} />
                  <Typography variant="body2" color="text.secondary">
                    EP: <b>{opp["EP"] || "N/A"}</b>
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <GroupIcon sx={{ mr: 1, color: pc, fontSize: 16 }} />
                  <Typography variant="body2" color="text.secondary">
                    EM: <b>{opp["EM"] || "N/A"}</b>
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          )}

          {opp && (
            <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Chip
                size="small"
                label={`ID: ${opp["Opportunity ID"]}`}
                variant="outlined"
                sx={{ height: 20, fontSize: "0.65rem" }}
              />
              {opp["Project Type"] && (
                <Chip
                  size="small"
                  label={opp["Project Type"]}
                  variant="outlined"
                  sx={{ height: 20, fontSize: "0.65rem" }}
                />
              )}
              {opp["Sub Segment Code"] && (
                <Chip
                  size="small"
                  label={opp["Sub Segment Code"]}
                  variant="outlined"
                  sx={{ height: 20, fontSize: "0.65rem" }}
                />
              )}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
});
OpportunityLifecycleCard.displayName = "OpportunityLifecycleCard";

/* ─── TimelineEventList ─── */
const TimelineEventList = React.memo(({ timelineData, opportunityStreams, expandedCards, onToggleExpanded }) => {
  const theme = useTheme();

  if (!opportunityStreams || opportunityStreams.length === 0) {
    return (
      <Box sx={{ p: 6, textAlign: "center" }}>
        <TimelineIcon sx={{ fontSize: 56, mb: 2, color: alpha(theme.palette.text.secondary, 0.2) }} />
        <Typography variant="body1" color="text.secondary">
          No timeline events found for this jobcode.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {opportunityStreams.map((stream, index) => (
        <OpportunityLifecycleCard
          key={stream.opportunityId}
          stream={stream}
          streamIndex={index}
          isExpanded={!!expandedCards[stream.opportunityId]}
          onToggle={() => onToggleExpanded(stream.opportunityId)}
          theme={theme}
        />
      ))}
    </Box>
  );
});

TimelineEventList.displayName = "TimelineEventList";

export default TimelineEventList;
