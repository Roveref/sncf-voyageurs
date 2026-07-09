/**
 * DoctrinaireDocsWidget — liste du référentiel documentaire GAIF.
 *
 * Source : Inputs/ PSGA, Politique, Prescriptions, Notes, Présentation A2P.
 * Tri par catégorie + statut (Publié / Validation / WIP).
 */

import { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { alpha } from "@mui/material/styles";
import {
  GAIF_DOCTRINAIRE_DOCS as STATIC_DOCS,
  STATUS_COLOR_DOC,
  type DoctrinaireDoc,
} from "../../../data/gaifDoctrinaireDocs";
import { useGaifData } from "../../../queries/useGaifData";

type CategoryFilter = "Tous" | DoctrinaireDoc["category"];

const CATEGORY_FILTERS: CategoryFilter[] = ["Tous", "Stratégie", "Politique", "Prescription", "Note", "Présentation"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

const DoctrinaireDocsWidget = memo(() => {
  const [filter, setFilter] = useState<CategoryFilter>("Tous");
  const { doctrinaireDocs: dbDocs } = useGaifData();

  const allDocs = useMemo<DoctrinaireDoc[]>(() => {
    if (dbDocs.length === 0) return STATIC_DOCS;
    return dbDocs.map((d) => ({
      key: d.id,
      title: d.title,
      category: d.category as DoctrinaireDoc["category"],
      version: d.version ?? "",
      lastUpdate: d.lastUpdate ?? "",
      owner: d.owner ?? "",
      status: d.status as DoctrinaireDoc["status"],
      summary: d.summary ?? "",
    }));
  }, [dbDocs]);

  const docs = useMemo(
    () =>
      (filter === "Tous" ? allDocs : allDocs.filter((d) => d.category === filter)).sort((a, b) =>
        a.status === b.status ? 0 : a.status === "Publié" ? -1 : 1
      ),
    [allDocs, filter]
  );

  const counts = useMemo(() => {
    const out = { Publié: 0, Validation: 0, "Work in progress": 0 } as Record<DoctrinaireDoc["status"], number>;
    for (const d of allDocs) out[d.status]++;
    return out;
  }, [allDocs]);

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, gap: 1, flexWrap: "wrap" }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Référentiel doctrinaire
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", display: "block" }}>
            {allDocs.length} documents · {counts["Publié"]} publiés · {counts["Validation"]} en validation ·{" "}
            {counts["Work in progress"]} WIP
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={filter}
          exclusive
          size="small"
          onChange={(_, v) => v && setFilter(v as CategoryFilter)}
          sx={{ "& .MuiToggleButton-root": { fontSize: "0.6rem", py: 0.2, px: 0.6 } }}
        >
          {CATEGORY_FILTERS.map((c) => (
            <ToggleButton key={c} value={c}>
              {c}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
        {docs.map((doc) => (
          <Tooltip
            key={doc.key}
            arrow
            placement="right"
            title={
              <Box sx={{ p: 0.5, maxWidth: 280 }}>
                <Typography variant="caption" sx={{ fontSize: "0.7rem" }}>
                  {doc.summary}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: "0.62rem", display: "block", mt: 0.5, opacity: 0.8 }}>
                  Propriétaire : {doc.owner}
                </Typography>
              </Box>
            }
          >
            <Box
              sx={{
                p: 0.8,
                borderRadius: 1,
                bgcolor: alpha(STATUS_COLOR_DOC[doc.status], 0.08),
                borderLeft: `3px solid ${STATUS_COLOR_DOC[doc.status]}`,
                display: "flex",
                alignItems: "center",
                gap: 1,
                cursor: "help",
              }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {doc.title}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "text.secondary" }}>
                  {doc.category} · {doc.version} · MAJ {formatDate(doc.lastUpdate)}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={doc.status}
                sx={{
                  fontSize: "0.56rem",
                  height: 17,
                  bgcolor: alpha(STATUS_COLOR_DOC[doc.status], 0.18),
                  color: STATUS_COLOR_DOC[doc.status],
                  fontWeight: 700,
                }}
              />
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
});

DoctrinaireDocsWidget.displayName = "DoctrinaireDocsWidget";
export default DoctrinaireDocsWidget;
