/**
 * StakeholdersGraphWidget — cartographie hub-and-spoke des parties prenantes GAIF.
 *
 * Source : Note "Parties prenantes de la gestion d'actifs installations fixes" Transilien.
 */

import { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { alpha, useTheme } from "@mui/material/styles";
import { GAIF_STAKEHOLDERS, STAKEHOLDER_EDGES } from "../../../data/gaifStakeholders";
import { brand } from "../../../config/brandConfig";

const StakeholdersGraphWidget = memo(() => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [selected, setSelected] = useState<string | null>(null);

  // Dispose the stakeholders en cercle autour de GAIF
  const nodes = useMemo(() => {
    const radius = 120;
    const n = GAIF_STAKEHOLDERS.length;
    return GAIF_STAKEHOLDERS.map((s, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      return {
        ...s,
        x: 180 + radius * Math.cos(angle),
        y: 155 + radius * Math.sin(angle),
      };
    });
  }, []);

  const selectedStakeholder = selected ? GAIF_STAKEHOLDERS.find((s) => s.key === selected) : null;

  const relationStyles: Record<string, { color: string; label: string }> = {
    contractuelle: { color: brand.primary, label: "Contractuelle" },
    hierarchique: { color: "#374151", label: "Hiérarchique" },
    cooperation: { color: "#0EA5E9", label: "Coopération" },
  };

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Cartographie des parties prenantes
      </Typography>

      <Box sx={{ flexGrow: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 360 310" style={{ width: "100%", height: "100%", maxHeight: 280 }}>
          {/* Edges */}
          {STAKEHOLDER_EDGES.map((e) => {
            const target = nodes.find((n) => n.key === e.target);
            if (!target) return null;
            const relStyle = relationStyles[e.type];
            const dim = selected && selected !== e.target;
            return (
              <line
                key={e.target}
                x1={180}
                y1={155}
                x2={target.x}
                y2={target.y}
                stroke={relStyle.color}
                strokeWidth={e.strength}
                strokeOpacity={dim ? 0.1 : 0.65}
                strokeDasharray={e.type === "cooperation" ? "5,3" : undefined}
              />
            );
          })}

          {/* Central GAIF hub */}
          <circle cx={180} cy={155} r={32} fill={brand.primary} stroke={brand.primaryDark} strokeWidth={3} />
          <text x={180} y={160} textAnchor="middle" fontSize={14} fontWeight={800} fill="#fff">
            GAIF
          </text>

          {/* Peripheral nodes */}
          {nodes.map((n) => {
            const dim = selected && selected !== n.key;
            return (
              <g
                key={n.key}
                onClick={() => setSelected(selected === n.key ? null : n.key)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={22}
                  fill={n.color}
                  stroke={isDark ? "#1f2937" : "#fff"}
                  strokeWidth={2}
                  opacity={dim ? 0.25 : 1}
                />
                <text
                  x={n.x}
                  y={n.y + 3}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight={700}
                  fill="#fff"
                  opacity={dim ? 0.4 : 1}
                  style={{ pointerEvents: "none" }}
                >
                  {n.label.length > 12 ? n.label.slice(0, 11) + "…" : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </Box>

      {/* Selected stakeholder details */}
      {selectedStakeholder ? (
        <Box
          sx={{
            mt: 1.5,
            p: 1,
            borderRadius: 1.5,
            bgcolor: alpha(selectedStakeholder.color, 0.12),
            border: `1px solid ${alpha(selectedStakeholder.color, 0.3)}`,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.8rem" }}>
            {selectedStakeholder.label}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: "0.68rem", color: "text.secondary" }}>
            {selectedStakeholder.comitologie} · {selectedStakeholder.frequency}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", gap: 1.5, mt: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
          {Object.entries(relationStyles).map(([key, style]) => (
            <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 18, height: 3, bgcolor: style.color, borderRadius: 1 }} />
              <Typography variant="caption" sx={{ fontSize: "0.62rem" }}>
                {style.label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
});

StakeholdersGraphWidget.displayName = "StakeholdersGraphWidget";
export default StakeholdersGraphWidget;
