/**
 * CatalogueServicesWidget — catalogue de services GAIF en 4 volets.
 *
 * Source : slides 9 et 10 Présentation A2P.
 * Bascule entre vue synthétique (indicateurs) et vue détaillée (liste services).
 */

import { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { alpha, useTheme } from "@mui/material/styles";
import { GAIF_CATALOGUE_SERVICES, totalDemandes, demandesParMode } from "../../../data/gaifCatalogueServices";

const CatalogueServicesWidget = memo(() => {
  const theme = useTheme();
  const [viewMode, setViewMode] = useState<"synthese" | "detail">("synthese");
  const totals = useMemo(() => ({ total: totalDemandes(), parMode: demandesParMode() }), []);

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2, gap: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Catalogue de services
          </Typography>
          <Typography variant="body2" color="text.secondary">
            4 volets · {totals.total} demandes ouvertes · {totals.parMode.FIXE} FIXE / {totals.parMode.FREE} FREE
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          size="small"
          onChange={(_, v) => v && setViewMode(v)}
          sx={{
            bgcolor: "action.hover",
            borderRadius: 2,
            p: 0.25,
            "& .MuiToggleButton-root": {
              fontSize: "0.72rem",
              fontWeight: 600,
              textTransform: "none",
              border: "none",
              borderRadius: 1.5,
              color: "text.secondary",
              py: 0.5,
              px: 1.25,
              "&.Mui-selected": {
                bgcolor: "background.paper",
                color: "text.primary",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                "&:hover": { bgcolor: "background.paper" },
              },
            },
          }}
        >
          <ToggleButton value="synthese">Synthèse</ToggleButton>
          <ToggleButton value="detail">Détail</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Divider sx={{ mb: 2 }} />

      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        {viewMode === "synthese" ? (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 1, mt: 1 }}>
            {GAIF_CATALOGUE_SERVICES.map((volet) => {
              const nbServices = volet.services.length;
              const nbDemandes = volet.services.reduce((acc, s) => acc + s.demandesOuvertes, 0);
              return (
                <Tooltip
                  key={volet.key}
                  arrow
                  placement="top"
                  title={
                    <Box sx={{ p: 0.5, maxWidth: 280 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                        {volet.label}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: "0.7rem", opacity: 0.85 }}>
                        {volet.context}
                      </Typography>
                    </Box>
                  }
                >
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.text.primary, 0.04),
                      cursor: "help",
                      transition: "background-color 0.2s ease",
                      "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.08) },
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}
                    >
                      {volet.shortLabel}
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{ fontWeight: 700, color: theme.palette.primary.main, lineHeight: 1, mt: 0.5 }}
                    >
                      {nbServices}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: "0.7rem", display: "block", mt: 0.5 }}
                    >
                      services catalogués
                    </Typography>
                    <Box sx={{ mt: 0.75 }}>
                      <Chip
                        size="small"
                        label={`${nbDemandes} demandes`}
                        sx={{
                          fontSize: "0.65rem",
                          height: 20,
                          bgcolor: alpha(theme.palette.primary.main, 0.12),
                          color: theme.palette.primary.main,
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {GAIF_CATALOGUE_SERVICES.map((volet) => (
              <Box key={volet.key}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}
                >
                  {volet.shortLabel}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5, mb: 1 }}>
                  {volet.services.map((svc) => (
                    <Tooltip
                      key={svc.key}
                      arrow
                      placement="right"
                      title={
                        <Box sx={{ p: 0.5, maxWidth: 260 }}>
                          <Typography variant="caption" sx={{ fontSize: "0.7rem" }}>
                            {svc.description}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontSize: "0.65rem", display: "block", mt: 0.5, opacity: 0.8 }}
                          >
                            Bénéficiaires : {svc.beneficiaires.join(", ")}
                          </Typography>
                        </Box>
                      }
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 0.75,
                          borderRadius: 1.5,
                          bgcolor: alpha(theme.palette.text.primary, 0.04),
                          cursor: "help",
                          "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.08) },
                        }}
                      >
                        <Chip
                          size="small"
                          label={svc.tarif}
                          sx={{
                            fontSize: "0.62rem",
                            height: 18,
                            minWidth: 40,
                            fontWeight: 700,
                            bgcolor:
                              svc.tarif === "FIXE"
                                ? alpha(theme.palette.primary.main, 0.15)
                                : alpha(theme.palette.info.main, 0.15),
                            color: svc.tarif === "FIXE" ? theme.palette.primary.main : theme.palette.info.main,
                          }}
                        />
                        <Typography variant="caption" sx={{ fontSize: "0.75rem", flexGrow: 1 }}>
                          {svc.label}
                        </Typography>
                        {svc.demandesOuvertes > 0 && (
                          <Chip
                            size="small"
                            label={svc.demandesOuvertes}
                            sx={{
                              fontSize: "0.62rem",
                              height: 18,
                              minWidth: 22,
                              bgcolor: alpha(theme.palette.warning.main, 0.15),
                              color: theme.palette.warning.main,
                              fontWeight: 700,
                            }}
                          />
                        )}
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
});

CatalogueServicesWidget.displayName = "CatalogueServicesWidget";
export default CatalogueServicesWidget;
