/**
 * ImportItemCard — Reusable comparison card for import results.
 * Renders a before/after comparison for actions or comments.
 */

import React, { memo } from "react";
import { Box, Typography, Chip, alpha, useTheme } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import UpdateIcon from "@mui/icons-material/Update";
import BlockIcon from "@mui/icons-material/Block";

interface FieldDef {
  key: string;
  label: string;
}

interface ImportItemCardProps {
  item: any;
  keyPrefix: string;
  idx: number;
  fields: FieldDef[];
}

const ImportItemCard = memo(({ item, keyPrefix, idx, fields }: ImportItemCardProps) => {
  const theme = useTheme();

  const isCreated = item.decision === "created";
  const isUpdated = item.decision === "updated";
  const decisionColor: "success" | "info" | "warning" = isCreated ? "success" : isUpdated ? "info" : "warning";
  const DecisionIcon = isCreated ? AddCircleOutlineIcon : isUpdated ? UpdateIcon : BlockIcon;

  return (
    <Box
      key={`${keyPrefix}-${idx}`}
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: alpha(theme.palette[decisionColor].main, 0.04),
        border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.2)}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip label={item.opportunityId} size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 20 }} />
          <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ maxWidth: 300 }}>
            {item.opportunityName}
          </Typography>
        </Box>
        <Chip
          icon={<DecisionIcon sx={{ fontSize: 14 }} />}
          label={isCreated ? "Created" : isUpdated ? "Updated" : "Skipped"}
          size="small"
          color={decisionColor}
          sx={{ fontWeight: 600, height: 24 }}
        />
      </Box>

      {/* Comparison */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "stretch" }}>
        {/* Left: Existing */}
        <Box
          sx={{
            flex: 1,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: item.existing ? alpha(theme.palette.grey[500], 0.08) : alpha(theme.palette.grey[300], 0.1),
            border: `1px solid ${alpha(theme.palette.grey[400], 0.2)}`,
          }}
        >
          <Typography
            variant="caption"
            fontWeight={600}
            color="text.secondary"
            sx={{
              display: "block",
              mb: 1,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Existing
          </Typography>
          {item.existing ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {fields.map((f) => (
                <Typography
                  key={f.key}
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    bgcolor: item.changes?.includes(f.key) ? alpha(theme.palette.warning.main, 0.2) : "transparent",
                    px: 0.5,
                    borderRadius: 0.5,
                  }}
                >
                  <strong>{f.label}:</strong> {item.existing[f.key]}
                </Typography>
              ))}
            </Box>
          ) : (
            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
              No existing data
            </Typography>
          )}
        </Box>

        {/* Arrow */}
        <Box sx={{ display: "flex", alignItems: "center", px: 0.5 }}>
          <ArrowForwardIcon sx={{ fontSize: 24, color: `${decisionColor}.main` }} />
        </Box>

        {/* Right: Imported */}
        <Box
          sx={{
            flex: 1,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette[decisionColor].main, 0.08),
            border: `1px solid ${alpha(theme.palette[decisionColor].main, 0.3)}`,
          }}
        >
          <Typography
            variant="caption"
            fontWeight={600}
            color={`${decisionColor}.main`}
            sx={{
              display: "block",
              mb: 1,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Imported
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {fields.map((f) => (
              <Typography
                key={f.key}
                variant="caption"
                color="text.secondary"
                sx={{
                  bgcolor: item.changes?.includes(f.key)
                    ? alpha(theme.palette[decisionColor].main, 0.2)
                    : "transparent",
                  px: 0.5,
                  borderRadius: 0.5,
                  fontWeight: item.changes?.includes(f.key) ? 600 : 400,
                }}
              >
                <strong>{f.label}:</strong> {item.imported[f.key]}
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Reason */}
      <Box
        sx={{
          mt: 1.5,
          pt: 1,
          borderTop: `1px dashed ${alpha(theme.palette[decisionColor].main, 0.3)}`,
        }}
      >
        <Typography variant="caption" color={`${decisionColor}.dark`} fontWeight={500}>
          {isCreated ? "\u2713" : isUpdated ? "\u21BB" : "\u2298"} {item.reason}
        </Typography>
      </Box>
    </Box>
  );
});

ImportItemCard.displayName = "ImportItemCard";

export default ImportItemCard;
