import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { alpha, useTheme } from "@mui/material/styles";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import UpdateIcon from "@mui/icons-material/Update";
import BlockIcon from "@mui/icons-material/Block";
import AssignmentIcon from "@mui/icons-material/Assignment";

import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import WarningIcon from "@mui/icons-material/Warning";

/**
 * Displays the comparison view after a JSON import.
 * Shows created/updated/skipped items with side-by-side comparison.
 */
const ImportResultsPanel = memo(({ importResult }: any) => {
  const theme = useTheme();

  if (!importResult) return null;

  if (importResult.error) {
    return (
      <Box sx={{ mx: 2, mb: 2 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.error.main, 0.08),
            border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <WarningIcon color="error" />
          <Typography variant="body2" color="error.main">
            {importResult.error}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!importResult.details) return null;

  const d = importResult.details;

  const ComparisonCard = ({
    item,
    decisionColor,
    DecisionIcon,
    decisionLabel,
    leftLabel,
    leftContent,
    rightLabel,
    rightContent,
    reason,
    reasonPrefix,
  }: any) => (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: alpha((theme.palette as any)[decisionColor].main, 0.04),
        border: `1px solid ${alpha((theme.palette as any)[decisionColor].main, 0.2)}`,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {item.opportunityId && (
            <Chip label={item.opportunityId} size="small" variant="outlined" sx={{ fontSize: "0.65rem", height: 18 }} />
          )}
          <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
            {item.opportunityName || item.accountName}
          </Typography>
        </Box>
        <Chip
          icon={<DecisionIcon sx={{ fontSize: 12 }} />}
          label={decisionLabel}
          size="small"
          color={decisionColor}
          sx={{ fontWeight: 600, height: 20, "& .MuiChip-label": { px: 1 } }}
        />
      </Box>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "stretch" }}>
        <Box
          sx={{
            flex: 1,
            p: 1,
            borderRadius: 1,
            bgcolor: leftContent ? alpha(theme.palette.grey[500], 0.06) : alpha(theme.palette.grey[300], 0.08),
            border: `1px solid ${alpha(theme.palette.grey[400], 0.15)}`,
          }}
        >
          <Typography
            variant="caption"
            fontWeight={600}
            color="text.secondary"
            sx={{ display: "block", mb: 0.5, textTransform: "uppercase", fontSize: "0.6rem", letterSpacing: 0.5 }}
          >
            {leftLabel}
          </Typography>
          {leftContent || (
            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
              No existing data
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <ArrowForwardIcon sx={{ fontSize: 18, color: `${decisionColor}.main` }} />
        </Box>
        <Box
          sx={{
            flex: 1,
            p: 1,
            borderRadius: 1,
            bgcolor: alpha((theme.palette as any)[decisionColor].main, 0.08),
            border: `1px solid ${alpha((theme.palette as any)[decisionColor].main, 0.2)}`,
          }}
        >
          <Typography
            variant="caption"
            fontWeight={600}
            color={`${decisionColor}.main`}
            sx={{ display: "block", mb: 0.5, textTransform: "uppercase", fontSize: "0.6rem", letterSpacing: 0.5 }}
          >
            {rightLabel}
          </Typography>
          {rightContent}
        </Box>
      </Box>
      <Typography variant="caption" color={`${decisionColor}.dark`} fontWeight={500} sx={{ display: "block", mt: 1 }}>
        {reasonPrefix} {reason}
      </Typography>
    </Box>
  );

  const HighlightField = ({ label, value, highlighted, color }: any) => (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{
        bgcolor: highlighted ? alpha((theme.palette as any)[color || "warning"].main, 0.2) : "transparent",
        px: 0.5,
        borderRadius: 0.5,
        fontSize: "0.7rem",
        fontWeight: highlighted ? 600 : 400,
      }}
    >
      <strong>{label}:</strong> {value}
    </Typography>
  );

  return (
    <Box sx={{ mx: 2, mb: 2 }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Summary Chips */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Chip
            icon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
            label={`${(d.statusOverrides.created?.length || 0) + (d.manualOpportunities.created?.length || 0) + (d.manualAccounts?.created?.length || 0) + (d.actionsComments?.actions?.created?.length || 0)} Created`}
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
          <Chip
            icon={<UpdateIcon sx={{ fontSize: 16 }} />}
            label={`${(d.statusOverrides.updated?.length || 0) + (d.manualOpportunities.updated?.length || 0) + (d.actionsComments?.actions?.updated?.length || 0)} Updated`}
            size="small"
            color="info"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
          <Chip
            icon={<BlockIcon sx={{ fontSize: 16 }} />}
            label={`${(d.statusOverrides.skipped?.length || 0) + (d.manualOpportunities.skipped?.length || 0) + (d.manualAccounts?.skipped?.length || 0) + (d.actionsComments?.actions?.skipped?.length || 0)} Skipped`}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        </Box>

        {/* Status Overrides Section */}
        {(d.statusOverrides.updated?.length > 0 || d.statusOverrides.skipped?.length > 0) && (
          <Box>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
            >
              <SwapHorizIcon sx={{ fontSize: 18 }} /> Status Overrides
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {[...(d.statusOverrides.updated || []), ...(d.statusOverrides.skipped || [])].map((item, idx) => {
                const isUpdated = item.decision === "updated";
                const decisionColor = isUpdated ? "info" : "warning";
                const DecisionIcon = isUpdated ? UpdateIcon : BlockIcon;
                const statusChanged = item.existing && item.existing.statusCode !== item.imported.newStatusCode;

                return (
                  <ComparisonCard
                    key={`override-${idx}`}
                    item={item}
                    decisionColor={decisionColor}
                    DecisionIcon={DecisionIcon}
                    decisionLabel={isUpdated ? "Applied" : "Skipped"}
                    leftLabel="CRM Status"
                    leftContent={
                      item.existing ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            bgcolor: statusChanged ? alpha(theme.palette.warning.main, 0.2) : "transparent",
                            px: 0.5,
                            borderRadius: 0.5,
                          }}
                        >
                          {item.existing.status}
                        </Typography>
                      ) : null
                    }
                    rightLabel="Import Status"
                    rightContent={
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          bgcolor: statusChanged ? alpha(theme.palette[decisionColor].main, 0.2) : "transparent",
                          px: 0.5,
                          borderRadius: 0.5,
                          fontWeight: statusChanged ? 600 : 400,
                        }}
                      >
                        {item.imported.newStatus}
                      </Typography>
                    }
                    reason={item.reason}
                    reasonPrefix={isUpdated ? "✓" : "⊘"}
                  />
                );
              })}
            </Box>
          </Box>
        )}

        {/* Manual Opportunities Section */}
        {(d.manualOpportunities.created?.length > 0 ||
          d.manualOpportunities.updated?.length > 0 ||
          d.manualOpportunities.skipped?.length > 0) && (
          <Box>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
            >
              <NoteAddIcon sx={{ fontSize: 18 }} /> Manual Opportunities
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {[
                ...(d.manualOpportunities.created || []),
                ...(d.manualOpportunities.updated || []),
                ...(d.manualOpportunities.skipped || []),
              ].map((item, idx) => {
                const isCreated = item.decision === "created";
                const isUpdated = item.decision === "updated";
                const decisionColor = isCreated ? "success" : isUpdated ? "info" : "warning";
                const DecisionIcon = isCreated ? AddCircleOutlineIcon : isUpdated ? UpdateIcon : BlockIcon;
                const statusChanged = item.existing && item.existing.statusCode !== item.imported.statusCode;

                return (
                  <ComparisonCard
                    key={`manual-${idx}`}
                    item={item}
                    decisionColor={decisionColor}
                    DecisionIcon={DecisionIcon}
                    decisionLabel={isCreated ? "Created" : isUpdated ? "Updated" : "Skipped"}
                    leftLabel="Existing"
                    leftContent={
                      item.existing ? (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                          <HighlightField label="Status" value={item.existing.status} highlighted={statusChanged} />
                          <HighlightField label="Revenue" value={item.existing.revenue} highlighted={false} />
                        </Box>
                      ) : null
                    }
                    rightLabel="Imported"
                    rightContent={
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                        <HighlightField
                          label="Status"
                          value={item.imported.status}
                          highlighted={statusChanged}
                          color={decisionColor}
                        />
                        <HighlightField label="Revenue" value={item.imported.revenue} highlighted={false} />
                      </Box>
                    }
                    reason={item.reason}
                    reasonPrefix={isCreated ? "✓" : isUpdated ? "↻" : "⊘"}
                  />
                );
              })}
            </Box>
          </Box>
        )}

        {/* Manual Accounts Section */}
        {(d.manualAccounts?.created?.length > 0 || d.manualAccounts?.skipped?.length > 0) && (
          <Box>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
            >
              <AddBusinessIcon sx={{ fontSize: 18 }} /> Manual Accounts
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {[...(d.manualAccounts.created || []), ...(d.manualAccounts.skipped || [])].map((item, idx) => {
                const isCreated = item.decision === "created";
                const decisionColor = isCreated ? "success" : "warning";
                const DecisionIcon = isCreated ? AddCircleOutlineIcon : BlockIcon;

                return (
                  <Box
                    key={`account-${idx}`}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
                      border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography variant="caption" fontWeight={600}>
                        {item.accountName}
                      </Typography>
                      <Chip
                        icon={<DecisionIcon sx={{ fontSize: 12 }} />}
                        label={isCreated ? "Created" : "Skipped"}
                        size="small"
                        color={decisionColor}
                        sx={{ fontWeight: 600, height: 20, "& .MuiChip-label": { px: 1 } }}
                      />
                    </Box>
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                        <strong>Parent:</strong> {item.imported.parent}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                        <strong>Segment:</strong> {item.imported.segment}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                        <strong>Country:</strong> {item.imported.country}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      color={`${decisionColor}.dark`}
                      fontWeight={500}
                      sx={{ display: "block", mt: 1 }}
                    >
                      {isCreated ? "✓" : "⊘"} {item.reason}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Actions Section */}
        {(d.actionsComments?.actions?.created?.length > 0 ||
          d.actionsComments?.actions?.updated?.length > 0 ||
          d.actionsComments?.actions?.skipped?.length > 0) && (
          <Box>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
            >
              <AssignmentIcon sx={{ fontSize: 18 }} /> Actions
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {[
                ...(d.actionsComments.actions.created || []),
                ...(d.actionsComments.actions.updated || []),
                ...(d.actionsComments.actions.skipped || []),
              ].map((item, idx) => {
                const isCreated = item.decision === "created";
                const isUpdated = item.decision === "updated";
                const decisionColor = isCreated ? "success" : isUpdated ? "info" : "warning";
                const DecisionIcon = isCreated ? AddCircleOutlineIcon : isUpdated ? UpdateIcon : BlockIcon;

                return (
                  <ComparisonCard
                    key={`action-${idx}`}
                    item={item}
                    decisionColor={decisionColor}
                    DecisionIcon={DecisionIcon}
                    decisionLabel={isCreated ? "Created" : isUpdated ? "Updated" : "Skipped"}
                    leftLabel="Existing"
                    leftContent={
                      item.existing ? (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                          <HighlightField
                            label="Desc"
                            value={`${item.existing.description?.substring(0, 40)}${item.existing.description?.length > 40 ? "..." : ""}`}
                            highlighted={item.changes?.includes("description")}
                          />
                          <HighlightField
                            label="Owner"
                            value={item.existing.owner}
                            highlighted={item.changes?.includes("owner")}
                          />
                          <HighlightField
                            label="Status"
                            value={item.existing.status}
                            highlighted={item.changes?.includes("status")}
                          />
                        </Box>
                      ) : null
                    }
                    rightLabel="Imported"
                    rightContent={
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                        <HighlightField
                          label="Desc"
                          value={`${item.imported.description?.substring(0, 40)}${item.imported.description?.length > 40 ? "..." : ""}`}
                          highlighted={item.changes?.includes("description")}
                          color={decisionColor}
                        />
                        <HighlightField
                          label="Owner"
                          value={item.imported.owner}
                          highlighted={item.changes?.includes("owner")}
                          color={decisionColor}
                        />
                        <HighlightField
                          label="Status"
                          value={item.imported.status}
                          highlighted={item.changes?.includes("status")}
                          color={decisionColor}
                        />
                      </Box>
                    }
                    reason={item.reason}
                    reasonPrefix={isCreated ? "✓" : isUpdated ? "↻" : "⊘"}
                  />
                );
              })}
            </Box>
          </Box>
        )}

        {/* Empty State */}
        {d.statusOverrides.updated?.length === 0 &&
          d.statusOverrides.skipped?.length === 0 &&
          d.manualOpportunities.created?.length === 0 &&
          d.manualOpportunities.updated?.length === 0 &&
          d.manualOpportunities.skipped?.length === 0 &&
          d.manualAccounts?.created?.length === 0 &&
          d.manualAccounts?.skipped?.length === 0 &&
          d.actionsComments?.actions?.created?.length === 0 &&
          d.actionsComments?.actions?.updated?.length === 0 &&
          d.actionsComments?.actions?.skipped?.length === 0 && (
            <Box sx={{ p: 3, textAlign: "center", bgcolor: alpha(theme.palette.grey[500], 0.05), borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No items were found in the import file.
              </Typography>
            </Box>
          )}
      </Box>
    </Box>
  );
});

ImportResultsPanel.displayName = "ImportResultsPanel";

export default ImportResultsPanel;
