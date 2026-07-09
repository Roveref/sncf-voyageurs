import React, { memo, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { crmCountriesToTopoNames, isGeoHighlighted, crmNameToTopoName } from "./countryNameToIso";
import { timing, easing } from "../../styles/animations";
import { regionColors, brand } from "../../config/brandConfig";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

/** Parse "rgb(r,g,b)" or "#RRGGBB" to [r,g,b] */
function parseColor(c: string): [number, number, number] | null {
  const rgb = c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  const hex = c.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
  return null;
}

export interface RegionData {
  name: string;
  countries: string[];
}

interface RegionMapProps {
  regions: RegionData[];
  selectedRegion: string | null;
  selectedCountry: string | null;
  onRegionSelect: (region: string | null) => void;
  onCountrySelect: (country: string | null) => void;
  darkMode?: boolean;
}

// GAIF color palette for regions (from brandConfig)
const REGION_COLORS: Record<string, { main: string; light: string; dark: string }> = { ...regionColors };

const FALLBACK_COLORS = [
  { main: "#26A69A", light: "#4DB6AC", dark: "#00897B" },
  { main: "#42A5F5", light: "#64B5F6", dark: "#1E88E5" },
  { main: "#EC407A", light: "#F06292", dark: "#D81B60" },
  { main: "#8D6E63", light: "#A1887F", dark: "#6D4C41" },
  { main: "#78909C", light: "#90A4AE", dark: "#546E7A" },
];

function getRegionColor(regionName: string, index: number) {
  return REGION_COLORS[regionName] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

const RegionMap = memo(
  ({ regions, selectedRegion, selectedCountry, onRegionSelect, onCountrySelect, darkMode }: RegionMapProps) => {
    const [geoLoaded, setGeoLoaded] = useState(false);
    const [hoveredCountry, setHoveredCountry] = useState("");
    const mapRef = useRef<HTMLDivElement>(null);

    // Animate fill color frame-by-frame with rAF
    const rafRef = useRef(0);
    const prevFillsRef = useRef<Map<SVGPathElement, string>>(new Map());

    // Populate initial fills once the map is loaded
    useEffect(() => {
      if (!geoLoaded || !mapRef.current) return;
      const paths = mapRef.current.querySelectorAll<SVGPathElement>("path");
      paths.forEach((p) => {
        if (!prevFillsRef.current.has(p)) {
          prevFillsRef.current.set(p, p.style.fill);
        }
      });
    }, [geoLoaded]);

    // Track what triggers the animation (region or country change)
    const animTrigger = `${selectedRegion}|${selectedCountry}`;
    useEffect(() => {
      const el = mapRef.current;
      if (!el) return;
      const hasPrev = prevFillsRef.current.size > 0;

      cancelAnimationFrame(rafRef.current);
      const paths = el.querySelectorAll<SVGPathElement>("path");

      const animated: {
        path: SVGPathElement;
        fromRgb: [number, number, number];
        toRgb: [number, number, number];
        targetOpacity: string;
      }[] = [];
      paths.forEach((p) => {
        const newFill = p.style.fill;
        const prevFill = prevFillsRef.current.get(p) || newFill;
        p.style.stroke = "none";
        p.style.strokeWidth = "0";
        p.style.transition = "none";

        if (hasPrev && prevFill !== newFill) {
          const fromRgb = parseColor(prevFill);
          const toRgb = parseColor(newFill);
          if (fromRgb && toRgb) {
            p.style.fill = `rgb(${fromRgb[0]},${fromRgb[1]},${fromRgb[2]})`;
            animated.push({ path: p, fromRgb, toRgb, targetOpacity: p.style.opacity });
          }
        }
        prevFillsRef.current.set(p, newFill);
      });

      if (animated.length === 0) return;

      const selecting = !!(selectedRegion || selectedCountry);
      let start = 0;
      const duration = selecting ? 400 : 200;
      const animate = (ts: number) => {
        if (!start) start = ts;
        const t = Math.min((ts - start) / duration, 1);

        for (const { path: p, fromRgb, toRgb, targetOpacity } of animated) {
          const r = Math.round(fromRgb[0] + (toRgb[0] - fromRgb[0]) * t);
          const g = Math.round(fromRgb[1] + (toRgb[1] - fromRgb[1]) * t);
          const b = Math.round(fromRgb[2] + (toRgb[2] - fromRgb[2]) * t);
          p.style.fill = `rgb(${r},${g},${b})`;
          p.style.opacity = targetOpacity;
          p.style.stroke = "none";
          p.style.strokeWidth = "0";
        }

        if (t < 1) rafRef.current = requestAnimationFrame(animate);
      };

      rafRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(rafRef.current);
    }, [animTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

    // Build a map: topoName → regionName for all regions
    const countryToRegion = useMemo(() => {
      const map = new Map<string, string>();
      for (const region of regions) {
        const topoNames = crmCountriesToTopoNames(region.countries);
        for (const name of topoNames) {
          map.set(name, region.name);
        }
      }
      return map;
    }, [regions]);

    // Reverse map: topoName → CRM country name (for passing back to parent)
    const topoToCrmName = useMemo(() => {
      const map = new Map<string, string>();
      for (const region of regions) {
        for (const crmName of region.countries) {
          const topo = crmNameToTopoName(crmName);
          if (topo) map.set(topo, crmName);
        }
      }
      return map;
    }, [regions]);

    // Selected region's color
    const selectedColor = useMemo(() => {
      if (!selectedRegion) return null;
      const idx = regions.findIndex((r) => r.name === selectedRegion);
      return getRegionColor(selectedRegion, idx);
    }, [selectedRegion, regions]);

    // Click on map = select individual country
    const handleGeoClick = useCallback(
      (geoName: string) => {
        const crmName = topoToCrmName.get(geoName);
        if (!crmName) return;
        // Toggle: click same country = deselect
        onCountrySelect(selectedCountry === crmName ? null : crmName);
      },
      [topoToCrmName, selectedCountry, onCountrySelect]
    );

    // Build set of topo names for the selected region
    const selectedTopoNames = useMemo(() => {
      if (!selectedRegion) return new Set<string>();
      const region = regions.find((r) => r.name === selectedRegion);
      if (!region) return new Set<string>();
      return crmCountriesToTopoNames(region.countries);
    }, [selectedRegion, regions]);

    // Topo name for the selected country
    const selectedCountryTopo = useMemo(() => {
      if (!selectedCountry) return null;
      return crmNameToTopoName(selectedCountry);
    }, [selectedCountry]);

    const getGeoStyle = useCallback(
      (geoName: string) => {
        const neutral = {
          fill: darkMode ? "#2a2420" : "#e8e0dc",
          stroke: "none" as const,
          strokeWidth: 0,
          cursor: "default" as const,
          opacity: 0.5,
        };

        const belongsToRegion = countryToRegion.has(geoName);

        // Individual country selected — highlight only that country
        if (selectedCountryTopo) {
          if (geoName === selectedCountryTopo) {
            const regionName = countryToRegion.get(geoName);
            const idx = regionName ? regions.findIndex((r) => r.name === regionName) : 0;
            const color = regionName ? getRegionColor(regionName, idx) : { main: brand.primary };
            return {
              fill: color.main,
              stroke: "none" as const,
              strokeWidth: 0,
              cursor: "pointer" as const,
              opacity: 1,
            };
          }
          return { ...neutral, cursor: (belongsToRegion ? "pointer" : "default") as "pointer" | "default" };
        }

        // Region selected — highlight countries in that region
        if (selectedRegion) {
          if (selectedTopoNames.has(geoName)) {
            return {
              fill: selectedColor?.main || brand.primary,
              stroke: "none" as const,
              strokeWidth: 0,
              cursor: "pointer" as const,
              opacity: 1,
            };
          }
          return { ...neutral, cursor: (belongsToRegion ? "pointer" : "default") as "pointer" | "default" };
        }

        // Nothing selected — all neutral
        return { ...neutral, cursor: (belongsToRegion ? "pointer" : "default") as "pointer" | "default" };
      },
      [countryToRegion, selectedRegion, selectedTopoNames, selectedColor, selectedCountryTopo, regions, darkMode]
    );

    return (
      <Box sx={{ position: "relative", width: "100%", maxWidth: 800, mx: "auto" }}>
        {/* Region buttons */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, justifyContent: "center", mb: 6 }}>
          {[...regions]
            .sort((a, b) => {
              const order = ["NRT", "WST", "CER", "CSH"];
              const ia = order.indexOf(a.name);
              const ib = order.indexOf(b.name);
              return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
            })
            .map((region) => {
              const idx = regions.findIndex((r) => r.name === region.name);
              const color = getRegionColor(region.name, idx);
              const isSelected = selectedRegion === region.name;
              return (
                <Box
                  key={region.name}
                  onClick={() => {
                    onCountrySelect(null); // Clear country when picking a region
                    onRegionSelect(isSelected ? null : region.name);
                  }}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 2.5,
                    py: 1.5,
                    borderRadius: 2,
                    cursor: "pointer",
                    minWidth: 90,
                    justifyContent: "center",
                    background: isSelected
                      ? `${color.main}${darkMode ? "30" : "1A"}`
                      : darkMode
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.04)",
                    transition: `background-color ${timing.normal} ${easing.elegant}, color ${timing.normal} ${easing.elegant}, transform ${timing.normal} ${easing.elegant}, box-shadow ${timing.normal} ${easing.elegant}`,
                    "&:hover": {
                      background: isSelected
                        ? `${color.main}${darkMode ? "40" : "28"}`
                        : darkMode
                          ? "rgba(255,255,255,0.10)"
                          : "rgba(0,0,0,0.08)",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: color.main,
                      flexShrink: 0,
                      transition: `transform ${timing.normal} ${easing.elegant}`,
                      ...(isSelected && { transform: "scale(1.4)" }),
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? color.main : "text.secondary",
                      transition: `color ${timing.normal} ${easing.elegant}`,
                      fontSize: "0.8rem",
                    }}
                  >
                    {region.name}
                  </Typography>
                </Box>
              );
            })}
        </Box>

        {/* Hovered country label */}
        <Typography
          variant="body2"
          sx={{
            textAlign: "center",
            height: 24,
            fontWeight: 400,
            color: "text.secondary",
            fontSize: "0.85rem",
            mb: 0.5,
          }}
        >
          {hoveredCountry || "\u00A0"}
        </Typography>

        {/* Map container — fixed size, no zoom */}
        <Box ref={mapRef} sx={{ position: "relative", overflow: "hidden" }}>
          {!geoLoaded && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2,
              }}
            >
              <CircularProgress size={32} sx={{ color: brand.primary }} />
            </Box>
          )}

          <ComposableMap
            projectionConfig={{
              rotate: [-10, 0, 0],
              scale: 140,
            }}
            width={800}
            height={420}
            style={{ width: "100%", height: "auto" }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: any[] }) => {
                if (!geoLoaded && geographies.length > 0) {
                  setTimeout(() => setGeoLoaded(true), 0);
                }
                return geographies
                  .filter((geo) => geo.properties.name !== "Antarctica")
                  .map((geo) => {
                    const geoName = geo.properties.name || "";
                    const style = getGeoStyle(geoName);

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={() => handleGeoClick(geoName)}
                        onMouseEnter={() => setHoveredCountry(geoName)}
                        onMouseLeave={() => setHoveredCountry("")}
                        style={{
                          default: {
                            fill: style.fill,
                            stroke: "none",
                            strokeWidth: 0,
                            opacity: style.opacity,
                            outline: "none",
                            cursor: style.cursor,
                          },
                          hover: {
                            fill: style.cursor === "pointer" ? selectedColor?.main || style.fill : style.fill,
                            stroke: "none",
                            strokeWidth: 0,
                            opacity: style.cursor === "pointer" ? 1 : style.opacity,
                            outline: "none",
                            cursor: style.cursor,
                          },
                          pressed: {
                            fill: style.fill,
                            stroke: "none",
                            strokeWidth: 0,
                            opacity: style.opacity,
                            outline: "none",
                            cursor: style.cursor,
                          },
                        }}
                      />
                    );
                  });
              }}
            </Geographies>
          </ComposableMap>
        </Box>
      </Box>
    );
  }
);

RegionMap.displayName = "RegionMap";
export default RegionMap;
