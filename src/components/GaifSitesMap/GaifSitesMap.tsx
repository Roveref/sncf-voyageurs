/**
 * GaifSitesMap — carte de France avec les 18 sites opérationnels GAIF.
 *
 * - Fond : régions administratives françaises (topoJSON).
 * - Markers : 11 sites TN (IDF), 5 TER, 2 IC, colorés par BU et dimensionnés
 *   par typologie (Technicentre / SMR / SMGL).
 * - Interaction : hover = tooltip, click = sélection BU ou site.
 * - Filtre BU : 4 tuiles au-dessus (Tous / TN / TER / IC) qui atténuent les
 *   sites hors périmètre.
 *
 * Remplace l'ancienne RegionMap (carte du monde legacy consulting)
 * qui n'avait pas de sens pour une démo SNCF Voyageurs.
 */

import { memo, useMemo, useState, useCallback } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import TrainRoundedIcon from "@mui/icons-material/TrainRounded";
import DirectionsRailwayRoundedIcon from "@mui/icons-material/DirectionsRailwayRounded";
import AltRouteRoundedIcon from "@mui/icons-material/AltRouteRounded";
import { timing, easing } from "../../styles/animations";
import {
  GAIF_SITES_GEO,
  BU_LABEL,
  BU_COLOR,
  TYPOLOGIE_LABEL,
  TYPOLOGIE_RADIUS,
  type BUKey,
  type GaifSiteGeo,
} from "../../data/gaifSites";

// GeoJSON des régions françaises (source : gregoiredavid/france-geojson, via jsdelivr CDN).
// Format simplifié → poids réduit, rendering rapide.
const FRANCE_REGIONS_URL =
  "https://cdn.jsdelivr.net/gh/gregoiredavid/france-geojson@master/regions-version-simplifiee.geojson";

export type GaifSitesSelection = { kind: "all" } | { kind: "bu"; bu: BUKey } | { kind: "site"; accountId: string };

interface GaifSitesMapProps {
  selection: GaifSitesSelection;
  onSelectionChange: (selection: GaifSitesSelection) => void;
  darkMode?: boolean;
  /** Hauteur du conteneur map. */
  height?: number;
}

const BU_FILTERS: Array<{ key: "all" | BUKey; label: string; color: string; icon: React.ReactElement }> = [
  { key: "all", label: "Tous", color: "#64748B", icon: <PublicRoundedIcon /> },
  { key: "TN", label: "Transilien", color: BU_COLOR.TN, icon: <TrainRoundedIcon /> },
  { key: "TER", label: "TER", color: BU_COLOR.TER, icon: <DirectionsRailwayRoundedIcon /> },
  { key: "IC", label: "Intercités", color: BU_COLOR.IC, icon: <AltRouteRoundedIcon /> },
];

