import { memo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import { alpha, useTheme } from "@mui/material/styles";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { formatCurrency } from "../../../utils/formatters";
import { AccountLogo } from "../../common/AccountLogo";
import { STATUS_COLORS, STATUS_TEXT } from "../../../utils/constants";
import OpportunityExpandedDetails from "./OpportunityExpandedDetails";

interface MobileOpportunityCardProps {
  row: any;
  showNetRevenue: boolean;
  showIO: boolean;
  setEditOpportunity?: any;
  onManualOpportunityUpdated?: any;
}

const MobileOpportunityCard = memo(
  ({ row, showNetRevenue, showIO, setEditOpportunity, onManualOpportunityUpdated }: MobileOpportunityCardProps) => {
    const [expanded, setExpanded] = useState(false);
    const theme = useTheme();

    const statusNum = typeof row.status === "number" ? row.status : parseInt(String(row.status), 10);
    const rawColor = STATUS_COLORS[statusNum];
    const statusColor = (
      typeof rawColor === "object" && rawColor !== null ? rawColor : { color: "#999", bg: "#f5f5f5" }
    ) as { color: string; bg: string };
    const statusLabel = STATUS_TEXT[statusNum] || `Status ${statusNum}`;

    const revenue = showNetRevenue ? row.netRevenue : row.grossRevenue;
    const account = row.account || "-";
    const oppName = row.opportunity || row.opportunityId || "-";
    const winPct = row.winPct != null ? `${Math.round(row.winPct as number)}%` : null;

    return (
      <Box
        sx={{
          mx: 0.5,
          mb: 1,
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: alpha(statusColor.color, 0.2),
          borderLeft: `4px solid ${statusColor.color}`,
          boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.06)}`,
        }}
      >
        {/* Tappable card header */}
        <Box
          onClick={() => setExpanded(!expanded)}
          sx={{
            px: 1.5,
            py: 1.25,
            cursor: "pointer",
            "&:active": { bgcolor: alpha(statusColor.color, 0.04) },
          }}
        >
          {/* Row 1: Account + Revenue */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flex: 1, mr: 1, minWidth: 0 }}>
              <AccountLogo accountName={account} size={18} />
              <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }} noWrap>
                {account}
              </Typography>
            </Box>
            <Typography variant="body2" fontWeight={700} sx={{ flexShrink: 0, color: "text.primary" }}>
              {formatCurrency(revenue)}
            </Typography>
          </Box>

          {/* Row 2: Opportunity name */}
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", mb: 0.75 }}>
            {oppName}
          </Typography>

          {/* Row 3: Status + Win% + expand chevron */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Chip
              label={statusLabel}
              size="small"
              sx={{
                height: 22,
                fontSize: "0.65rem",
                fontWeight: 600,
                bgcolor: alpha(statusColor.color, 0.12),
                color: statusColor.color,
                border: `1px solid ${alpha(statusColor.color, 0.3)}`,
              }}
            />
            {winPct && (
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {winPct}
              </Typography>
            )}
            {row.isManual && (
              <Chip
                label="Manual"
                size="small"
                sx={{ height: 18, fontSize: "0.6rem" }}
                color="info"
                variant="outlined"
              />
            )}
            <Box sx={{ flex: 1 }} />
            <KeyboardArrowDownIcon
              sx={{
                fontSize: 20,
                color: "text.secondary",
                transform: expanded ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </Box>
        </Box>

        {/* Expanded details */}
        <Collapse in={expanded}>
          <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
            <OpportunityExpandedDetails
              row={row}
              showNetRevenue={showNetRevenue}
              showIO={showIO}
              setEditOpportunity={setEditOpportunity}
              onManualOpportunityUpdated={onManualOpportunityUpdated}
            />
          </Box>
        </Collapse>
      </Box>
    );
  }
);
MobileOpportunityCard.displayName = "MobileOpportunityCard";

export default MobileOpportunityCard;
