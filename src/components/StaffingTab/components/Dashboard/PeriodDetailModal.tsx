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
import TooltipProgressBar from "../Tooltip/TooltipProgressBar";
import { getHoursPerDay } from "../../constants";

interface PeriodDetailModalProps {
  data: {
    title: string;
    employeeName?: string | null;
    sapCatBreakdown: any[] | null;
    mdsCatBreakdown: any[];
    varianceRate: number | null;
    tuRate: number;
    workDays: number;
    sapDayCount: number;
    mdsDayCount?: number;
    isSap: boolean;
    empCount: number;
    fte?: number;
    realFte?: number;
    avgSapEmpCount: number;
    avgMdsEmpCount?: number;
    chargeableCombined: boolean;
    isMdsAvailable?: boolean;
    dataSource?: "all" | "sap" | "mds";
    notYetArrived?: string | null;
    alreadyDeparted?: string | null;
    grade?: string | null;
    precomputedSapH?: any;
    precomputedMdsH?: any;
    sapMissingH?: number;
    sapTopProjects?: { name: string; account: string; hours: number }[] | null;
    mdsTopProjects?: { name: string; account: string; hours: number }[] | null;
  } | null;
  onClose: () => void;
}

const NoDataMessage = memo(() => (
  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 4 }}>
    <Typography sx={{ fontSize: "0.875rem", color: "text.disabled", fontStyle: "italic" }}>
      No data available for this period
    </Typography>
  </Box>
));
NoDataMessage.displayName = "NoDataMessage";

