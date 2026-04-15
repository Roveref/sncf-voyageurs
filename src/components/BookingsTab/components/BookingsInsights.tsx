import React, { memo } from "react";
import Grid from "@mui/material/Grid2";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import { useTheme, alpha } from "@mui/material/styles";

import { animations } from "../../../styles/animations";
import { AnimatedCurrency, AnimatedCount, AnimatedPercent } from "../../common/AnimatedNumbers";

interface InsightsData {
  bookings: any[];
  losses: any[];
  bookingsTotalRevenue: number;
  lossesTotalRevenue: number;
  bookingsAllocatedRevenue: number;
  lossesAllocatedRevenue: number;
  bookingsCalculatedRevenue: number;
  lossesCalculatedRevenue: number;
  avgBookingSize: number;
  avgLossSize: number;
  avgBookingAllocated: number;
  avgLossAllocated: number;
  avgBookingCalculated: number;
  avgLossCalculated: number;
  hasAllocation: boolean;
  winRateNewContract: number;
  newContractWins: number;
  newContractTotal: number;
  winRateExtension: number;
  extensionWins: number;
  extensionTotal: number;
}

interface BookingsInsightsProps {
  insightsData: InsightsData;
  showLost: boolean;
  showIO: boolean;
  bookingTargets?: { annualGross: number; annualNet: number; ioGross: number };
  showNetRevenue?: boolean;
}

const BookingsInsights = memo(
  ({ insightsData, showLost, showIO, bookingTargets, showNetRevenue }: BookingsInsightsProps) => {
    const theme = useTheme();

    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          mb: 3,
          overflow: "visible",
          transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          "&:hover": {
            transform: "perspective(1000px) rotateX(-1.5deg) rotateY(1.5deg) translateY(-4px)",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
          },
          ...animations.cardEntrance(0),
          position: "relative",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h6" gutterBottom fontWeight={600}>
            {showLost ? "Lost Insights" : "Booking Insights"}
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3} sx={{ px: 2, py: 1 }}>
          {/* Total Bookings / Total Lost */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={{ overflow: "visible" }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                height: "100%",
                transition:
                  "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                "&:hover": {
                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                  transform: "translateY(-4px)",
                  boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
                },
                ...animations.cardEntrance(100),
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {showLost ? "Total Lost" : "Total Bookings"}
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  position: "relative",
                  minHeight: 70,
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                    <AnimatedCurrency
                      value={showLost ? insightsData.lossesTotalRevenue : insightsData.bookingsTotalRevenue}
                      color={showLost ? "error.main" : "success.main"}
                    />
                    {/* Show allocation arrow when there's a difference (independent of showIO) */}
                    {insightsData.hasAllocation &&
                      (showLost ? insightsData.lossesAllocatedRevenue : insightsData.bookingsAllocatedRevenue) !==
                        (showLost ? insightsData.lossesTotalRevenue : insightsData.bookingsTotalRevenue) && (
                        <>
                          <Typography variant="body2" color="text.secondary">
                            {"\u2192"}
                          </Typography>
                          <AnimatedCurrency
                            value={
                              showLost ? insightsData.lossesAllocatedRevenue : insightsData.bookingsAllocatedRevenue
                            }
                            variant="h5"
                            fontWeight={600}
                            color="secondary.main"
                          />
                        </>
                      )}
                  </Box>
                  {/* Show % of annual target when configured */}
                  {!showLost &&
                    bookingTargets &&
                    (() => {
                      const target = showNetRevenue ? bookingTargets.annualNet : bookingTargets.annualGross;
                      if (target <= 0) return null;
                      const pct = (insightsData.bookingsTotalRevenue / target) * 100;
                      const color = pct >= 100 ? "#047857" : pct >= 75 ? "#b45309" : "#dc2626";
                      return (
                        <Typography variant="caption" sx={{ mt: 0.5, fontWeight: 600, color, display: "block" }}>
                          {pct.toFixed(0)}% of annual target
                        </Typography>
                      );
                    })()}
                  {/* Show I&O when showIO is enabled */}
                  {showIO &&
                    (showLost ? insightsData.lossesCalculatedRevenue : insightsData.bookingsCalculatedRevenue) > 0 && (
                      <Typography variant="body2" color="primary.main" sx={{ mt: 0.5 }}>
                        (I&O:{" "}
                        <AnimatedCurrency
                          value={
                            showLost ? insightsData.lossesCalculatedRevenue : insightsData.bookingsCalculatedRevenue
                          }
                          variant="body2"
                          fontWeight={400}
                          color="primary.main"
                        />
                        )
                      </Typography>
                    )}
                </Box>
                <AnimatedCount
                  value={showLost ? insightsData.losses.length : insightsData.bookings.length}
                  variant="h5"
                  fontWeight={700}
                  color="text.secondary"
                  sx={{ ml: 2 }}
                />
              </Box>
            </Box>
          </Grid>

          {/* Average Booking Size / Average Lost Size */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={{ overflow: "visible" }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                height: "100%",
                transition:
                  "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                "&:hover": {
                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                  transform: "translateY(-4px)",
                  boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
                },
                ...animations.cardEntrance(200),
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {showLost ? "Avg. Lost Size" : "Avg. Booking Size"}
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 70,
                  justifyContent: "center",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                  <AnimatedCurrency
                    value={showLost ? insightsData.avgLossSize : insightsData.avgBookingSize}
                    color="info.main"
                  />
                  {/* Show allocation arrow when there's a difference (independent of showIO) */}
                  {insightsData.hasAllocation &&
                    (showLost ? insightsData.avgLossAllocated : insightsData.avgBookingAllocated) !==
                      (showLost ? insightsData.avgLossSize : insightsData.avgBookingSize) && (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          {"\u2192"}
                        </Typography>
                        <AnimatedCurrency
                          value={showLost ? insightsData.avgLossAllocated : insightsData.avgBookingAllocated}
                          variant="h5"
                          fontWeight={600}
                          color="secondary.main"
                        />
                      </>
                    )}
                </Box>
                {/* Show I&O when showIO is enabled */}
                {showIO && (showLost ? insightsData.avgLossCalculated : insightsData.avgBookingCalculated) > 0 && (
                  <Typography variant="body2" color="primary.main" sx={{ mt: 0.5 }}>
                    (I&O:{" "}
                    <AnimatedCurrency
                      value={showLost ? insightsData.avgLossCalculated : insightsData.avgBookingCalculated}
                      variant="body2"
                      fontWeight={400}
                      color="primary.main"
                    />
                    )
                  </Typography>
                )}
              </Box>
            </Box>
          </Grid>

          {/* Win Rates */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={{ overflow: "visible" }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                height: "100%",
                transition:
                  "background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1), transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                "&:hover": {
                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                  transform: "translateY(-4px)",
                  boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
                },
                ...animations.cardEntrance(300),
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  Win Rate
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  minHeight: 70,
                }}
              >
                {/* New Contract Win Rate */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      New Contract
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                    <AnimatedPercent value={insightsData.winRateNewContract} variant="h5" color="warning.main" />
                    <Typography variant="body2" color="text.secondary">
                      ({insightsData.newContractWins}/{insightsData.newContractTotal})
                    </Typography>
                  </Box>
                </Box>

                {/* Extension / Sell-on Win Rate */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Extension / Sell-on
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                    <AnimatedPercent value={insightsData.winRateExtension} variant="h5" color="warning.main" />
                    <Typography variant="body2" color="text.secondary">
                      ({insightsData.extensionWins}/{insightsData.extensionTotal})
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    );
  }
);

BookingsInsights.displayName = "BookingsInsights";

export default BookingsInsights;
