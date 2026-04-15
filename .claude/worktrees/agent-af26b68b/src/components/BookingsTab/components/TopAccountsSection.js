import React, { useState, useEffect, useMemo } from "react";
import {
  Grid,
  Paper,
  Typography,
  Box,
  useTheme,
  alpha,
  TableSortLabel,
  LinearProgress,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableFooter,
  TableRow,
  TableCell,
  Chip,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import BusinessIcon from "@mui/icons-material/Business";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";

import { calculateRevenueWithSegmentLogic } from "../../../utils/dataUtils";
import { IO_TARGET } from "../../../utils/constants";

const formatCurrency = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const TopAccountsSection = ({ data, showNetRevenue = false, showIO = true, topN = 10 }) => {
  const theme = useTheme();
  const [sortConfig, setSortConfig] = useState({
    key: "mainAmount",
    direction: "desc",
  });

  const [topAccounts, setTopAccounts] = useState([]);
  const [allAccountsTotal, setAllAccountsTotal] = useState(0);

  useEffect(() => {
    if (!data || data.length === 0) {
      setTopAccounts([]);
      setAllAccountsTotal(0);
      return;
    }

    const opportunities = [...data];

    // Total across all accounts
    const totalAll = opportunities.reduce((sum, opp) => {
      const amount = showIO
        ? calculateRevenueWithSegmentLogic(opp, showNetRevenue)
        : showNetRevenue
          ? opp["Net Revenue"] || 0
          : opp["Gross Revenue"] || 0;
      return sum + amount;
    }, 0);

    // Group by account
    const accountMap = {};

    opportunities.forEach((opp) => {
      const account = opp.Account || "Unknown";
      if (!accountMap[account]) {
        accountMap[account] = {
          account,
          segment: opp["Sub Segment Code"] || "",
          mainAmount: 0,
          totalAmount: 0,
          allocatedAmount: 0,
          opportunityCount: 0,
          minDeal: Infinity,
          maxDeal: 0,
          serviceLines: new Set(),
          ioAmount: 0,
        };
      }

      // Total value (Gross/Net)
      const totalValue = showNetRevenue ? opp["Net Revenue"] || 0 : opp["Gross Revenue"] || 0;

      // Allocated value
      const allocatedValue =
        opp["Is Allocated"] && opp["Allocated Gross Revenue"]
          ? showNetRevenue
            ? opp["Allocated Net Revenue"] || 0
            : opp["Allocated Gross Revenue"]
          : totalValue;

      // I&O value
      const ioValue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);

      // Main amount for sorting (use I&O if showIO, otherwise total)
      const dealAmount = showIO ? ioValue : totalValue;

      accountMap[account].mainAmount += dealAmount;
      accountMap[account].totalAmount += totalValue;
      accountMap[account].allocatedAmount += allocatedValue;
      accountMap[account].ioAmount += ioValue;
      accountMap[account].opportunityCount += 1;

      if (dealAmount < accountMap[account].minDeal) {
        accountMap[account].minDeal = dealAmount;
      }
      if (dealAmount > accountMap[account].maxDeal) {
        accountMap[account].maxDeal = dealAmount;
      }

      if (opp["Service Line 1"]) {
        accountMap[account].serviceLines.add(opp["Service Line 1"]);
      }
    });

    // Convert to array
    const accountsArray = Object.values(accountMap).map((acc) => ({
      ...acc,
      avgDeal: acc.opportunityCount > 0 ? acc.mainAmount / acc.opportunityCount : 0,
      minDeal: acc.minDeal === Infinity ? 0 : acc.minDeal,
      serviceLines: Array.from(acc.serviceLines),
      percentOfTotal: totalAll > 0 ? (acc.mainAmount / totalAll) * 100 : 0,
      ioProgress: showIO ? Math.min((acc.ioAmount / IO_TARGET) * 100, 100) : 0,
      // Check if there's a real allocation difference
      hasAllocation: acc.allocatedAmount !== acc.totalAmount && acc.allocatedAmount > 0,
    }));

    // Sort by main amount descending
    accountsArray.sort((a, b) => b.mainAmount - a.mainAmount);

    const topSlice = accountsArray.slice(0, topN);

    setAllAccountsTotal(totalAll);
    setTopAccounts(topSlice);
  }, [data, topN, showIO, showNetRevenue]);

  // Handle sort
  const handleSort = (key) => {
    let direction = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });

    const sorted = [...topAccounts].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];
      // For string columns
      if (key === "account") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return direction === "asc" ? -1 : 1;
      if (aVal > bVal) return direction === "asc" ? 1 : -1;
      return 0;
    });

    setTopAccounts(sorted);
  };

  // KPIs
  const kpis = useMemo(() => {
    if (topAccounts.length === 0) {
      return {
        total: 0,
        totalAmount: 0,
        allocatedAmount: 0,
        ioAmount: 0,
        oppCount: 0,
        avgDeal: 0,
        topAccount: "-",
        topAmount: 0,
        hasAllocation: false,
      };
    }

    const total = topAccounts.reduce((sum, acc) => sum + acc.mainAmount, 0);
    const totalAmount = topAccounts.reduce((sum, acc) => sum + acc.totalAmount, 0);
    const allocatedAmount = topAccounts.reduce((sum, acc) => sum + acc.allocatedAmount, 0);
    const ioAmount = topAccounts.reduce((sum, acc) => sum + acc.ioAmount, 0);
    const oppCount = topAccounts.reduce((sum, acc) => sum + acc.opportunityCount, 0);
    const avgDeal = oppCount > 0 ? total / oppCount : 0;
    const hasAllocation = allocatedAmount !== totalAmount && allocatedAmount > 0;

    // Top account is the first in original sorted order
    const sorted = [...topAccounts].sort((a, b) => b.mainAmount - a.mainAmount);
    const topAccount = sorted[0]?.account || "-";
    const topAmount = sorted[0]?.mainAmount || 0;

    return { total, totalAmount, allocatedAmount, ioAmount, oppCount, avgDeal, topAccount, topAmount, hasAllocation };
  }, [topAccounts]);

  // Progress bar color
  const getProgressColor = (pct) => {
    if (pct >= 100) return theme.palette.success.main;
    if (pct >= 70) return theme.palette.success.light;
    if (pct >= 30) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  // Service line colors
  const slColors = {
    Technology: theme.palette.primary.main,
    Operations: theme.palette.warning.main,
    People: theme.palette.success.main,
    Strategy: theme.palette.secondary.main,
    Finance: theme.palette.info.main,
  };

  const getSlColor = (sl) => slColors[sl] || theme.palette.grey[500];

  return (
    <Box>
      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          {
            label: showIO ? "Total I&O" : "Total Bookings",
            value: formatCurrency(kpis.total),
            sub: `of ${formatCurrency(allAccountsTotal)} total`,
            icon: <TrendingUpIcon />,
            color: theme.palette.primary.main,
          },
          {
            label: "Opportunities",
            value: kpis.oppCount,
            sub: `Top ${topAccounts.length} accounts`,
            icon: <ReceiptLongIcon />,
            color: theme.palette.info.main,
          },
          {
            label: "Average Size",
            value: formatCurrency(kpis.avgDeal),
            sub: "per opportunity",
            icon: <BusinessIcon />,
            color: theme.palette.warning.main,
          },
          {
            label: "Top Account",
            value: kpis.topAccount.length > 20 ? kpis.topAccount.substring(0, 20) + "..." : kpis.topAccount,
            sub: formatCurrency(kpis.topAmount),
            icon: <EmojiEventsIcon />,
            color: theme.palette.success.main,
          },
        ].map((kpi, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Box
              sx={{
                p: 2.5,
                borderRadius: 3,
                bgcolor: alpha(kpi.color, 0.06),
                border: "none",
                transition: "all 0.2s ease",
                "&:hover": {
                  bgcolor: alpha(kpi.color, 0.1),
                  transform: "translateY(-2px)",
                  boxShadow: `0 4px 12px ${alpha(kpi.color, 0.15)}`,
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Box sx={{ color: kpi.color, display: "flex" }}>{kpi.icon}</Box>
                <Typography
                  variant="caption"
                  fontWeight={600}
                  color="text.secondary"
                  sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
                >
                  {kpi.label}
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={700} sx={{ color: kpi.color }}>
                {kpi.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {kpi.sub}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Top Accounts Table */}
      <TableContainer
        sx={{
          borderRadius: 2,
          border: "none",
          overflow: "hidden",
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <TableCell sx={{ fontWeight: 700, py: 1.5 }}>
                <TableSortLabel
                  active={sortConfig.key === "account"}
                  direction={sortConfig.key === "account" ? sortConfig.direction : "asc"}
                  onClick={() => handleSort("account")}
                >
                  Account
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, py: 1.5, minWidth: 200 }}>
                <TableSortLabel
                  active={sortConfig.key === "mainAmount"}
                  direction={sortConfig.key === "mainAmount" ? sortConfig.direction : "desc"}
                  onClick={() => handleSort("mainAmount")}
                >
                  Amount {showIO && "(I&O)"}
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                <TableSortLabel
                  active={sortConfig.key === "opportunityCount"}
                  direction={sortConfig.key === "opportunityCount" ? sortConfig.direction : "desc"}
                  onClick={() => handleSort("opportunityCount")}
                >
                  # Opps
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                <TableSortLabel
                  active={sortConfig.key === "minDeal"}
                  direction={sortConfig.key === "minDeal" ? sortConfig.direction : "desc"}
                  onClick={() => handleSort("minDeal")}
                >
                  Min
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                <TableSortLabel
                  active={sortConfig.key === "maxDeal"}
                  direction={sortConfig.key === "maxDeal" ? sortConfig.direction : "desc"}
                  onClick={() => handleSort("maxDeal")}
                >
                  Max
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                <TableSortLabel
                  active={sortConfig.key === "avgDeal"}
                  direction={sortConfig.key === "avgDeal" ? sortConfig.direction : "desc"}
                  onClick={() => handleSort("avgDeal")}
                >
                  Average
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Service Lines</TableCell>
              {showIO && (
                <TableCell align="center" sx={{ fontWeight: 700, py: 1.5 }}>
                  1M€ Target
                </TableCell>
              )}
              <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                <TableSortLabel
                  active={sortConfig.key === "percentOfTotal"}
                  direction={sortConfig.key === "percentOfTotal" ? sortConfig.direction : "desc"}
                  onClick={() => handleSort("percentOfTotal")}
                >
                  % Total
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {topAccounts.map((account, index) => (
              <TableRow
                key={account.account}
                hover
                sx={{
                  "&:nth-of-type(even)": {
                    bgcolor: alpha(theme.palette.grey[500], 0.04),
                  },
                  transition: "background-color 0.15s ease",
                }}
              >
                <TableCell sx={{ py: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor:
                          index < 3 ? alpha(theme.palette.warning.main, 0.15) : alpha(theme.palette.grey[500], 0.1),
                        color: index < 3 ? theme.palette.warning.dark : theme.palette.text.secondary,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </Typography>
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 220 }}>
                      {account.account}
                    </Typography>
                    {account.segment && (
                      <Chip
                        label={account.segment}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.6rem",
                          fontWeight: 600,
                          bgcolor: alpha(theme.palette.grey[500], 0.1),
                          color: theme.palette.text.secondary,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 0.5,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography variant="body2" fontWeight={700} color="text.primary">
                      {formatCurrency(account.totalAmount)}
                    </Typography>
                    {account.hasAllocation && (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          →
                        </Typography>
                        <Typography variant="body2" fontWeight={600} color="secondary.main">
                          {formatCurrency(account.allocatedAmount)}
                        </Typography>
                      </>
                    )}
                    {showIO && (
                      <Typography variant="caption" color="primary.main" sx={{ ml: 0.5 }}>
                        (I&O: {formatCurrency(account.ioAmount)})
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Chip
                    label={account.opportunityCount}
                    size="small"
                    sx={{
                      height: 24,
                      fontWeight: 700,
                      bgcolor: alpha(theme.palette.info.main, 0.1),
                      color: theme.palette.info.main,
                    }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" color="text.secondary">
                    {formatCurrency(account.minDeal)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" color="text.secondary">
                    {formatCurrency(account.maxDeal)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={500}>
                    {formatCurrency(account.avgDeal)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {account.serviceLines.map((sl) => (
                      <Chip
                        key={sl}
                        label={sl}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          bgcolor: alpha(getSlColor(sl), 0.12),
                          color: getSlColor(sl),
                          border: `1px solid ${alpha(getSlColor(sl), 0.3)}`,
                        }}
                      />
                    ))}
                  </Box>
                </TableCell>
                {showIO && (
                  <TableCell align="center" sx={{ minWidth: 140 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={account.ioProgress}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: alpha(theme.palette.grey[300], 0.4),
                            "& .MuiLinearProgress-bar": {
                              borderRadius: 4,
                              bgcolor: getProgressColor(account.ioProgress),
                            },
                          }}
                        />
                      </Box>
                      <Typography variant="caption" fontWeight={700} sx={{ minWidth: 38, textAlign: "right" }}>
                        {account.ioProgress.toFixed(0)}%
                      </Typography>
                    </Box>
                  </TableCell>
                )}
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={600} color="secondary.main">
                    {account.percentOfTotal.toFixed(1)}%
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          {/* Footer */}
          <TableFooter>
            <TableRow
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                "& td, & th": {
                  borderBottom: "none",
                  py: 1.5,
                },
              }}
            >
              <TableCell>
                <Typography variant="body2" fontWeight={700} color="primary.main">
                  TOTAL (Top {topAccounts.length})
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Box
                  sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5, flexWrap: "wrap" }}
                >
                  <Typography variant="body2" fontWeight={700} color="text.primary">
                    {formatCurrency(kpis.totalAmount)}
                  </Typography>
                  {kpis.hasAllocation && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        →
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="secondary.main">
                        {formatCurrency(kpis.allocatedAmount)}
                      </Typography>
                    </>
                  )}
                  {showIO && (
                    <Typography variant="caption" fontWeight={600} color="primary.main" sx={{ ml: 0.5 }}>
                      (I&O: {formatCurrency(kpis.ioAmount)})
                    </Typography>
                  )}
                </Box>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={700}>
                  {kpis.oppCount}
                </Typography>
              </TableCell>
              <TableCell colSpan={3} />
              <TableCell />
              {showIO && <TableCell />}
              <TableCell align="right">
                <Typography variant="body2" fontWeight={700}>
                  {allAccountsTotal > 0 ? ((kpis.total / allAccountsTotal) * 100).toFixed(1) : 0}%
                </Typography>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default TopAccountsSection;
