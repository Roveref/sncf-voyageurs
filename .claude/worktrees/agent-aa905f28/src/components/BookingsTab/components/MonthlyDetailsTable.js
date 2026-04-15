import React, { useState, useMemo } from "react";
import { Box, Typography, IconButton, Collapse, alpha } from "@mui/material";
import TableChartIcon from "@mui/icons-material/TableChart";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

/**
 * Monthly Details Table Component - Modern Card Design
 *
 * Displays monthly booking data in a beautiful horizontal card layout with:
 * - Collapsible section
 * - Monthly cards with year comparisons (only selected years)
 * - Visual progress bars
 * - Cumulative values for all selected years
 * - Year-over-year variation indicators
 *
 * PERFORMANCE: Memoized to prevent unnecessary re-renders
 */
const MonthlyDetailsTable = React.memo(
  ({
    cumulativeData,
    years,
    selectedYears = [],
    yearColors: parentYearColors = {},
    hasFiltersApplied,
    showNetRevenue,
    showIO = true,
    theme,
  }) => {
    const [showDetailsTable, setShowDetailsTable] = useState(false);

    const toggleTable = () => {
      setShowDetailsTable(!showDetailsTable);
    };

    // Use selected years only, sorted chronologically
    const displayYears = useMemo(() => {
      const yearsToShow = selectedYears.length > 0 ? selectedYears : years;
      return [...yearsToShow].sort((a, b) => a - b);
    }, [years, selectedYears]);

    // Use colors from parent (same as chart) or fallback to generated colors
    const yearColors = useMemo(() => {
      // If parent provided colors, use them
      if (Object.keys(parentYearColors).length > 0) {
        const colors = {};
        displayYears.forEach((year) => {
          colors[year] = parentYearColors[year]?.bar || parentYearColors[year] || "#CC2931";
        });
        return colors;
      }

      // Fallback: generate colors locally
      const colors = {};
      const numYears = displayYears.length;
      displayYears.forEach((year, index) => {
        const intensity = numYears === 1 ? 1 : index / (numYears - 1);
        const r = Math.round(255 - (255 - 204) * intensity);
        const g = Math.round(204 - (204 - 41) * intensity);
        const b = Math.round(208 - (208 - 49) * intensity);
        colors[year] = `rgb(${r}, ${g}, ${b})`;
      });
      return colors;
    }, [displayYears, parentYearColors]);

    // Find max value for progress bar scaling
    const maxMonthlyValue = useMemo(() => {
      if (!cumulativeData || cumulativeData.length === 0) return 1;
      let max = 0;
      cumulativeData.forEach((monthData) => {
        displayYears.forEach((year) => {
          const value = monthData[`${year}`] || 0;
          if (value > max) max = value;
        });
      });
      return max || 1;
    }, [cumulativeData, displayYears]);

    /**
     * Format currency amounts - full format with French locale (X XXX XXX €)
     */
    const formatCurrency = (amount) => {
      if (amount === 0) return "-";
      return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    /**
     * Calculate variation percentage between two values
     */
    const calculateVariation = (current, previous) => {
      if (previous === 0 && current === 0) return null;
      if (previous === 0) return current > 0 ? Infinity : null;
      return ((current - previous) / previous) * 100;
    };

    /**
     * Format variation percentage
     */
    const formatVariation = (variation) => {
      if (variation === null) return null;
      if (variation === Infinity) return "new";
      const sign = variation > 0 ? "+" : "";
      return `${sign}${variation.toFixed(0)}%`;
    };

    /**
     * Get variation color based on value
     */
    const getVariationColor = (variation) => {
      if (variation === null) return "text.disabled";
      if (variation === Infinity) return "info.main";
      if (variation > 0) return "success.main";
      if (variation < 0) return "error.main";
      return "text.secondary";
    };

    // Check if current month using array index (0 = January)
    const isCurrentMonth = (monthIndex) => {
      const now = new Date();
      const currentMonthIndex = now.getMonth(); // 0-indexed (January = 0)
      const currentYear = now.getFullYear();
      return monthIndex === currentMonthIndex && displayYears.includes(currentYear);
    };

    // Don't render if no years selected
    if (displayYears.length === 0) {
      return null;
    }

    // Calculate dynamic height based on number of years and showIO
    const numYears = displayYears.length;
    const baseHeight = 80;
    const perYearHeight = 45; // Height per year for monthly + cumulative sections
    const ioHeight = showIO ? 25 : 0;
    const cardMinHeight = baseHeight + numYears * perYearHeight + ioHeight;

    return (
      <Box
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: alpha(theme.palette.background.paper, 0.5),
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        {/* Header with toggle button */}
        <Box
          sx={{
            px: 3,
            py: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            },
          }}
          onClick={toggleTable}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TableChartIcon sx={{ color: "primary.main", fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                Monthly Detailed Data
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {displayYears.join(", ")} • {cumulativeData.length} months
              </Typography>
            </Box>
          </Box>

          <IconButton
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              transition: "all 0.3s ease-in-out",
              transform: showDetailsTable ? "rotate(180deg)" : "rotate(0deg)",
              "&:hover": {
                bgcolor: alpha(theme.palette.primary.main, 0.15),
              },
            }}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Box>

        {/* Collapsible content */}
        <Collapse in={showDetailsTable}>
          <Box sx={{ px: 1.5, pb: 2.5, pt: 1 }}>
            {/* Year legend */}
            <Box sx={{ display: "flex", gap: 2, mb: 1.5, px: 0.5, flexWrap: "wrap" }}>
              {displayYears.map((year) => (
                <Box key={year} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: 0.5,
                      bgcolor: yearColors[year],
                    }}
                  />
                  <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.65rem" }}>
                    {year}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Monthly cards grid - fits 12 months */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(12, 1fr)",
                gap: 1,
              }}
            >
              {cumulativeData.map((monthData, index) => {
                const isCurrent = isCurrentMonth(index);

                // Short month name
                const shortMonth = monthData.monthName?.substring(0, 3) || `M${monthData.month}`;

                return (
                  <Box
                    key={index}
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: isCurrent
                        ? alpha(theme.palette.info.main, 0.1)
                        : alpha(theme.palette.background.paper, 1),
                      border: `1px solid ${
                        isCurrent ? alpha(theme.palette.info.main, 0.4) : alpha(theme.palette.divider, 0.12)
                      }`,
                      transition: "all 0.2s ease-in-out",
                      position: "relative",
                      minHeight: cardMinHeight,
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.08)}`,
                        borderColor: alpha(theme.palette.primary.main, 0.3),
                      },
                    }}
                  >
                    {/* Month name with current indicator */}
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                      <Typography
                        fontWeight={700}
                        sx={{
                          color: isCurrent ? "info.main" : "text.primary",
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {shortMonth}
                      </Typography>
                      {isCurrent && (
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            bgcolor: "info.main",
                          }}
                        />
                      )}
                    </Box>

                    {/* Monthly values section */}
                    <Typography
                      sx={{
                        fontSize: "0.55rem",
                        color: "text.secondary",
                        fontWeight: 500,
                        mb: 0.5,
                        textTransform: "uppercase",
                        letterSpacing: 0.3,
                      }}
                    >
                      Monthly
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      {displayYears.map((year) => {
                        const value = monthData[`${year}`] || 0;
                        const progressWidth = (value / maxMonthlyValue) * 100;

                        return (
                          <Box key={year}>
                            <Typography
                              sx={{
                                color: yearColors[year],
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                lineHeight: 1.2,
                              }}
                            >
                              {formatCurrency(value)}
                            </Typography>
                            {/* Mini progress bar */}
                            <Box
                              sx={{
                                height: 3,
                                borderRadius: 1.5,
                                bgcolor: alpha(yearColors[year], 0.15),
                                overflow: "hidden",
                                mt: 0.25,
                              }}
                            >
                              <Box
                                sx={{
                                  height: "100%",
                                  width: `${progressWidth}%`,
                                  bgcolor: yearColors[year],
                                  borderRadius: 1.5,
                                }}
                              />
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>

                    {/* Cumulative values section - for all selected years */}
                    <Box
                      sx={{
                        mt: 1.25,
                        pt: 0.75,
                        borderTop: `1px dashed ${alpha(theme.palette.divider, 0.25)}`,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "0.55rem",
                          color: "text.secondary",
                          fontWeight: 500,
                          mb: 0.5,
                          textTransform: "uppercase",
                          letterSpacing: 0.3,
                        }}
                      >
                        Cumulated
                      </Typography>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                        {displayYears.map((year, yearIndex) => {
                          const cumulativeValue = monthData[`${year}_cumulative`] || 0;
                          const previousYear = yearIndex > 0 ? displayYears[yearIndex - 1] : null;
                          const previousCumulativeValue = previousYear
                            ? monthData[`${previousYear}_cumulative`] || 0
                            : null;

                          const variation =
                            previousCumulativeValue !== null
                              ? calculateVariation(cumulativeValue, previousCumulativeValue)
                              : null;
                          const variationText = formatVariation(variation);
                          const variationColor = getVariationColor(variation);

                          return (
                            <Box key={year} sx={{ mb: variationText && previousYear ? 0.75 : 0 }}>
                              <Typography
                                sx={{
                                  color: yearColors[year],
                                  fontSize: "0.7rem",
                                  fontWeight: 700,
                                  lineHeight: 1.3,
                                }}
                              >
                                {formatCurrency(cumulativeValue)}
                              </Typography>
                              {variationText && previousYear && (
                                <Box
                                  sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    mt: 0.5,
                                    px: 0.75,
                                    py: 0.25,
                                    borderRadius: 1,
                                    bgcolor:
                                      variation === Infinity
                                        ? alpha(theme.palette.info.main, 0.15)
                                        : variation > 0
                                          ? alpha(theme.palette.success.main, 0.15)
                                          : variation < 0
                                            ? alpha(theme.palette.error.main, 0.15)
                                            : alpha(theme.palette.grey[500], 0.15),
                                  }}
                                >
                                  <Typography
                                    sx={{
                                      color: variationColor,
                                      fontSize: "0.55rem",
                                      fontWeight: 700,
                                      lineHeight: 1,
                                    }}
                                  >
                                    {variationText} vs {previousYear}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>

                    {/* I&O section if enabled - for all selected years */}
                    {showIO && (
                      <Box
                        sx={{
                          mt: 0.75,
                          pt: 0.5,
                          borderTop: `1px dashed ${alpha(theme.palette.divider, 0.15)}`,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: "0.5rem",
                            color: "primary.main",
                            fontWeight: 500,
                            mb: 0.25,
                            textTransform: "uppercase",
                            letterSpacing: 0.3,
                          }}
                        >
                          I&O
                        </Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.15 }}>
                          {displayYears.map((year) => (
                            <Typography
                              key={year}
                              sx={{
                                color: "primary.main",
                                fontSize: "0.6rem",
                                fontWeight: 600,
                                lineHeight: 1.2,
                              }}
                            >
                              {formatCurrency(monthData[`${year}_io_cumulative`] || 0)}
                            </Typography>
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Collapse>
      </Box>
    );
  }
);

MonthlyDetailsTable.displayName = "MonthlyDetailsTable";

export default MonthlyDetailsTable;
