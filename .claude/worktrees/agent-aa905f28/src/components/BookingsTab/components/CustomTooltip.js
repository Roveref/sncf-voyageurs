import React from "react";
import { Box, Typography, alpha, useTheme } from "@mui/material";

/**
 * Modern Custom Tooltip Component for Cumulative Bookings Chart
 *
 * Features:
 * - Dynamic: adapts to any selected years
 * - Clean design with colored year cards
 * - Shows monthly and cumulative data
 * - Responsive to showIO toggle
 */
// Source breakdown colors - exported for use in chart
// Note: crmOriginal uses year's color dynamically, this is the fallback
export const SOURCE_COLORS = {
  crmOriginal: "#99171D", // R70 Red (fallback - will be overridden by year color)
  manual: "#806659", // G60 Brown (darker)
  crmModified: "#B2A59F", // G40 Brown (lighter)
  status11: "#330000", // Deep red for Status 11
};

export const SOURCE_LABELS = {
  crmOriginal: "CRM Original",
  manual: "Manual Opps",
  crmModified: "CRM Modified",
  status11: "Status 11",
};

const CustomTooltip = React.memo(
  ({
    active,
    payload,
    label,
    cumulativeData,
    showNetRevenue,
    curveVisibility,
    includeStatus11,
    showIOGlobal,
    showSourceBreakdown = false,
    yearColors = {}, // COLOR_BY_YEAR passed from parent
  }) => {
    const theme = useTheme();

    if (!active || !payload || payload.length === 0 || !cumulativeData) {
      return null;
    }

    // Find current month data from label
    const monthIndex = cumulativeData.findIndex((month) => month.monthName === label);
    if (monthIndex === -1) return null;

    const monthData = cumulativeData[monthIndex];

    // Extract unique years from payload
    const years = [
      ...new Set(
        payload
          .map((p) => {
            const match = p.dataKey?.match(/^(\d{4})/);
            return match ? match[1] : null;
          })
          .filter(Boolean)
      ),
    ];

    // Format currency (full format: X XXX XXX €)
    const formatCurrency = (value) =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value || 0);

    // Get year color from payload
    const getYearColor = (year) => {
      const yearPayload = payload.find((p) => p.dataKey === year || p.dataKey?.startsWith(year));
      return yearPayload?.color || theme.palette.primary.main;
    };

    // Prepare data for each year
    const getYearData = (year) => {
      const usesCombined = includeStatus11;

      // Monthly values
      const monthlyTotal = usesCombined
        ? monthData[`${year}_combined_total`] || monthData[year] || 0
        : monthData[year] || 0;
      const monthlyIO = usesCombined
        ? monthData[`${year}_combined_io`] || monthData[`${year}_io`] || 0
        : monthData[`${year}_io`] || 0;
      const monthlyAllocated = monthData[`${year}_allocated`] || 0;
      const monthlyOpps = monthData[`${year}Opps`] || [];

      // Cumulative values
      const cumulativeTotal = usesCombined
        ? monthData[`${year}_combined_cumulative`] || monthData[`${year}_cumulative`] || 0
        : monthData[`${year}_cumulative`] || 0;
      const cumulativeIO = usesCombined
        ? monthData[`${year}_combined_io_cumulative`] || monthData[`${year}_io_cumulative`] || 0
        : monthData[`${year}_io_cumulative`] || 0;
      const cumulativeAllocated = monthData[`${year}_allocated_cumulative`] || 0;
      const cumulativeOpps = monthData[`${year}Opps_cumulative`] || [];

      // Check if there's an allocation difference
      // Don't show allocation arrow when Status 11 is enabled (values aren't comparable)
      const hasMonthlyAllocation = !includeStatus11 && monthlyAllocated !== monthlyTotal && monthlyAllocated > 0;
      const hasCumulativeAllocation =
        !includeStatus11 && cumulativeAllocated !== cumulativeTotal && cumulativeAllocated > 0;

      // Source breakdown data
      const sourceBreakdown = {
        monthly: {
          crmOriginal: {
            value: monthData[`${year}_src_crmOriginal`] || 0,
            count: monthData[`${year}_src_crmOriginal_count`] || 0,
            io: monthData[`${year}_src_crmOriginal_io`] || 0,
            allocated: monthData[`${year}_src_crmOriginal_allocated`] || 0,
          },
          manual: {
            value: monthData[`${year}_src_manual`] || 0,
            count: monthData[`${year}_src_manual_count`] || 0,
            io: monthData[`${year}_src_manual_io`] || 0,
            allocated: monthData[`${year}_src_manual_allocated`] || 0,
          },
          crmModified: {
            value: monthData[`${year}_src_crmModified`] || 0,
            count: monthData[`${year}_src_crmModified_count`] || 0,
            io: monthData[`${year}_src_crmModified_io`] || 0,
            allocated: monthData[`${year}_src_crmModified_allocated`] || 0,
          },
          status11: {
            value: monthData[`${year}_status11`] || 0,
            count: (monthData[`${year}Status11Opps`] || []).length,
            io: monthData[`${year}_status11_io`] || 0,
          },
        },
        cumulative: {
          crmOriginal: {
            value: monthData[`${year}_src_crmOriginal_cumulative`] || 0,
            count: monthData[`${year}_src_crmOriginal_count_cumulative`] || 0,
            io: monthData[`${year}_src_crmOriginal_io_cumulative`] || 0,
            allocated: monthData[`${year}_src_crmOriginal_allocated_cumulative`] || 0,
          },
          manual: {
            value: monthData[`${year}_src_manual_cumulative`] || 0,
            count: monthData[`${year}_src_manual_count_cumulative`] || 0,
            io: monthData[`${year}_src_manual_io_cumulative`] || 0,
            allocated: monthData[`${year}_src_manual_allocated_cumulative`] || 0,
          },
          crmModified: {
            value: monthData[`${year}_src_crmModified_cumulative`] || 0,
            count: monthData[`${year}_src_crmModified_count_cumulative`] || 0,
            io: monthData[`${year}_src_crmModified_io_cumulative`] || 0,
            allocated: monthData[`${year}_src_crmModified_allocated_cumulative`] || 0,
          },
          status11: {
            value: monthData[`${year}_status11_cumulative`] || 0,
            count: (monthData[`${year}Status11Opps_cumulative`] || []).length,
            io: monthData[`${year}_status11_io_cumulative`] || 0,
          },
        },
      };

      // Check if there's any non-CRM-original data worth showing
      const hasSourceBreakdown =
        sourceBreakdown.monthly.manual.value > 0 ||
        sourceBreakdown.monthly.crmModified.value > 0 ||
        sourceBreakdown.cumulative.manual.value > 0 ||
        sourceBreakdown.cumulative.crmModified.value > 0;

      return {
        year,
        color: getYearColor(year),
        monthly: {
          total: monthlyTotal,
          allocated: monthlyAllocated,
          hasAllocation: hasMonthlyAllocation,
          io: monthlyIO,
          count: monthlyOpps.length,
        },
        cumulative: {
          total: cumulativeTotal,
          allocated: cumulativeAllocated,
          hasAllocation: hasCumulativeAllocation,
          io: cumulativeIO,
          count: cumulativeOpps.length,
        },
        sourceBreakdown,
        hasSourceBreakdown,
      };
    };

    const yearsData = years.map(getYearData);

    // Check if any year has allocation data to determine tooltip width
    // Only true when there's an actual difference between value and allocated
    const hasAnyAllocation = yearsData.some(
      (yd) =>
        yd.monthly.hasAllocation ||
        yd.cumulative.hasAllocation ||
        // Check if source breakdown has allocation differences (allocated !== value)
        (yd.sourceBreakdown.monthly.crmOriginal.allocated > 0 &&
          yd.sourceBreakdown.monthly.crmOriginal.allocated !== yd.sourceBreakdown.monthly.crmOriginal.value) ||
        (yd.sourceBreakdown.monthly.manual.allocated > 0 &&
          yd.sourceBreakdown.monthly.manual.allocated !== yd.sourceBreakdown.monthly.manual.value) ||
        (yd.sourceBreakdown.monthly.crmModified.allocated > 0 &&
          yd.sourceBreakdown.monthly.crmModified.allocated !== yd.sourceBreakdown.monthly.crmModified.value) ||
        (yd.sourceBreakdown.cumulative.crmOriginal.allocated > 0 &&
          yd.sourceBreakdown.cumulative.crmOriginal.allocated !== yd.sourceBreakdown.cumulative.crmOriginal.value) ||
        (yd.sourceBreakdown.cumulative.manual.allocated > 0 &&
          yd.sourceBreakdown.cumulative.manual.allocated !== yd.sourceBreakdown.cumulative.manual.value) ||
        (yd.sourceBreakdown.cumulative.crmModified.allocated > 0 &&
          yd.sourceBreakdown.cumulative.crmModified.allocated !== yd.sourceBreakdown.cumulative.crmModified.value)
    );

    // Determine minWidth based on content - wider when allocation exists (even without breakdown)
    const tooltipMinWidth = hasAnyAllocation || (showSourceBreakdown && showIOGlobal) ? 480 : 360;

    return (
      <Box
        sx={{
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: "blur(10px)",
          borderRadius: 2,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: "hidden",
          minWidth: tooltipMinWidth,
          animation: "tooltipFadeIn 0.2s ease-out",
          "@keyframes tooltipFadeIn": {
            from: { opacity: 0, transform: "translateY(-4px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: alpha(theme.palette.primary.main, 0.05),
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <Typography variant="subtitle2" fontWeight={700} color="text.primary">
            {label}
          </Typography>
        </Box>

        {/* Year Cards */}
        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {yearsData.map((yearData) => (
            <Box
              key={yearData.year}
              sx={{
                borderRadius: 1.5,
                overflow: "hidden",
                border: `1px solid ${alpha(yearData.color, 0.2)}`,
              }}
            >
              {/* Year Header */}
              <Box
                sx={{
                  px: 1.5,
                  py: 0.75,
                  bgcolor: alpha(yearData.color, 0.1),
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: yearData.color,
                  }}
                />
                <Typography variant="caption" fontWeight={700} color="text.primary">
                  {yearData.year}
                </Typography>
              </Box>

              {/* Monthly & Cumulative Data */}
              <Box sx={{ display: "flex" }}>
                {/* Monthly */}
                <Box sx={{ flex: 1, p: 1.5, borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    Monthly
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, flexWrap: "wrap" }}>
                    <Typography variant="body2" fontWeight={600} color="text.primary">
                      {formatCurrency(yearData.monthly.total)}
                    </Typography>
                    {yearData.monthly.hasAllocation && (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          →
                        </Typography>
                        <Typography variant="body2" fontWeight={600} color="secondary.main">
                          {formatCurrency(yearData.monthly.allocated)}
                        </Typography>
                      </>
                    )}
                  </Box>
                  {showIOGlobal && yearData.monthly.io > 0 && (
                    <Typography variant="caption" color="primary.main" sx={{ display: "block" }}>
                      I&O: {formatCurrency(yearData.monthly.io)}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {yearData.monthly.count} opp{yearData.monthly.count > 1 ? "s" : ""}
                  </Typography>
                </Box>

                {/* Cumulative */}
                <Box sx={{ flex: 1, p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    Cumulative
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, flexWrap: "wrap" }}>
                    <Typography variant="body2" fontWeight={600} color="text.primary">
                      {formatCurrency(yearData.cumulative.total)}
                    </Typography>
                    {yearData.cumulative.hasAllocation && (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          →
                        </Typography>
                        <Typography variant="body2" fontWeight={600} color="secondary.main">
                          {formatCurrency(yearData.cumulative.allocated)}
                        </Typography>
                      </>
                    )}
                  </Box>
                  {showIOGlobal && yearData.cumulative.io > 0 && (
                    <Typography variant="caption" color="primary.main" sx={{ display: "block" }}>
                      I&O: {formatCurrency(yearData.cumulative.io)}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {yearData.cumulative.count} opp{yearData.cumulative.count > 1 ? "s" : ""}
                  </Typography>
                </Box>
              </Box>

              {/* Source Breakdown - shown only when Breakdown toggle is active and for current year only */}
              {showSourceBreakdown && parseInt(yearData.year) === new Date().getFullYear() && (
                <Box
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    bgcolor: alpha(theme.palette.grey[500], 0.03),
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={600}
                    sx={{ display: "block", mb: 0.75 }}
                  >
                    Source Breakdown
                  </Typography>
                  {/* Table-like layout with dynamic columns */}
                  <Box
                    component="table"
                    sx={{ width: "100%", borderCollapse: "collapse", fontSize: "0.65rem", whiteSpace: "nowrap" }}
                  >
                    <Box component="thead">
                      {/* Super header row: Monthly | Cumulated */}
                      <Box component="tr" sx={{ color: "text.secondary" }}>
                        <Box component="th" sx={{ textAlign: "left", pb: 0.25 }}></Box>
                        <Box
                          component="th"
                          colSpan={1 + (hasAnyAllocation ? 1 : 0) + (showIOGlobal ? 1 : 0)}
                          sx={{ textAlign: "center", pb: 0.25, fontWeight: 600, color: "text.primary" }}
                        >
                          Monthly
                        </Box>
                        <Box
                          component="th"
                          colSpan={1 + (hasAnyAllocation ? 1 : 0) + (showIOGlobal ? 1 : 0)}
                          sx={{
                            textAlign: "center",
                            pb: 0.25,
                            fontWeight: 600,
                            color: "text.primary",
                            borderLeft: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                            pl: 2,
                          }}
                        >
                          Cumulated
                        </Box>
                      </Box>
                      {/* Column headers row */}
                      <Box component="tr" sx={{ color: "text.secondary" }}>
                        <Box component="th" sx={{ textAlign: "left", pb: 0.5, fontWeight: 500 }}>
                          Source
                        </Box>
                        <Box component="th" sx={{ textAlign: "right", pb: 0.5, fontWeight: 500, pl: 1 }}>
                          Total
                        </Box>
                        {hasAnyAllocation && (
                          <Box
                            component="th"
                            sx={{ textAlign: "right", pb: 0.5, fontWeight: 500, pl: 1, color: "secondary.main" }}
                          >
                            Alloc.
                          </Box>
                        )}
                        {showIOGlobal && (
                          <Box
                            component="th"
                            sx={{ textAlign: "right", pb: 0.5, fontWeight: 500, pl: 1, pr: 1.5, color: "primary.main" }}
                          >
                            I&O
                          </Box>
                        )}
                        <Box
                          component="th"
                          sx={{
                            textAlign: "right",
                            pb: 0.5,
                            fontWeight: 500,
                            borderLeft: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                            pl: 2,
                          }}
                        >
                          Total
                        </Box>
                        {hasAnyAllocation && (
                          <Box
                            component="th"
                            sx={{ textAlign: "right", pb: 0.5, fontWeight: 500, pl: 1, color: "secondary.main" }}
                          >
                            Alloc.
                          </Box>
                        )}
                        {showIOGlobal && (
                          <Box
                            component="th"
                            sx={{ textAlign: "right", pb: 0.5, fontWeight: 500, pl: 1, color: "primary.main" }}
                          >
                            I&O
                          </Box>
                        )}
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {/* CRM Original */}
                      {(yearData.sourceBreakdown.monthly.crmOriginal.value > 0 ||
                        yearData.sourceBreakdown.cumulative.crmOriginal.value > 0) && (
                        <Box component="tr">
                          <Box component="td" sx={{ py: 0.25, display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                bgcolor: yearColors[yearData.year]?.bar || yearData.color,
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ color: yearColors[yearData.year]?.bar || yearData.color }}>
                              CRM Original
                            </span>
                          </Box>
                          <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "text.secondary", pl: 1 }}>
                            {formatCurrency(yearData.sourceBreakdown.monthly.crmOriginal.value)}
                          </Box>
                          {hasAnyAllocation && (
                            <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "secondary.main", pl: 1 }}>
                              {formatCurrency(yearData.sourceBreakdown.monthly.crmOriginal.allocated)}
                            </Box>
                          )}
                          {showIOGlobal && (
                            <Box
                              component="td"
                              sx={{ textAlign: "right", py: 0.25, color: "primary.main", pl: 1, pr: 1.5 }}
                            >
                              {formatCurrency(yearData.sourceBreakdown.monthly.crmOriginal.io)}
                            </Box>
                          )}
                          <Box
                            component="td"
                            sx={{
                              textAlign: "right",
                              py: 0.25,
                              color: "text.secondary",
                              borderLeft: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                              pl: 2,
                            }}
                          >
                            {formatCurrency(yearData.sourceBreakdown.cumulative.crmOriginal.value)}
                          </Box>
                          {hasAnyAllocation && (
                            <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "secondary.main", pl: 1 }}>
                              {formatCurrency(yearData.sourceBreakdown.cumulative.crmOriginal.allocated)}
                            </Box>
                          )}
                          {showIOGlobal && (
                            <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "primary.main", pl: 1 }}>
                              {formatCurrency(yearData.sourceBreakdown.cumulative.crmOriginal.io)}
                            </Box>
                          )}
                        </Box>
                      )}
                      {/* Status 11 - shown when toggle is active and has data */}
                      {includeStatus11 &&
                        (yearData.sourceBreakdown.monthly.status11.value > 0 ||
                          yearData.sourceBreakdown.cumulative.status11.value > 0) && (
                          <Box component="tr">
                            <Box component="td" sx={{ py: 0.25, display: "flex", alignItems: "center", gap: 0.5 }}>
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  bgcolor: SOURCE_COLORS.status11,
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ color: SOURCE_COLORS.status11 }}>Status 11</span>
                            </Box>
                            <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "text.secondary", pl: 1 }}>
                              {formatCurrency(yearData.sourceBreakdown.monthly.status11.value)}
                            </Box>
                            {hasAnyAllocation && (
                              <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "secondary.main", pl: 1 }}>
                                -
                              </Box>
                            )}
                            {showIOGlobal && (
                              <Box
                                component="td"
                                sx={{ textAlign: "right", py: 0.25, color: "primary.main", pl: 1, pr: 1.5 }}
                              >
                                {formatCurrency(yearData.sourceBreakdown.monthly.status11.io)}
                              </Box>
                            )}
                            <Box
                              component="td"
                              sx={{
                                textAlign: "right",
                                py: 0.25,
                                color: "text.secondary",
                                borderLeft: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                                pl: 2,
                              }}
                            >
                              {formatCurrency(yearData.sourceBreakdown.cumulative.status11.value)}
                            </Box>
                            {hasAnyAllocation && (
                              <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "secondary.main", pl: 1 }}>
                                -
                              </Box>
                            )}
                            {showIOGlobal && (
                              <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "primary.main", pl: 1 }}>
                                {formatCurrency(yearData.sourceBreakdown.cumulative.status11.io)}
                              </Box>
                            )}
                          </Box>
                        )}
                      {/* CRM Modified */}
                      {(yearData.sourceBreakdown.monthly.crmModified.value > 0 ||
                        yearData.sourceBreakdown.cumulative.crmModified.value > 0) && (
                        <Box component="tr">
                          <Box component="td" sx={{ py: 0.25, display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                bgcolor: SOURCE_COLORS.crmModified,
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ color: SOURCE_COLORS.crmModified }}>CRM Modified</span>
                          </Box>
                          <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "text.secondary", pl: 1 }}>
                            {formatCurrency(yearData.sourceBreakdown.monthly.crmModified.value)}
                          </Box>
                          {hasAnyAllocation && (
                            <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "secondary.main", pl: 1 }}>
                              {formatCurrency(yearData.sourceBreakdown.monthly.crmModified.allocated)}
                            </Box>
                          )}
                          {showIOGlobal && (
                            <Box
                              component="td"
                              sx={{ textAlign: "right", py: 0.25, color: "primary.main", pl: 1, pr: 1.5 }}
                            >
                              {formatCurrency(yearData.sourceBreakdown.monthly.crmModified.io)}
                            </Box>
                          )}
                          <Box
                            component="td"
                            sx={{
                              textAlign: "right",
                              py: 0.25,
                              color: "text.secondary",
                              borderLeft: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                              pl: 2,
                            }}
                          >
                            {formatCurrency(yearData.sourceBreakdown.cumulative.crmModified.value)}
                          </Box>
                          {hasAnyAllocation && (
                            <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "secondary.main", pl: 1 }}>
                              {formatCurrency(yearData.sourceBreakdown.cumulative.crmModified.allocated)}
                            </Box>
                          )}
                          {showIOGlobal && (
                            <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "primary.main", pl: 1 }}>
                              {formatCurrency(yearData.sourceBreakdown.cumulative.crmModified.io)}
                            </Box>
                          )}
                        </Box>
                      )}
                      {/* Manual Opps */}
                      {(yearData.sourceBreakdown.monthly.manual.value > 0 ||
                        yearData.sourceBreakdown.cumulative.manual.value > 0) && (
                        <Box component="tr">
                          <Box component="td" sx={{ py: 0.25, display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                bgcolor: SOURCE_COLORS.manual,
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ color: SOURCE_COLORS.manual }}>Manual Opps</span>
                          </Box>
                          <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "text.secondary", pl: 1 }}>
                            {formatCurrency(yearData.sourceBreakdown.monthly.manual.value)}
                          </Box>
                          {hasAnyAllocation && (
                            <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "secondary.main", pl: 1 }}>
                              {formatCurrency(yearData.sourceBreakdown.monthly.manual.allocated)}
                            </Box>
                          )}
                          {showIOGlobal && (
                            <Box
                              component="td"
                              sx={{ textAlign: "right", py: 0.25, color: "primary.main", pl: 1, pr: 1.5 }}
                            >
                              {formatCurrency(yearData.sourceBreakdown.monthly.manual.io)}
                            </Box>
                          )}
                          <Box
                            component="td"
                            sx={{
                              textAlign: "right",
                              py: 0.25,
                              color: "text.secondary",
                              borderLeft: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                              pl: 2,
                            }}
                          >
                            {formatCurrency(yearData.sourceBreakdown.cumulative.manual.value)}
                          </Box>
                          {hasAnyAllocation && (
                            <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "secondary.main", pl: 1 }}>
                              {formatCurrency(yearData.sourceBreakdown.cumulative.manual.allocated)}
                            </Box>
                          )}
                          {showIOGlobal && (
                            <Box component="td" sx={{ textAlign: "right", py: 0.25, color: "primary.main", pl: 1 }}>
                              {formatCurrency(yearData.sourceBreakdown.cumulative.manual.io)}
                            </Box>
                          )}
                        </Box>
                      )}
                      {/* Total Row */}
                      <Box component="tr" sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.15)}` }}>
                        <Box component="td" sx={{ py: 0.5, fontWeight: 600, color: "text.primary" }}>
                          Total
                        </Box>
                        <Box
                          component="td"
                          sx={{ textAlign: "right", py: 0.5, fontWeight: 600, color: "text.primary", pl: 1 }}
                        >
                          {formatCurrency(
                            yearData.sourceBreakdown.monthly.crmOriginal.value +
                              yearData.sourceBreakdown.monthly.manual.value +
                              yearData.sourceBreakdown.monthly.crmModified.value +
                              (includeStatus11 ? yearData.sourceBreakdown.monthly.status11.value : 0)
                          )}
                        </Box>
                        {hasAnyAllocation && (
                          <Box
                            component="td"
                            sx={{ textAlign: "right", py: 0.5, fontWeight: 600, color: "secondary.main", pl: 1 }}
                          >
                            {formatCurrency(
                              yearData.sourceBreakdown.monthly.crmOriginal.allocated +
                                yearData.sourceBreakdown.monthly.manual.allocated +
                                yearData.sourceBreakdown.monthly.crmModified.allocated
                            )}
                          </Box>
                        )}
                        {showIOGlobal && (
                          <Box
                            component="td"
                            sx={{ textAlign: "right", py: 0.5, fontWeight: 600, color: "primary.main", pl: 1, pr: 1.5 }}
                          >
                            {formatCurrency(
                              yearData.sourceBreakdown.monthly.crmOriginal.io +
                                yearData.sourceBreakdown.monthly.manual.io +
                                yearData.sourceBreakdown.monthly.crmModified.io +
                                (includeStatus11 ? yearData.sourceBreakdown.monthly.status11.io : 0)
                            )}
                          </Box>
                        )}
                        <Box
                          component="td"
                          sx={{
                            textAlign: "right",
                            py: 0.5,
                            fontWeight: 600,
                            color: "text.primary",
                            borderLeft: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                            pl: 2,
                          }}
                        >
                          {formatCurrency(
                            yearData.sourceBreakdown.cumulative.crmOriginal.value +
                              yearData.sourceBreakdown.cumulative.manual.value +
                              yearData.sourceBreakdown.cumulative.crmModified.value +
                              (includeStatus11 ? yearData.sourceBreakdown.cumulative.status11.value : 0)
                          )}
                        </Box>
                        {hasAnyAllocation && (
                          <Box
                            component="td"
                            sx={{ textAlign: "right", py: 0.5, fontWeight: 600, color: "secondary.main", pl: 1 }}
                          >
                            {formatCurrency(
                              yearData.sourceBreakdown.cumulative.crmOriginal.allocated +
                                yearData.sourceBreakdown.cumulative.manual.allocated +
                                yearData.sourceBreakdown.cumulative.crmModified.allocated
                            )}
                          </Box>
                        )}
                        {showIOGlobal && (
                          <Box
                            component="td"
                            sx={{ textAlign: "right", py: 0.5, fontWeight: 600, color: "primary.main", pl: 1 }}
                          >
                            {formatCurrency(
                              yearData.sourceBreakdown.cumulative.crmOriginal.io +
                                yearData.sourceBreakdown.cumulative.manual.io +
                                yearData.sourceBreakdown.cumulative.crmModified.io +
                                (includeStatus11 ? yearData.sourceBreakdown.cumulative.status11.io : 0)
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    );
  }
);

CustomTooltip.displayName = "CustomTooltip";

export default CustomTooltip;
