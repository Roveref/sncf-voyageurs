import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../../../common/DialogTransition";
import useResponsive from "../../../../hooks/useResponsive";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { fmtHD } from "../../constants/theme";

const CHART_H = 220;
const COL_W = 90;

interface WaterfallStep {
  value: number;
  offset: number;
  color: string;
  tc?: string;
  type: string;
  label: string;
}

interface WaterfallModalData {
  title: string;
  steps: WaterfallStep[];
  grossH: number;
  tu: number;
}

interface WaterfallModalProps {
  data: WaterfallModalData | null;
  onClose: () => void;
}

const WaterfallModal = memo(({ data, onClose }: WaterfallModalProps) => {
  const { isPhone } = useResponsive();
  if (!data) return null;

  return (
    <Dialog
      open={!!data}
      onClose={onClose}
      TransitionComponent={DialogTransition}
      maxWidth="md"
      fullScreen={isPhone}
      PaperProps={{
        sx: { borderRadius: isPhone ? 0 : 3, bgcolor: "#1e293b", color: "#fff", ...(!isPhone && { minWidth: 400 }) },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>{data.title}</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: "grey.400" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2, pb: 3 }}>
        {/* Waterfall chart */}
        <Box
          sx={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 1, mb: 2 }}
          style={{ height: CHART_H + 24 }}
        >
          {data.steps.map((s, i) => {
            const barH = data.grossH > 0 ? (s.value / data.grossH) * CHART_H : 0;
            const bottomOffset = data.grossH > 0 ? (s.offset / data.grossH) * CHART_H : 0;
            return (
              <Box
                key={i}
                sx={{ position: "relative", textAlign: "center" }}
                style={{ width: COL_W, height: CHART_H + 24 }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 48,
                    borderRadius: 1,
                    backgroundColor: s.color,
                  }}
                  style={{ bottom: bottomOffset, height: Math.max(3, barH) }}
                />
                <Box
                  component="span"
                  sx={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: "13px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    color: s.tc || "#fff",
                  }}
                  style={{ bottom: bottomOffset + Math.max(3, barH) + 4 }}
                >
                  {s.type === "sub" ? `\u2212${fmtHD(s.value)}` : fmtHD(s.value)}
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* X-axis labels */}
        <Box sx={{ display: "flex", justifyContent: "center", gap: 1, borderTop: "1px solid #475569", pt: 1 }}>
          {data.steps.map((s, i) => (
            <Box key={i} sx={{ textAlign: "center" }} style={{ width: COL_W }}>
              <Typography
                sx={{
                  fontSize: "12px",
                  lineHeight: 1.3,
                  fontWeight: s.type === "result" ? 700 : 400,
                  color: s.type === "result" ? "#fff" : s.tc || "#94a3b8",
                }}
              >
                {s.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Footer: TU */}
        <Box
          sx={{
            borderTop: "1px solid #475569",
            mt: 2,
            pt: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: "1.125rem", color: "#7dd3fc" }}>
            TU {data.tu.toFixed(1)}%
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
});

WaterfallModal.displayName = "WaterfallModal";

export default WaterfallModal;
