import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { normalizeFilterValue, removeValue } from "../../utils/filterHelpers";
import type { Filters, FilterValue } from "../../utils/filterHelpers";

// ── Simple exclusion chip list (accounts, tech partners, people, sub-segments, macro grades) ──

interface SimpleExclusionSectionProps {
  theme: Theme;
  label: string;
  items: string[];
  filterKey: keyof Filters;
  filters: Filters;
  setFilters: (updater: (prev: Filters) => Filters) => void;
  chipColor?: string;
  labelMap?: Record<string, string>;
}

const SimpleExclusionSection = memo(
  ({
    theme,
    label,
    items,
    filterKey,
    filters,
    setFilters,
    chipColor = "#E63946",
    labelMap,
  }: SimpleExclusionSectionProps) => {
    if (items.length === 0) return null;

    return (
      <Box>
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.secondary,
            fontWeight: 600,
            mb: 0.5,
            display: "block",
          }}
        >
          {label}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {items.map((item) => (
            <Chip
              key={`${filterKey}-${item}`}
              label={labelMap ? labelMap[item] || item : item}
              size="small"
              onDelete={() => {
                const newValue = removeValue(filters[filterKey] as FilterValue, item);
                setFilters((prev: Filters) => ({
                  ...prev,
                  [filterKey]: newValue,
                }));
              }}
              sx={{
                backgroundColor: chipColor,
                color: "white",
                fontWeight: 600,
                "& .MuiChip-deleteIcon": {
                  color: alpha("#fff", 0.7),
                  "&:hover": { color: "#fff" },
                },
              }}
            />
          ))}
        </Box>
      </Box>
    );
  }
);

SimpleExclusionSection.displayName = "SimpleExclusionSection";

// ── Offering exclusion chips ──

interface OfferingExclusionSectionProps {
  theme: Theme;
  excludedServiceOfferings: string[];
  filters: Filters;
  setFilters: (updater: (prev: Filters) => Filters) => void;
}

const OfferingExclusionSection = memo(
  ({ theme, excludedServiceOfferings, filters, setFilters }: OfferingExclusionSectionProps) => {
    if (excludedServiceOfferings.length === 0) return null;

    return (
      <Box>
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.secondary,
            fontWeight: 600,
            mb: 0.5,
            display: "block",
          }}
        >
          Service Offerings
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {excludedServiceOfferings.map((offering) => {
            const [, offeringName] = offering.split("::");
            return (
              <Chip
                key={`offering-${offering}`}
                label={offeringName || offering}
                size="small"
                onDelete={() => {
                  const newValue = removeValue(filters.serviceOfferings, offering);
                  setFilters((prev: Filters) => ({
                    ...prev,
                    serviceOfferings: newValue,
                  }));
                }}
                sx={{
                  backgroundColor: "#FF6B73",
                  color: "white",
                  border: "2px solid transparent",
                  "& .MuiChip-deleteIcon": {
                    color: alpha("#fff", 0.7),
                    "&:hover": { color: "#fff" },
                  },
                }}
              />
            );
          })}
        </Box>
      </Box>
    );
  }
);

OfferingExclusionSection.displayName = "OfferingExclusionSection";

// ── Mode-aware chip (used for service lines, segment codes) ──

interface ModeChipProps {
  label: string;
  mode: string | undefined;
  baseColor: string;
  onDelete: () => void;
}

const getModeChipStyles = (mode: string | undefined, baseColor: string) => {
  const isTeam = mode === "team";
  const isBoth = mode === "both";
  return {
    backgroundColor: isTeam ? "transparent" : baseColor,
    color: isTeam ? baseColor : "white",
    fontWeight: 600,
    border: isTeam || isBoth ? `2px solid ${baseColor}` : "2px solid transparent",
    boxShadow: isBoth ? "inset 0 0 0 2px white" : "none",
    "& .MuiChip-deleteIcon": {
      color: isTeam ? alpha(baseColor, 0.7) : alpha("#fff", 0.7),
      "&:hover": { color: isTeam ? baseColor : "#fff" },
    },
  };
};

// ── Grouped-by-mode exclusion section (for units, service lines, segments) ──

interface ExcludedGroup {
  key: string;
  name: string;
  lines: string[];
}

interface ExcludedSegmentGroup {
  key: string;
  name: string;
  codes: string[];
}

interface ModeGroupedExclusionProps {
  theme: Theme;
  filters: Filters;
  setFilters: (updater: (prev: Filters) => Filters) => void;
  // Service line groups
  excludedGroups?: ExcludedGroup[];
  serviceLineModes?: Map<string, string>;
  onServiceLineModesChange?: (updater: (prev: Map<string, string>) => Map<string, string>) => void;
  serviceToOfferingMap?: Record<string, string[]>;
  // Individual service lines
  individualExcludedLines?: string[];
  // Segment groups
  excludedSegmentGroups?: ExcludedSegmentGroup[];
  segmentModes?: Map<string, string>;
  onSegmentModesChange?: (updater: (prev: Map<string, string>) => Map<string, string>) => void;
  segmentToSubSegmentMap?: Record<string, string[]>;
  // Individual segment codes
  individualExcludedSegmentCodes?: string[];
}

