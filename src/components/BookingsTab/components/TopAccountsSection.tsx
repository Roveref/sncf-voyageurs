import React, { useState, useEffect, useMemo, memo } from "react";
import { AccountLogo } from "../../common/AccountLogo";
import Grid from "@mui/material/Grid2";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import { useTheme, alpha } from "@mui/material/styles";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

import { calculateRevenueWithSegmentLogic } from "../../../utils/dataUtils";
import { IO_TARGET } from "../../../utils/constants";
import { formatCurrency } from "../../../utils/formatters";

const TopAccountsSection = ({
  data,
  showNetRevenue = false,
  showIO = true,
  topN = 10,
}: {
  data: any[];
  showNetRevenue?: boolean;
  showIO?: boolean;
  topN?: number;
}) => {
  const theme = useTheme();
  const [sortKey, setSortKey] = useState<string>("mainAmount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [topAccounts, setTopAccounts] = useState<any[]>([]);
  const [allAccountsTotal, setAllAccountsTotal] = useState(0);

  useEffect(() => {
    if (!data || data.length === 0) {
      setTopAccounts([]);
      setAllAccountsTotal(0);
      return;
    }

    const opportunities = [...data];
    const totalAll = opportunities.reduce(
      (sum, opp) => sum + (showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0),
      0
    );

    const accountMap: Record<string, any> = {};
    opportunities.forEach((opp) => {
      const account = opp.account || "Unknown";
      if (!accountMap[account]) {
        accountMap[account] = {
          account,
          segment: opp.subSegmentCode || "",
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
      const totalValue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
      const allocatedValue =
        opp.isAllocated && opp.allocatedGrossRevenue
          ? showNetRevenue
            ? opp.allocatedNetRevenue || 0
            : opp.allocatedGrossRevenue
          : totalValue;
      const ioValue = calculateRevenueWithSegmentLogic(opp, showNetRevenue);
      accountMap[account].mainAmount += totalValue;
      accountMap[account].totalAmount += totalValue;
      accountMap[account].allocatedAmount += allocatedValue;
      accountMap[account].ioAmount += ioValue;
      accountMap[account].opportunityCount += 1;
      if (totalValue < accountMap[account].minDeal) accountMap[account].minDeal = totalValue;
      if (totalValue > accountMap[account].maxDeal) accountMap[account].maxDeal = totalValue;
      if (opp.serviceLine1) accountMap[account].serviceLines.add(opp.serviceLine1);
    });

    const accountsArray = Object.values(accountMap).map((acc: any) => ({
      ...acc,
      avgDeal: acc.opportunityCount > 0 ? acc.mainAmount / acc.opportunityCount : 0,
      minDeal: acc.minDeal === Infinity ? 0 : acc.minDeal,
      serviceLines: Array.from(acc.serviceLines),
      percentOfTotal: totalAll > 0 ? (acc.mainAmount / totalAll) * 100 : 0,
      hasAllocation: acc.allocatedAmount !== acc.totalAmount && acc.allocatedAmount > 0,
    }));

    accountsArray.sort((a, b) => b.mainAmount - a.mainAmount);
    setAllAccountsTotal(totalAll);
    setTopAccounts(accountsArray.slice(0, topN));
  }, [data, topN, showIO, showNetRevenue]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    return [...topAccounts].sort((a, b) => {
      const av = typeof a[sortKey] === "string" ? a[sortKey].toLowerCase() : a[sortKey];
      const bv = typeof b[sortKey] === "string" ? b[sortKey].toLowerCase() : b[sortKey];
      return sortDir === "asc" ? (av < bv ? -1 : 1) : av > bv ? -1 : 1;
    });
  }, [topAccounts, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const total = topAccounts.reduce((s, a) => s + a.mainAmount, 0);
    const oppCount = topAccounts.reduce((s, a) => s + a.opportunityCount, 0);
    return { total, oppCount };
  }, [topAccounts]);

  // Column header component
  const ColHeader = ({
    label,
    field,
    align = "left",
    flex,
  }: {
    label: string;
    field: string;
    align?: string;
    flex: number;
  }) => (
    <Box
      onClick={() => handleSort(field)}
      sx={{
        flex,
        display: "flex",
        alignItems: "center",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        cursor: "pointer",
        userSelect: "none",
        gap: 0.25,
      }}
    >
      <Typography variant="caption" fontWeight={400} sx={{ fontSize: "0.75rem", color: "#374151" }}>
        {label}
      </Typography>
      {sortKey === field &&
        (sortDir === "desc" ? (
          <ArrowDownwardIcon sx={{ fontSize: 12, color: "text.disabled" }} />
        ) : (
          <ArrowUpwardIcon sx={{ fontSize: 12, color: "text.disabled" }} />
        ))}
    </Box>
  );

  if (topAccounts.length === 0) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {/* Column headers — aligned with OpportunityTableHeader style */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "2.5fr 1.2fr 0.6fr 0.8fr 0.8fr 0.8fr 1fr",
          columnGap: "16px",
          px: 2.5,
          py: 0.5,
          mb: 1,
          color: "#374151",
          fontSize: "0.75rem",
          fontWeight: 400,
        }}
      >
        <ColHeader label="Account" field="account" flex={1} />
        <ColHeader label="Amount" field="mainAmount" align="right" flex={1} />
        <ColHeader label="Opps" field="opportunityCount" align="right" flex={1} />
        <ColHeader label="Min" field="minDeal" align="right" flex={1} />
        <ColHeader label="Max" field="maxDeal" align="right" flex={1} />
        <ColHeader label="Average" field="avgDeal" align="right" flex={1} />
        <ColHeader label="% Total" field="percentOfTotal" align="right" flex={1} />
      </Box>

      {/* Account rows — card style like OpportunityRow */}
      {sorted.map((account, index) => (
        <Box
          key={account.account}
          sx={{
            display: "grid",
            gridTemplateColumns: "2.5fr 1.2fr 0.6fr 0.8fr 0.8fr 0.8fr 1fr",
            columnGap: "16px",
            alignItems: "center",
            px: 2.5,
            py: 1.5,
            borderRadius: 3,
            bgcolor: "#f8f9fa",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
            transition: "background-color 0.15s ease, box-shadow 0.15s ease",
            "&:hover": { bgcolor: "#eceef0" },
          }}
        >
          {/* Account name */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, overflow: "hidden" }}>
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: "0.65rem",
                bgcolor: index < 3 ? alpha(theme.palette.warning.main, 0.12) : alpha(theme.palette.grey[500], 0.08),
                color: index < 3 ? theme.palette.warning.dark : theme.palette.text.secondary,
              }}
            >
              {index + 1}
            </Typography>
            <AccountLogo accountName={account.account} size={18} />
            <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: "0.82rem" }}>
              {account.account}
            </Typography>
            {account.segment && (
              <Chip
                label={account.segment}
                size="small"
                sx={{
                  height: 18,
                  fontSize: "0.6rem",
                  fontWeight: 600,
                  bgcolor: alpha(theme.palette.grey[500], 0.08),
                  color: "text.secondary",
                  flexShrink: 0,
                }}
              />
            )}
          </Box>

          {/* Amount */}
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.82rem" }}>
              {formatCurrency(account.totalAmount)}
            </Typography>
            {account.hasAllocation && (
              <Typography variant="caption" color="secondary.main" sx={{ fontSize: "0.7rem" }}>
                → {formatCurrency(account.allocatedAmount)}
              </Typography>
            )}
            {showIO && (
              <Typography variant="caption" color="primary.main" sx={{ fontSize: "0.68rem", display: "block" }}>
                I&O: {formatCurrency(account.ioAmount)}
              </Typography>
            )}
          </Box>

          {/* Opp count */}
          <Box sx={{ textAlign: "right" }}>
            <Chip
              label={account.opportunityCount}
              size="small"
              sx={{
                height: 22,
                fontWeight: 700,
                fontSize: "0.75rem",
                bgcolor: alpha(theme.palette.info.main, 0.08),
                color: theme.palette.info.main,
              }}
            />
          </Box>

          {/* Min */}
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "right", fontSize: "0.8rem" }}>
            {formatCurrency(account.minDeal)}
          </Typography>

          {/* Max */}
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "right", fontSize: "0.8rem" }}>
            {formatCurrency(account.maxDeal)}
          </Typography>

          {/* Average */}
          <Typography variant="body2" fontWeight={500} sx={{ textAlign: "right", fontSize: "0.8rem" }}>
            {formatCurrency(account.avgDeal)}
          </Typography>

          {/* % Total with mini progress bar */}
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ fontSize: "0.8rem" }}>
              {account.percentOfTotal.toFixed(1)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(account.percentOfTotal, 100)}
              sx={{
                height: 3,
                borderRadius: 2,
                mt: 0.5,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                "& .MuiLinearProgress-bar": { bgcolor: theme.palette.primary.main, borderRadius: 2 },
              }}
            />
          </Box>
        </Box>
      ))}

      {/* Footer total row */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "2.5fr 1.2fr 0.6fr 0.8fr 0.8fr 0.8fr 1fr",
          columnGap: "16px",
          alignItems: "center",
          px: 2.5,
          py: 1.5,
          borderRadius: 3,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          mt: 0.5,
        }}
      >
        <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ fontSize: "0.82rem" }}>
          TOTAL (Top {topAccounts.length})
        </Typography>
        <Typography variant="body2" fontWeight={700} sx={{ textAlign: "right", fontSize: "0.82rem" }}>
          {formatCurrency(kpis.total)}
        </Typography>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.82rem" }}>
            {kpis.oppCount}
          </Typography>
        </Box>
        <Box />
        <Box />
        <Box />
        <Typography variant="body2" fontWeight={700} sx={{ textAlign: "right", fontSize: "0.82rem" }}>
          {allAccountsTotal > 0 ? ((kpis.total / allAccountsTotal) * 100).toFixed(1) : 0}%
        </Typography>
      </Box>
    </Box>
  );
};

export default memo(TopAccountsSection);
