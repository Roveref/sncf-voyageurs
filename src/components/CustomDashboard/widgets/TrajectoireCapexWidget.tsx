/**
 * TrajectoireCapexWidget — trajectoire CAPEX pluriannuelle par patrimoine.
 *
 * Source : projets GAIF 2025-2030 (gaifProjects.ts). Représente les investissements
 * annuels répartis par patrimoine, en lien avec le PPI 2026-2030 et les
 * trajectoires d'investissement immobilier (décret BACS, Tertiaire, CEPIA).
 */

import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { GAIF_PROJECTS_LITE, distributeBudgetByYear } from "../../../data/gaifProjects";
import { GAIF_PATRIMOINES } from "../../../data/gaifPatrimoines";
import { useGaifData } from "../../../queries/useGaifData";

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

const TrajectoireCapexWidget = memo(() => {
  const { projects: dbProjects } = useGaifData();

  const data = useMemo(() => {
    const rows: Record<string, number>[] = YEARS.map((y) => {
      const row: Record<string, number> = { year: y };
      for (const p of GAIF_PATRIMOINES) row[p.key] = 0;
      row["Transverse"] = 0;
      return row;
    });

    // Utilise projects SQLite si dispo, sinon fallback sur la constante statique.
    if (dbProjects.length > 0) {
      for (const proj of dbProjects) {
        const patKey = proj.patrimoine === "Transverse" || !proj.patrimoine ? "Transverse" : proj.patrimoine;
        const budgetByYear = proj.budgetByYear ?? {};
        // Si pas de répartition annuelle, distribue linéairement sur les années couvertes
        const entries =
          Object.keys(budgetByYear).length > 0
            ? budgetByYear
            : (() => {
                const out: Record<string, number> = {};
                if (proj.startDate && proj.endDate && proj.budget) {
                  const start = new Date(proj.startDate).getFullYear();
                  const end = new Date(proj.endDate).getFullYear();
                  const n = Math.max(1, end - start + 1);
                  for (let y = start; y <= end; y++) out[String(y)] = proj.budget / n;
                }
                return out;
              })();
        for (const [y, amount] of Object.entries(entries)) {
          const year = Number(y);
          const idx = YEARS.indexOf(year);
          if (idx === -1) continue;
          const r = rows[idx];
          r[patKey] = (r[patKey] ?? 0) + amount / 1000;
        }
      }
    } else {
      for (const proj of GAIF_PROJECTS_LITE) {
        const perYear = distributeBudgetByYear(proj);
        for (const [y, amount] of Object.entries(perYear)) {
          const year = Number(y);
          const idx = YEARS.indexOf(year);
          if (idx === -1) continue;
          const key = proj.patrimoine === "Transverse" ? "Transverse" : proj.patrimoine;
          const r = rows[idx];
          r[key] = (r[key] ?? 0) + amount / 1000;
        }
      }
    }

    return rows.map((r) => {
      const out: Record<string, string | number> = { year: r.year };
      for (const k of Object.keys(r)) if (k !== "year") out[k] = Math.round(r[k] as number);
      return out;
    });
  }, [dbProjects]);

  const total = data.reduce((acc, r) => {
    let sum = 0;
    for (const k of Object.keys(r)) if (k !== "year") sum += Number(r[k]);
    return acc + sum;
  }, 0);

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          Trajectoire CAPEX 2025-2030
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", display: "block" }}>
          Total enveloppe {total.toLocaleString("fr-FR")} k€ · répartition par patrimoine · PPI 2026-2030
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => `${Number(v).toLocaleString("fr-FR")} k€`} />
            <Legend wrapperStyle={{ fontSize: "0.65rem" }} />
            {GAIF_PATRIMOINES.map((p) => (
              <Area
                key={p.key}
                type="monotone"
                dataKey={p.key}
                name={p.label.split(" ")[0]}
                stackId="a"
                stroke={p.color}
                fill={p.color}
                fillOpacity={0.55}
              />
            ))}
            <Area
              type="monotone"
              dataKey="Transverse"
              name="Transverse"
              stackId="a"
              stroke="#6B7280"
              fill="#6B7280"
              fillOpacity={0.35}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
});

TrajectoireCapexWidget.displayName = "TrajectoireCapexWidget";
export default TrajectoireCapexWidget;