const ModeGroupedExclusion = memo(
  ({
    theme,
    filters,
    setFilters,
    excludedGroups = [],
    serviceLineModes = new Map(),
    onServiceLineModesChange,
    serviceToOfferingMap = {},
    individualExcludedLines = [],
    excludedSegmentGroups = [],
    segmentModes = new Map(),
    onSegmentModesChange,
    segmentToSubSegmentMap = {},
    individualExcludedSegmentCodes = [],
  }: ModeGroupedExclusionProps) => {
    // ── Service Line Unit Groups ──
    const unitGroupElements =
      excludedGroups.length > 0
        ? (() => {
            const groupsByMode = {
              opp: [] as typeof excludedGroups,
              team: [] as typeof excludedGroups,
              both: [] as typeof excludedGroups,
            };
            excludedGroups.forEach((group) => {
              const lineModes = new Set(group.lines.map((l) => serviceLineModes.get(l) || "opp"));
              const mode = (lineModes.size === 1 ? [...lineModes][0] : "opp") as string;
              groupsByMode[mode as keyof typeof groupsByMode].push(group);
            });
            const modeLabel = {
              opp: "Units — Opp.",
              team: "Units — Team",
              both: "Units — Team & Opp.",
            };
            return (["opp", "team", "both"] as const)
              .filter((m) => groupsByMode[m].length > 0)
              .map((m) => (
                <Box key={`excl-unit-${m}`}>
                  <Typography
                    variant="caption"
                    sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5, display: "block" }}
                  >
                    {modeLabel[m]}
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {groupsByMode[m].map((group) => (
                      <Chip
                        key={`group-${group.key}`}
                        label={group.name}
                        size="small"
                        onDelete={() => {
                          let newServiceLineValue = normalizeFilterValue(filters.serviceLine1);
                          let newOfferingsValue = normalizeFilterValue(filters.serviceOfferings);
                          group.lines.forEach((line) => {
                            newServiceLineValue = removeValue(newServiceLineValue, line);
                            const offerings = serviceToOfferingMap[line] || [];
                            offerings.forEach((offering) => {
                              newOfferingsValue = removeValue(newOfferingsValue, offering);
                            });
                          });
                          setFilters((prev: Filters) => ({
                            ...prev,
                            serviceLine1: newServiceLineValue,
                            serviceOfferings: newOfferingsValue,
                          }));
                          onServiceLineModesChange?.((prev) => {
                            const next = new Map(prev);
                            group.lines.forEach((line) => next.delete(line));
                            return next;
                          });
                        }}
                        sx={getModeChipStyles(m, "#E63946")}
                      />
                    ))}
                  </Box>
                </Box>
              ));
          })()
        : null;

    // ── Individual Service Lines ──
    const slElements =
      individualExcludedLines.length > 0
        ? (() => {
            const slByMode: Record<string, string[]> = { opp: [], team: [], both: [] };
            individualExcludedLines.forEach((line) => {
              const m = serviceLineModes.get(line) || "opp";
              slByMode[m].push(line);
            });
            const slModeLabel = {
              opp: "Service Lines — Opp.",
              team: "Service Lines — Team",
              both: "Service Lines — Team & Opp.",
            };
            const renderSLChip = (line: string) => {
              const mode = serviceLineModes.get(line);
              return (
                <Chip
                  key={`line-${line}`}
                  label={line}
                  size="small"
                  onDelete={() => {
                    const newServiceLineValue = removeValue(filters.serviceLine1, line);
                    let newOfferingsValue = normalizeFilterValue(filters.serviceOfferings);
                    const offerings = serviceToOfferingMap[line] || [];
                    offerings.forEach((offering) => {
                      newOfferingsValue = removeValue(newOfferingsValue, offering);
                    });
                    setFilters((prev: Filters) => ({
                      ...prev,
                      serviceLine1: newServiceLineValue,
                      serviceOfferings: newOfferingsValue,
                    }));
                    onServiceLineModesChange?.((prev) => {
                      const next = new Map(prev);
                      next.delete(line);
                      return next;
                    });
                  }}
                  sx={getModeChipStyles(mode, "#FF6B73")}
                />
              );
            };
            return (["opp", "team", "both"] as const)
              .filter((m) => slByMode[m].length > 0)
              .map((m) => (
                <Box key={`excl-sl-${m}`}>
                  <Typography
                    variant="caption"
                    sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5, display: "block" }}
                  >
                    {slModeLabel[m]}
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>{slByMode[m].map(renderSLChip)}</Box>
                </Box>
              ));
          })()
        : null;

    // ── Segment Groups ──
    const segGroupElements =
      excludedSegmentGroups.length > 0
        ? (() => {
            const segGroupsByMode = {
              opp: [] as typeof excludedSegmentGroups,
              team: [] as typeof excludedSegmentGroups,
              both: [] as typeof excludedSegmentGroups,
            };
            excludedSegmentGroups.forEach((group) => {
              const codeModes = new Set(group.codes.map((c) => segmentModes.get(c) || "opp"));
              const mode = (codeModes.size === 1 ? [...codeModes][0] : "opp") as string;
              segGroupsByMode[mode as keyof typeof segGroupsByMode].push(group);
            });
            const modeLabel = {
              opp: "Segments — Opp.",
              team: "Segments — Team",
              both: "Segments — Team & Opp.",
            };
            return (["opp", "team", "both"] as const)
              .filter((m) => segGroupsByMode[m].length > 0)
              .map((m) => (
                <Box key={`excl-segGroup-${m}`}>
                  <Typography
                    variant="caption"
                    sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5, display: "block" }}
                  >
                    {modeLabel[m]}
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {segGroupsByMode[m].map((group) => (
                      <Chip
                        key={`segGroup-${group.key}`}
                        label={group.name}
                        size="small"
                        onDelete={() => {
                          let newSegmentCodesValue = normalizeFilterValue(filters.subSegmentCodes);
                          let newSubSegmentsValue = normalizeFilterValue(filters.subSegments);
                          group.codes.forEach((code) => {
                            newSegmentCodesValue = removeValue(newSegmentCodesValue, code);
                            const subSegments = segmentToSubSegmentMap[code] || [];
                            subSegments.forEach((subSegment) => {
                              newSubSegmentsValue = removeValue(newSubSegmentsValue, subSegment);
                            });
                          });
                          setFilters((prev: Filters) => ({
                            ...prev,
                            subSegmentCodes: newSegmentCodesValue,
                            subSegments: newSubSegmentsValue,
                          }));
                          onSegmentModesChange?.((prev) => {
                            const next = new Map(prev);
                            group.codes.forEach((code) => next.delete(code));
                            return next;
                          });
                        }}
                        sx={getModeChipStyles(m, "#E63946")}
                      />
                    ))}
                  </Box>
                </Box>
              ));
          })()
        : null;

    // ── Individual Segment Codes ──
    const segCodeElements =
      individualExcludedSegmentCodes.length > 0
        ? (() => {
            const byMode: Record<string, string[]> = { opp: [], team: [], both: [] };
            individualExcludedSegmentCodes.forEach((code) => {
              const m = segmentModes.get(code) || "opp";
              byMode[m].push(code);
            });
            const modeLabel = {
              opp: "Segments — Opp.",
              team: "Segments — Team",
              both: "Segments — Team & Opp.",
            };
            const renderChip = (code: string) => {
              const mode = segmentModes.get(code);
              return (
                <Chip
                  key={`segmentCode-${code}`}
                  label={code}
                  size="small"
                  onDelete={() => {
                    const newSegmentCodesValue = removeValue(filters.subSegmentCodes, code);
                    let newSubSegmentsValue = normalizeFilterValue(filters.subSegments);
                    const subSegments = segmentToSubSegmentMap[code] || [];
                    subSegments.forEach((subSegment) => {
                      newSubSegmentsValue = removeValue(newSubSegmentsValue, subSegment);
                    });
                    setFilters((prev: Filters) => ({
                      ...prev,
                      subSegmentCodes: newSegmentCodesValue,
                      subSegments: newSubSegmentsValue,
                    }));
                    onSegmentModesChange?.((prev) => {
                      const next = new Map(prev);
                      next.delete(code);
                      return next;
                    });
                  }}
                  sx={getModeChipStyles(mode, "#FF6B73")}
                />
              );
            };
            return (["opp", "team", "both"] as const)
              .filter((m) => byMode[m].length > 0)
              .map((m) => (
                <Box key={`excl-seg-${m}`}>
                  <Typography
                    variant="caption"
                    sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5, display: "block" }}
                  >
                    {modeLabel[m]}
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>{byMode[m].map(renderChip)}</Box>
                </Box>
              ));
          })()
        : null;

    return (
      <>
        {unitGroupElements}
        {slElements}
        {segGroupElements}
        {segCodeElements}
      </>
    );
  }
);

ModeGroupedExclusion.displayName = "ModeGroupedExclusion";

export { SimpleExclusionSection, OfferingExclusionSection, ModeGroupedExclusion };
