import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
import { formatCurrency } from "../../../utils/formatters";
import { brand } from "../../../config/brandConfig";

const PipelineStockTooltip = React.memo(
  ({ active, payload, label, pipelineData, showNetRevenue, showExits, showIO, yearColors = {} }: any) => {
    const theme = useTheme();

    if (!active || !payload || payload.length === 0 || !pipelineData) return null;

    const monthIndex = pipelineData.findIndex((m: any) => m.monthName === label);
    if (monthIndex === -1) return null;

    const monthData = pipelineData[monthIndex];

    // Extract unique years from payload
    const years = [
      ...new Set(
        payload
          .map((p: any) => {
            const match = p.dataKey?.match(/^(\d{4})/);
            return match ? Number(match[1]) : null;
          })
          .filter(Boolean)
      ),
    ] as number[];

    if (years.length === 0) return null;

    const isDark = theme.palette.mode === "dark";

    return (
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: "blur(10px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
          overflow: "hidden",
          minWidth: 520,
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {label}
          </Typography>
        </Box>

        {/* Year cards */}
        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {years
            .sort((a, b) => b - a)
            .map((year) => {
              const color = yearColors[year]?.bar || brand.primaryDark;
              const entriesVal = monthData[`${year}_entries`];
              const entriesAllocated = monthData[`${year}_entries_allocated`];
              const entriesCount = monthData[`${year}_entries_count`] || 0;
              const exitsVal = monthData[`${year}_exits`];
              const exitsAllocated = monthData[`${year}_exits_allocated`];
              const exitsCount = monthData[`${year}_exits_count`] || 0;
              const bookedVal = monthData[`${year}_exits_booked`] || 0;
              const lostVal = monthData[`${year}_exits_lost`] || 0;
              const stockVal = monthData[`${year}_stock`];
              const stockAllocated = monthData[`${year}_stock_allocated`];
              const stockCount = monthData[`${year}_stock_count`] || 0;
              const stockIO = monthData[`${year}_stock_io`] || 0;
              const entriesIO = monthData[`${year}_entries_io`] || 0;
              const exitsIO = monthData[`${year}_exits_io`] || 0;
              const hasAllocation = monthData[`${year}_has_allocation`];

              if (entriesVal == null && exitsVal == null && stockVal == null) return null;

              return (
                <Box key={year} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: alpha(color, 0.04) }}>
                  {/* Year header */}
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.75,
                      bgcolor: alpha(color, 0.1),
                      borderRadius: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
                    <Typography variant="subtitle2" fontWeight={600}>
                      {year}
                    </Typography>
                  </Box>

                  {/* Two columns: Flow + Stock */}
                  <Box sx={{ display: "flex" }}>
                    {/* Left: Flow (entries or exits) */}
                    <Box sx={{ flex: 1, p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.5 }}>
                        {showExits ? "Exits" : "Entries"}
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5, whiteSpace: "nowrap" }}>
                        {formatCurrency(showExits ? exitsVal : entriesVal, showNetRevenue)}
                        {hasAllocation && (
                          <Typography
                            component="span"
                            sx={{ color: "text.secondary", fontSize: "0.8rem", fontWeight: 400 }}
                          >
                            {" → "}
                            {formatCurrency(showExits ? exitsAllocated : entriesAllocated, showNetRevenue)}
                          </Typography>
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {showExits ? exitsCount : entriesCount} opp
                        {(showExits ? exitsCount : entriesCount) > 1 ? "s" : ""}
                      </Typography>
                      {showIO && (showExits ? exitsIO : entriesIO) > 0 && (
                        <Typography variant="caption" sx={{ display: "block", color: brand.primaryDark }}>
                          I&O: {formatCurrency(showExits ? exitsIO : entriesIO, showNetRevenue)}
                        </Typography>
                      )}
                      {showExits && (bookedVal > 0 || lostVal > 0) && (
                        <Box sx={{ mt: 0.5 }}>
                          {bookedVal > 0 && (
                            <Typography variant="caption" color="success.main" sx={{ display: "block" }}>
                              Booked: {formatCurrency(bookedVal, showNetRevenue)}
                            </Typography>
                          )}
                          {lostVal > 0 && (
                            <Typography variant="caption" color="error.main" sx={{ display: "block" }}>
                              Lost: {formatCurrency(lostVal, showNetRevenue)}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>

                    {/* Right: Stock */}
                    <Box sx={{ flex: 1, p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.5 }}>
                        Pipeline stock
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5, whiteSpace: "nowrap" }}>
                        {formatCurrency(stockVal, showNetRevenue)}
                        {hasAllocation && (
                          <Typography
                            component="span"
                            sx={{ color: "text.secondary", fontSize: "0.8rem", fontWeight: 400 }}
                          >
                            {" → "}
                            {formatCurrency(stockAllocated, showNetRevenue)}
                          </Typography>
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {stockCount} opp{stockCount > 1 ? "s" : ""}
                      </Typography>
                      {showIO && stockIO > 0 && (
                        <Typography variant="caption" sx={{ display: "block", color: brand.primaryDark }}>
                          I&O: {formatCurrency(stockIO, showNetRevenue)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
        </Box>
      </Box>
    );
  }
);

PipelineStockTooltip.displayName = "PipelineStockTooltip";
export default PipelineStockTooltip;