const GaifSitesMap = memo(({ selection, onSelectionChange, darkMode = false, height = 420 }: GaifSitesMapProps) => {
  const [hoveredSite, setHoveredSite] = useState<GaifSiteGeo | null>(null);

  const isInScope = useCallback(
    (site: GaifSiteGeo): boolean => {
      if (selection.kind === "all") return true;
      if (selection.kind === "bu") return site.bu === selection.bu;
      if (selection.kind === "site") return site.accountId === selection.accountId;
      return true;
    },
    [selection]
  );

  const activeBuKey: "all" | BUKey =
    selection.kind === "all"
      ? "all"
      : selection.kind === "bu"
        ? selection.bu
        : (GAIF_SITES_GEO.find((s) => s.accountId === (selection as { accountId: string }).accountId)?.bu ?? "all");

  const summary = useMemo(() => {
    const sitesInScope = GAIF_SITES_GEO.filter(isInScope);
    return {
      total: sitesInScope.length,
      byBU: {
        TN: sitesInScope.filter((s) => s.bu === "TN").length,
        TER: sitesInScope.filter((s) => s.bu === "TER").length,
        IC: sitesInScope.filter((s) => s.bu === "IC").length,
      },
    };
  }, [isInScope]);

  const regionFillDefault = darkMode ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)";
  const regionStrokeDefault = darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)";

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 1.25 }}>
      {/* Filtre BU — tuiles compactes avec icône + label + compteur */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
        {BU_FILTERS.map((f) => {
          const selected = activeBuKey === f.key;
          const accentColor = selected ? f.color : undefined;
          const count = f.key === "all" ? GAIF_SITES_GEO.length : summary.byBU[f.key as BUKey];
          return (
            <Box
              key={f.key}
              onClick={() => onSelectionChange(f.key === "all" ? { kind: "all" } : { kind: "bu", bu: f.key as BUKey })}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.25,
                width: 88,
                height: 64,
                borderRadius: 2,
                cursor: "pointer",
                background: selected
                  ? darkMode
                    ? alpha(f.color, 0.18)
                    : alpha(f.color, 0.1)
                  : darkMode
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.04)",
                transition: `background-color ${timing.normal} ${easing.elegant}, transform ${timing.normal} ${easing.elegant}`,
                "&:hover": {
                  background: selected
                    ? darkMode
                      ? alpha(f.color, 0.24)
                      : alpha(f.color, 0.14)
                    : darkMode
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(0,0,0,0.08)",
                  transform: "translateY(-2px)",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  fontSize: 18,
                  lineHeight: 1,
                  color: selected ? accentColor : darkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                  transition: `color ${timing.normal} ${easing.elegant}`,
                  "& svg": { fontSize: 18 },
                }}
              >
                {f.icon}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: selected ? 700 : 500,
                  color: selected ? accentColor : "text.secondary",
                  fontSize: "0.7rem",
                  lineHeight: 1.1,
                }}
              >
                {f.label}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: "0.58rem",
                  color: selected ? accentColor : "text.secondary",
                  opacity: 0.75,
                  fontWeight: 500,
                  lineHeight: 1,
                }}
              >
                {count} sites
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Carte — sans fond ni bordure, intégrée au background de la landing */}
      <Box
        sx={{
          width: "100%",
          height,
          position: "relative",
        }}
      >
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            center: [2.5, 46.4] as [number, number],
            scale: 1450,
          }}
          width={800}
          height={height}
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={FRANCE_REGIONS_URL}>
            {({ geographies }: { geographies: Array<{ rsmKey: string; properties: Record<string, string> }> }) =>
              geographies.map((geo) => {
                const isIDF = geo.properties?.nom === "Île-de-France";
                const showIDFEmphasis = activeBuKey === "TN" && isIDF;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={showIDFEmphasis ? alpha(BU_COLOR.TN, 0.15) : regionFillDefault}
                    stroke={regionStrokeDefault}
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none", transition: "fill 0.4s ease" },
                      hover: {
                        outline: "none",
                        fill: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {/* Markers pour chaque site */}
          {GAIF_SITES_GEO.map((site) => {
            const inScope = isInScope(site);
            const r = TYPOLOGIE_RADIUS[site.typologie];
            const isSelected = selection.kind === "site" && selection.accountId === site.accountId;
            return (
              <Marker
                key={site.accountId}
                coordinates={[site.coords[1], site.coords[0]]}
                onMouseEnter={() => setHoveredSite(site)}
                onMouseLeave={() => setHoveredSite(null)}
                onClick={() => onSelectionChange({ kind: "site", accountId: site.accountId })}
                style={{ default: { cursor: "pointer" } }}
              >
                {/* halo pour site sélectionné */}
                {isSelected && (
                  <circle
                    r={r + 5}
                    fill="none"
                    stroke={BU_COLOR[site.bu]}
                    strokeWidth={2}
                    strokeOpacity={0.6}
                    style={{ animation: "gaif-pulse 2s ease-in-out infinite" }}
                  />
                )}
                <circle
                  r={r}
                  fill={BU_COLOR[site.bu]}
                  stroke={darkMode ? "#0F172A" : "#FFFFFF"}
                  strokeWidth={1.5}
                  opacity={inScope ? 1 : 0.2}
                  style={{ transition: "opacity 0.3s ease, r 0.2s ease" }}
                />
              </Marker>
            );
          })}
        </ComposableMap>

        {/* Animation pulse pour le site sélectionné */}
        <style>{`
          @keyframes gaif-pulse {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 0.2; transform: scale(1.2); }
          }
        `}</style>

        {/* Tooltip flottant au hover — bulle discrète, pas d'encadré lourd */}
        {hoveredSite && (
          <Box
            sx={{
              position: "absolute",
              bottom: 12,
              right: 12,
              py: 1,
              px: 1.5,
              borderRadius: 2,
              bgcolor: darkMode ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.95)",
              backdropFilter: "blur(6px)",
              borderLeft: `3px solid ${BU_COLOR[hoveredSite.bu]}`,
              boxShadow: darkMode ? "0 6px 20px rgba(0,0,0,0.35)" : "0 6px 20px rgba(15,23,42,0.08)",
              maxWidth: 280,
              pointerEvents: "none",
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontSize: "0.58rem", fontWeight: 700, color: BU_COLOR[hoveredSite.bu], letterSpacing: 0.5 }}
            >
              {BU_LABEL[hoveredSite.bu].toUpperCase()}
            </Typography>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, fontSize: "0.85rem", display: "block", lineHeight: 1.2 }}
            >
              {hoveredSite.fullName}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", display: "block" }}>
              {hoveredSite.city} · {TYPOLOGIE_LABEL[hoveredSite.typologie]}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
});

GaifSitesMap.displayName = "GaifSitesMap";
export default GaifSitesMap;
