/**
 * JobcodeHeader Component
 * Hero banner with gradient background, KPI counters, and opportunity summary
 */

import React, { useMemo } from "react";
import { Typography, Box, Chip, useTheme, alpha } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import LayersIcon from "@mui/icons-material/Layers";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { formatCurrency, getStreamColor, getStatusChipColor } from "../utils";
import { STATUS_TEXT } from "../../../utils/constants";

const JobcodeHeader = React.memo(({ selectedJobcode, opportunityStreams = [] }) => {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;

  // Compute average lifecycle duration across streams
  const avgDuration = useMemo(() => {
    if (opportunityStreams.length === 0) return null;
    const durations = opportunityStreams.filter((s) => s.firstDate && s.lastDate).map((s) => s.lastDate - s.firstDate);
    if (durations.length === 0) return null;
    const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
    const days = Math.round(avgMs / (1000 * 60 * 60 * 24));
    if (days < 30) return `${days}d`;
    if (days < 365) return `${Math.round(days / 30)}mo`;
    return `${(days / 365).toFixed(1)}y`;
  }, [opportunityStreams]);

  return (
    <Box sx={{ mb: 3 }}>
      {/* Hero banner */}
      <Box
        sx={{
          position: "relative",
          borderRadius: 3,
          overflow: "hidden",
          background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
          color: "white",
          p: 3,
          mb: 2,
        }}
      >
        {/* Decorative circles */}
        <Box
          sx={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: "50%",
            bgcolor: alpha("#fff", 0.06),
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: -30,
            right: 60,
            width: 100,
            height: 100,
            borderRadius: "50%",
            bgcolor: alpha("#fff", 0.04),
          }}
        />

        {/* Content */}
        <Box sx={{ position: "relative", zIndex: 1 }}>
          {/* Title row */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2.5 }}>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
                {selectedJobcode.jobcode}
              </Typography>
              <Typography variant="subtitle2" sx={{ color: alpha("#fff", 0.75), mt: 0.25 }}>
                {selectedJobcode.account}
              </Typography>
            </Box>
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{
                letterSpacing: "-0.02em",
                textShadow: `0 2px 12px ${alpha("#000", 0.15)}`,
              }}
            >
              {formatCurrency(selectedJobcode.totalRevenue)}
            </Typography>
          </Box>

          {/* KPI row */}
          <Box sx={{ display: "flex", gap: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <LayersIcon sx={{ fontSize: 18, color: alpha("#fff", 0.7) }} />
              <Typography variant="body2" fontWeight={600}>
                {selectedJobcode.opportunityCount} opportunit{selectedJobcode.opportunityCount > 1 ? "ies" : "y"}
              </Typography>
            </Box>
            {avgDuration && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <ScheduleIcon sx={{ fontSize: 18, color: alpha("#fff", 0.7) }} />
                <Typography variant="body2" fontWeight={600}>
                  Avg. {avgDuration} lifecycle
                </Typography>
              </Box>
            )}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <TrendingUpIcon sx={{ fontSize: 18, color: alpha("#fff", 0.7) }} />
              <Typography variant="body2" fontWeight={600}>
                {formatCurrency(selectedJobcode.totalRevenue / Math.max(selectedJobcode.opportunityCount, 1))} avg.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Opportunity pills row */}
      {opportunityStreams.length > 1 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {opportunityStreams.map((stream, index) => {
            const streamColor = getStreamColor(index);
            const statusColor = getStatusChipColor(stream.status);
            const pc = theme.palette[streamColor]?.main || theme.palette.grey[500];
            return (
              <Box
                key={stream.opportunityId}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  bgcolor: alpha(pc, 0.06),
                  border: `1px solid ${alpha(pc, 0.18)}`,
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  "&:hover": {
                    transform: "translateY(-1px)",
                    boxShadow: `0 4px 12px ${alpha(pc, 0.18)}`,
                  },
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: pc, flexShrink: 0 }} />
                <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: 160 }}>
                  {stream.opportunityName}
                </Typography>
                <Chip
                  size="small"
                  label={formatCurrency(stream.revenue)}
                  sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700 }}
                  variant="outlined"
                  color={streamColor}
                />
                <Chip
                  size="small"
                  label={STATUS_TEXT[stream.status] || `Status ${stream.status}`}
                  sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700 }}
                  color={statusColor !== "default" ? statusColor : "primary"}
                />
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
});

JobcodeHeader.displayName = "JobcodeHeader";

export default JobcodeHeader;