const PeriodDetailModal = memo(({ data, onClose }: PeriodDetailModalProps) => {
  const { isPhone } = useResponsive();
  if (!data) return null;

  const ds = data.dataSource || "all";
  const singleSource = ds === "sap" || ds === "mds";
  const hasSapData = data.sapCatBreakdown && data.sapCatBreakdown.length > 0;
  const hasMdsData =
    (data.mdsCatBreakdown && data.mdsCatBreakdown.length > 0) ||
    (data.precomputedMdsH && data.precomputedMdsH.totalBase > 0);
  const fmtEtp = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const fte = data.fte ?? data.empCount;
  const realFte = data.realFte ?? fte;
  const mdsEmpCount = data.avgMdsEmpCount ?? fte;
  const mdsDays = data.mdsDayCount ?? data.workDays;
  // Show variance only when both sides have data
  const showVariance = ds === "all" && data.varianceRate != null && hasSapData && hasMdsData;
  const HPD = getHoursPerDay(data.grade || undefined);
  const fmtOv = (v: number) => {
    const s = v.toFixed(1);
    return s.endsWith(".0") ? s.slice(0, -2) : s;
  };
  // overH is averaged by sapDayCount in buildHoursSummary — multiply back to get total
  const sapOverH = (data.precomputedSapH?.overH || 0) * (data.sapDayCount || 1);
  const sapMissingH = data.sapMissingH || 0;
  const mdsOverH = data.precomputedMdsH?.overH || 0;
  const sapLabel = `${data.empCount} Emp. - ${fmtEtp(fte)} FTE${realFte < fte - 0.05 ? ` - ${fmtEtp(realFte)} Actual FTE` : ""} - ${data.sapDayCount} / ${data.workDays} - SAP`;
  const mdsLabel = `MDS - ${mdsDays} / ${data.workDays}${realFte < fte - 0.05 ? ` - ${fmtEtp(realFte)} Actual FTE` : ""} - ${fmtEtp(fte)} FTE - ${data.empCount} Emp.`;

  return (
    <Dialog
      open={!!data}
      onClose={onClose}
      TransitionComponent={DialogTransition}
      maxWidth={singleSource ? "md" : "lg"}
      fullScreen={isPhone}
      PaperProps={{
        sx: {
          borderRadius: isPhone ? 0 : 3,
          bgcolor: "#1e293b",
          color: "#fff",
          ...(!isPhone && { minWidth: singleSource ? 640 : 1650 }),
        },
      }}
    >
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", justifyContent: "center", pb: 1, position: "relative" }}
      >
        {data.employeeName && (
          <Typography sx={{ fontWeight: 600, fontSize: "1rem", position: "absolute", left: 24 }}>
            {data.employeeName}
          </Typography>
        )}
        <Typography sx={{ fontWeight: 600, fontSize: "1rem", textAlign: "center" }}>{data.title}</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: "grey.400", position: "absolute", right: 16 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 3 }}>
        {data.notYetArrived ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 4 }}>
            <Typography sx={{ fontSize: "0.875rem", color: "#94a3b8", fontStyle: "italic" }}>
              Not yet in workforce (arrival on{" "}
              {new Date(data.notYetArrived + "T00:00:00").toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              )
            </Typography>
          </Box>
        ) : data.alreadyDeparted ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 4 }}>
            <Typography sx={{ fontSize: "0.875rem", color: "#94a3b8", fontStyle: "italic" }}>
              Left workforce on{" "}
              {new Date(data.alreadyDeparted + "T00:00:00").toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Typography>
          </Box>
        ) : (
          <>
            {/* Variance badge */}
            {/* Single-source mode */}
            {singleSource ? (
              <Box>
                {ds === "sap" ? (
                  <>
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
                      {sapOverH >= 0.05 && (
                        <Typography sx={{ fontSize: "0.75rem", color: "#f97316", fontWeight: 600 }}>
                          Overcharged SAP: {fmtOv(sapOverH)} h
                        </Typography>
                      )}
                      {sapMissingH >= 0.05 && (
                        <Typography sx={{ fontSize: "0.75rem", color: "#f97316", fontWeight: 600 }}>
                          Missing SAP: {fmtOv(sapMissingH)} h
                        </Typography>
                      )}
                      <Typography sx={{ fontSize: "0.875rem", color: "#fbbf24", fontWeight: 500, ml: "auto" }}>
                        {sapLabel}
                      </Typography>
                    </Box>
                    {hasSapData ? (
                      <TooltipProgressBar
                        h={data.precomputedSapH}
                        grade={data.grade}
                        suffix="/j"
                        workDays={data.sapDayCount}
                        items={data.sapCatBreakdown}
                        isAvg
                        chCombined={data.chargeableCombined}
                        mirror
                        compact
                        hidePerDay
                        hideOver
                        hideDispo
                        topProjects={data.sapTopProjects}
                      />
                    ) : (
                      <NoDataMessage />
                    )}
                  </>
                ) : (
                  <>
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
                      <Typography sx={{ fontSize: "0.875rem", color: "text.disabled", fontWeight: 500 }}>
                        {mdsLabel}
                      </Typography>
                      {mdsOverH >= 0.05 && (
                        <Typography sx={{ fontSize: "0.75rem", color: "#f97316", fontWeight: 600, ml: "auto" }}>
                          Overcharged MDS: {fmtOv(mdsOverH * mdsDays)} h
                        </Typography>
                      )}
                    </Box>
                    {hasMdsData ? (
                      <TooltipProgressBar
                        h={data.precomputedMdsH}
                        grade={data.grade}
                        suffix="/j"
                        workDays={mdsDays}
                        items={data.mdsCatBreakdown}
                        isAvg
                        chCombined={data.chargeableCombined}
                        compact
                        overLabel="Overcharged MDS"
                        hidePerDay
                        hideOver
                        topProjects={data.mdsTopProjects}
                      />
                    ) : (
                      <NoDataMessage />
                    )}
                  </>
                )}
              </Box>
            ) : (
              /* Split view for 'all' mode: SAP (actual) | MDS */
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "stretch" }}>
                {showVariance &&
                  (() => {
                    const vr = data.varianceRate ?? 0;
                    const sapTu = data.precomputedSapH?.tu ?? 0;
                    const mdsTu = data.precomputedMdsH?.tu ?? 0;
                    const deltaPct = isNaN(sapTu - mdsTu) ? 0 : sapTu - mdsTu;
                    const badgeSx = (positive: boolean) => ({
                      px: 2,
                      py: 0.75,
                      borderRadius: "9999px",
                      fontSize: "1rem",
                      fontWeight: 700,
                      bgcolor: positive ? "rgba(6,78,59,0.4)" : "rgba(127,29,29,0.4)",
                      color: positive ? "#34d399" : "#f87171",
                    });
                    return (
                      <Box sx={{ width: "100%", display: "flex", justifyContent: "center", gap: 2 }}>
                        <Box component="span" sx={badgeSx(vr >= 0)}>
                          Δh {vr >= 0 ? "+" : ""}
                          {vr.toFixed(1)}h
                        </Box>
                        <Box component="span" sx={badgeSx(deltaPct >= 0)}>
                          Δ% {deltaPct >= 0 ? "+" : ""}
                          {deltaPct.toFixed(1)} pts
                        </Box>
                      </Box>
                    );
                  })()}
                <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1, flexWrap: "wrap" }}>
                    {sapOverH >= 0.05 && (
                      <Typography sx={{ fontSize: "0.75rem", color: "#f97316", fontWeight: 600 }}>
                        Overcharged SAP: {fmtOv(sapOverH)} h
                      </Typography>
                    )}
                    {sapMissingH >= 0.05 && (
                      <Typography sx={{ fontSize: "0.75rem", color: "#f97316", fontWeight: 600 }}>
                        Missing SAP: {fmtOv(sapMissingH)} h
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: "0.875rem", color: "#fbbf24", fontWeight: 500, ml: "auto" }}>
                      {sapLabel}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    {hasSapData ? (
                      <TooltipProgressBar
                        h={data.precomputedSapH}
                        grade={data.grade}
                        suffix="/j"
                        workDays={data.sapDayCount}
                        items={data.sapCatBreakdown}
                        isAvg
                        chCombined={data.chargeableCombined}
                        mirror
                        compact
                        hidePerDay
                        hideOver
                        hideDispo
                        topProjects={data.sapTopProjects}
                      />
                    ) : (
                      <NoDataMessage />
                    )}
                  </Box>
                </Box>
                <Box sx={{ width: 0, position: "relative", alignSelf: "stretch" }}>
                  <Box sx={{ position: "absolute", left: -0.5, width: "1px", top: 0, bottom: 0, bgcolor: "#475569" }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
                    <Typography sx={{ fontSize: "0.875rem", color: "text.disabled", fontWeight: 500 }}>
                      {mdsLabel}
                    </Typography>
                    {mdsOverH >= 0.05 && (
                      <Typography sx={{ fontSize: "0.75rem", color: "#f97316", fontWeight: 600, ml: "auto" }}>
                        Overcharged MDS: {fmtOv(mdsOverH * mdsDays)} h
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    {hasMdsData ? (
                      <TooltipProgressBar
                        h={data.precomputedMdsH}
                        grade={data.grade}
                        suffix="/j"
                        workDays={mdsDays}
                        items={data.mdsCatBreakdown}
                        isAvg
                        chCombined={data.chargeableCombined}
                        compact
                        overLabel="Overcharged MDS"
                        hidePerDay
                        hideOver
                        topProjects={data.mdsTopProjects}
                      />
                    ) : (
                      <NoDataMessage />
                    )}
                  </Box>
                </Box>
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
});

PeriodDetailModal.displayName = "PeriodDetailModal";

export default PeriodDetailModal;
