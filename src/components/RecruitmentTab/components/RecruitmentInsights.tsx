import React from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid2";
import { alpha, useTheme } from "@mui/material/styles";
import { useAnimatedNumber } from "../../../hooks/useAnimatedNumber";
import { animations } from "../../../styles/animations";
import type { FunnelData } from "../utils/calculations";

interface Props {
  funnel: FunnelData;
  activeCount: number;
  avgActiveDays: number;
  multiCandidateCount: number;
}

const AnimatedValue = ({ value, color, decimals = 0 }: { value: number; color: string; decimals?: number }) => {
  const animated = useAnimatedNumber(value, 600, decimals);
  return (
    <Typography variant="h5" fontWeight={700} color={color}>
      {animated}
    </Typography>
  );
};

const RecruitmentInsights = React.memo(({ funnel, activeCount, avgActiveDays, multiCandidateCount }: Props) => {
  const theme = useTheme();
  const conversionRate = funnel.total > 0 ? (funnel.hired / funnel.total) * 100 : 0;
  const interviewRate = funnel.total > 0 ? (funnel.interviewed / funnel.total) * 100 : 0;

  const kpis = [
    { title: "Total NC", value: funnel.total, color: "primary.main" },
    { title: "En traitement", value: activeCount, color: "info.main" },
    { title: "Résolues", value: funnel.hired, color: "success.main" },
    { title: "Taux de résolution", value: conversionRate, color: "warning.main", suffix: "%", decimals: 1 },
    { title: "Taux d'analyse", value: interviewRate, color: "primary.dark", suffix: "%", decimals: 1 },
    { title: "Durée moy. traitement", value: avgActiveDays, color: "text.secondary", suffix: "j" },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        overflow: "visible",
        transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
        "&:hover": {
          transform: "perspective(1000px) rotateX(-1.5deg) rotateY(1.5deg) translateY(-4px)",
          boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
        },
        ...animations.cardEntrance(0),
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, minHeight: 36 }}>
        <Typography variant="h6" fontWeight={700}>
          Recruitment Insights
        </Typography>
        <Box
          sx={{
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            px: 2,
            py: 0.5,
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" color="primary.main">
            {funnel.total} candidats
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3} sx={{ px: 2, py: 1 }}>
        {kpis.map((kpi, i) => (
          <Grid key={kpi.title} size={{ xs: 6, sm: 4, md: 2 }} sx={{ overflow: "visible" }}>
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
                ...animations.cardEntrance(100 + i * 50),
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {kpi.title}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
                <AnimatedValue value={kpi.value} color={kpi.color} decimals={kpi.decimals} />
                {kpi.suffix && (
                  <Typography variant="body2" color="text.secondary">
                    {kpi.suffix}
                  </Typography>
                )}
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
});
RecruitmentInsights.displayName = "RecruitmentInsights";

export default RecruitmentInsights;
