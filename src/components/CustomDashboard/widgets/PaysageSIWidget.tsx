/**
 * PaysageSIWidget — carte synthétique du paysage SI GAIF.
 *
 * Source : PSGA chapitre 4.6 + Note inventaire chapitres outils.
 * Visualise les outils actifs, en déploiement, à remplacer par patrimoine.
 */

import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import { GAIF_SI_LANDSCAPE, SI_STATUS_COLOR, SI_STATUS_LABEL } from "../../../data/gaifSILandscape";
import { GAIF_PATRIMOINES } from "../../../data/gaifPatrimoines";

const PaysageSIWidget = memo(() => {
  const grouped = useMemo(() => {
    const out: Record<string, typeof GAIF_SI_LANDSCAPE> = {};
    for (const pat of GAIF_PATRIMOINES) out[pat.key] = [];
    out["Transverse"] = [];
    for (const tool of GAIF_SI_LANDSCAPE) {
      if (tool.patrimoines.length > 2) {
        out["Transverse"].push(tool);
        continue;
      }
      const first = tool.patrimoines[0];
      if (out[first]) out[first].push(tool);
    }
    return out;
  }, []);

  const summary = useMemo(() => {
    let actif = 0;
    let deploy = 0;
    let remplacer = 0;
    for (const t of GAIF_SI_LANDSCAPE) {
      if (t.status === "actif") actif++;
      else if (t.status === "en_deploiement") deploy++;
      else if (t.status === "a_remplacer") remplacer++;
    }
    return { actif, deploy, remplacer };
  }, []);

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          Paysage SI — référentiels & GMAO
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", display: "block" }}>
          {summary.actif} actifs · {summary.deploy} en déploiement · {summary.remplacer} à remplacer
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 0.75 }}>
        {Object.entries(grouped)
          .filter(([, tools]) => tools.length > 0)
          .map(([key, tools]) => {
            const patDef = GAIF_PATRIMOINES.find((p) => p.key === key);
            const label = patDef?.label ?? "Transverse";
            const color = patDef?.color ?? "#6B7280";
            return (
              <Box key={key}>
                <Typography variant="caption" sx={{ fontSize: "0.64rem", fontWeight: 700, color, letterSpacing: 0.3 }}>
                  {label.toUpperCase()}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4, mt: 0.25 }}>
                  {tools.map((t) => (
                    <Tooltip
                      key={t.key}
                      arrow
                      placement="top"
                      title={
                        <Box sx={{ p: 0.5, maxWidth: 260 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                            {t.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontSize: "0.7rem", display: "block", opacity: 0.85, mb: 0.5 }}
                          >
                            {t.purpose}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: "0.65rem", display: "block" }}>
                            <b>Type</b> : {t.type} · <b>Opérateur</b> : {t.operateur}
                          </Typography>
                          {t.note && (
                            <Typography
                              variant="caption"
                              sx={{ fontSize: "0.65rem", display: "block", mt: 0.25, fontStyle: "italic" }}
                            >
                              {t.note}
                            </Typography>
                          )}
                        </Box>
                      }
                    >
                      <Chip
                        size="small"
                        label={t.name}
                        sx={{
                          fontSize: "0.62rem",
                          height: 20,
                          bgcolor: alpha(SI_STATUS_COLOR[t.status], 0.15),
                          color: SI_STATUS_COLOR[t.status],
                          fontWeight: 700,
                          borderLeft: `3px solid ${SI_STATUS_COLOR[t.status]}`,
                          borderRadius: 0.5,
                          cursor: "help",
                        }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            );
          })}
      </Box>

      <Box sx={{ display: "flex", gap: 0.75, mt: 1, flexWrap: "wrap", justifyContent: "center" }}>
        {(["actif", "en_deploiement", "a_remplacer"] as const).map((s) => (
          <Box key={s} sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.3, bgcolor: SI_STATUS_COLOR[s] }} />
            <Typography variant="caption" sx={{ fontSize: "0.6rem" }}>
              {SI_STATUS_LABEL[s]}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
});

PaysageSIWidget.displayName = "PaysageSIWidget";
export default PaysageSIWidget;
