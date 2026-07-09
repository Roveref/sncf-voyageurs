import React, { useRef, useState, useLayoutEffect, useCallback } from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { alpha, useTheme } from "@mui/material/styles";
import type { FunnelData } from "../utils/calculations";

export type FunnelStage = "all" | "evaluated" | "interviewed" | "hired"; // GAIF: all=Total NC, evaluated=Analysée, interviewed=Plan action, hired=Résolue

interface Props {
  funnel: FunnelData;
  activeStage: FunnelStage;
  onStageClick: (stage: FunnelStage) => void;
}

interface StageConfig {
  key: FunnelStage;
  label: string;
  value: number;
  color: string;
  gradient: [string, string];
}

const FunnelChart = React.memo(({ funnel, activeStage, onStageClick }: Props) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const stages: StageConfig[] = [
    {
      key: "all",
      label: "Total NC",
      value: funnel.total,
      color: theme.palette.primary.main,
      gradient: [theme.palette.primary.main, theme.palette.primary.dark],
    },
    {
      key: "evaluated",
      label: "Analysées",
      value: funnel.evaluated,
      color: theme.palette.info.main,
      gradient: [theme.palette.info.light, theme.palette.info.main],
    },
    {
      key: "interviewed",
      label: "Plan d'action",
      value: funnel.interviewed,
      color: theme.palette.warning.main,
      gradient: ["#FFB74D", theme.palette.warning.main],
    },
    {
      key: "hired",
      label: "Résolues",
      value: funnel.hired,
      color: theme.palette.success.main,
      gradient: [theme.palette.success.light, theme.palette.success.main],
    },
  ];

  const [hovered, setHovered] = useState<number | null>(null);

  const h = 200;
  const n = stages.length;
  const arrowW = 28;
  const padY = 24;
  const usableH = h - padY * 2;
  const totalArrowW = arrowW * (n - 1);
  const stageW = (width - totalArrowW) / n;
  const maxVal = Math.max(funnel.total, 1);

  // Height proportional to value with minimum
  const getH = (val: number) => Math.max(usableH * 0.15, usableH * (val / maxVal));

  const handleClick = useCallback(
    (stage: FunnelStage) => {
      onStageClick(activeStage === stage ? "all" : stage);
    },
    [activeStage, onStageClick]
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 12px 48px rgba(0, 0, 0, 0.15)",
        },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Funnel de résolution NC
        </Typography>
        {activeStage !== "all" && (
          <Chip
            label={`Filtre: ${stages.find((s) => s.key === activeStage)?.label}`}
            size="small"
            color="primary"
            onDelete={() => onStageClick("all")}
          />
        )}
      </Box>

      <Box ref={containerRef} sx={{ width: "100%", userSelect: "none" }}>
        <svg width={width} height={h} style={{ display: "block", overflow: "visible" }}>
          <defs>
            {stages.map((s, i) => (
              <linearGradient key={`grad-${i}`} id={`funnel-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.gradient[0]} />
                <stop offset="100%" stopColor={s.gradient[1]} />
              </linearGradient>
            ))}
            <filter id="funnel-shadow">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.15" />
            </filter>
          </defs>

          {stages.map((stage, i) => {
            const x = i * (stageW + arrowW);
            const curH = getH(stage.value);
            const nextH = i < n - 1 ? getH(stages[i + 1].value) : curH;

            const cy = h / 2;
            // Left: current height, right: transition toward next
            const leftH = curH;
            const rightH = (curH + nextH) / 2;
            if (i === n - 1) {
              // Last stage: both sides same
            }
            const rH = i === n - 1 ? curH * 0.7 : rightH;

            const tl = cy - leftH / 2;
            const bl = cy + leftH / 2;
            const tr = cy - rH / 2;
            const br = cy + rH / 2;
            const r = 8;

            const isActive = activeStage === stage.key || activeStage === "all";
            const isHov = hovered === i;
            const opacity = isActive ? (isHov ? 1 : 0.92) : 0.35;

            return (
              <g key={i}>
                {/* Trapezoid shape */}
                <path
                  d={`
                    M ${x + r} ${tl}
                    L ${x + stageW - r} ${tr}
                    Q ${x + stageW} ${tr} ${x + stageW} ${Math.min(tr + r, cy)}
                    L ${x + stageW} ${Math.max(br - r, cy)}
                    Q ${x + stageW} ${br} ${x + stageW - r} ${br}
                    L ${x + r} ${bl}
                    Q ${x} ${bl} ${x} ${Math.max(bl - r, cy)}
                    L ${x} ${Math.min(tl + r, cy)}
                    Q ${x} ${tl} ${x + r} ${tl}
                    Z
                  `}
                  fill={`url(#funnel-grad-${i})`}
                  opacity={opacity}
                  filter="url(#funnel-shadow)"
                  style={{
                    cursor: "pointer",
                    transition: "opacity 0.25s ease",
                  }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleClick(stage.key)}
                />

                {/* Value */}
                <text
                  x={x + stageW / 2}
                  y={cy - 6}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fill="#fff"
                  fontWeight={700}
                  fontSize={Math.min(26, stageW * 0.14)}
                  style={{
                    pointerEvents: "none",
                    textShadow: "0 1px 4px rgba(0,0,0,0.35)",
                  }}
                >
                  {stage.value.toLocaleString()}
                </text>

                {/* Percentage */}
                <text
                  x={x + stageW / 2}
                  y={cy + 14}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fill={alpha("#fff", 0.9)}
                  fontWeight={500}
                  fontSize={Math.min(14, stageW * 0.085)}
                  style={{ pointerEvents: "none" }}
                >
                  {funnel.total > 0 ? (i === 0 ? "100%" : `${((stage.value / funnel.total) * 100).toFixed(1)}%`) : "0%"}
                </text>

                {/* Label below shape */}
                <text
                  x={x + stageW / 2}
                  y={h - 2}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fill={isActive ? theme.palette.text.primary : theme.palette.text.disabled}
                  fontSize={Math.min(13, stageW * 0.078)}
                  fontWeight={activeStage === stage.key ? 700 : 500}
                  style={{ pointerEvents: "none", transition: "fill 0.2s, font-weight 0.2s" }}
                >
                  {stage.label}
                </text>

                {/* Connector arrow to next stage */}
                {i < n - 1 &&
                  (() => {
                    const ax = x + stageW + arrowW / 2;
                    const convRate = stage.value > 0 ? ((stages[i + 1].value / stage.value) * 100).toFixed(0) : "0";
                    return (
                      <g>
                        {/* Arrow chevron */}
                        <path
                          d={`M ${ax - 6} ${cy - 8} L ${ax + 4} ${cy} L ${ax - 6} ${cy + 8}`}
                          fill="none"
                          stroke={theme.palette.text.disabled}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={0.5}
                        />
                        {/* Conversion rate */}
                        <text
                          x={ax}
                          y={cy + 24}
                          textAnchor="middle"
                          dominantBaseline="auto"
                          fill={theme.palette.text.secondary}
                          fontSize={10}
                          fontWeight={500}
                        >
                          {convRate}%
                        </text>
                      </g>
                    );
                  })()}
              </g>
            );
          })}
        </svg>
      </Box>
    </Paper>
  );
});
FunnelChart.displayName = "FunnelChart";

export default FunnelChart;
