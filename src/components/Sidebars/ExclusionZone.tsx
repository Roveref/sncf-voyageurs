import React, { memo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import ClearIcon from "@mui/icons-material/Clear";
import { alpha } from "@mui/material/styles";
import { normalizeFilterValue, removeValue } from "../../utils/filterHelpers";
import type { Filters } from "../../utils/filterHelpers";
import { brand } from "../../config/brandConfig";
import type { Theme } from "@mui/material/styles";
import { useExclusionDrop } from "./useExclusionDrop";
import { SimpleExclusionSection, OfferingExclusionSection, ModeGroupedExclusion } from "./ExclusionChipSection";

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

interface ExclusionZoneProps {
  theme: Theme;
  filters: Filters;
  setFilters: (updater: (prev: Filters) => Filters) => void;
  serviceToOfferingMap: Record<string, string[]>;
  segmentToSubSegmentMap: Record<string, string[]>;
  serviceLineModes: Map<string, string>;
  onServiceLineModesChange: (updater: (prev: Map<string, string>) => Map<string, string>) => void;
  segmentModes: Map<string, string>;
  onSegmentModesChange: (updater: (prev: Map<string, string>) => Map<string, string>) => void;
  activeFilterCount: number;
  onFilterModalOpen: () => void;
  // Excluded items (pre-computed)
  excludedServiceLines: string[];
  excludedServiceOfferings: string[];
  excludedAccounts: string[];
  excludedTechnologyPartners: string[];
  excludedPeople: string[];
  excludedSegmentCodesAll: string[];
  excludedSubSegments: string[];
  excludedMacroGrades: string[];
  excludedMacroCategories: string[];
  excludedGroups: ExcludedGroup[];
  individualExcludedLines: string[];
  excludedSegmentGroups: ExcludedSegmentGroup[];
  individualExcludedSegmentCodes: string[];
}

const MACRO_CATEGORY_LABELS: Record<string, string> = {
  chargeable: "Billable",
  nonChargeable: "Non-Billable",
  absence: "Absence",
};

const ExclusionZone = memo(
  ({
    theme,
    filters,
    setFilters,
    serviceToOfferingMap,
    segmentToSubSegmentMap,
    serviceLineModes,
    onServiceLineModesChange,
    segmentModes,
    onSegmentModesChange,
    activeFilterCount,
    onFilterModalOpen,
    excludedServiceLines,
    excludedServiceOfferings,
    excludedAccounts,
    excludedTechnologyPartners,
    excludedPeople,
    excludedSegmentCodesAll,
    excludedSubSegments,
    excludedMacroGrades,
    excludedMacroCategories,
    excludedGroups,
    individualExcludedLines,
    excludedSegmentGroups,
    individualExcludedSegmentCodes,
  }: ExclusionZoneProps) => {
    const [dragOverExcludeZone, setDragOverExcludeZone] = useState(false);

    const handleDrop = useExclusionDrop({
      filters,
      setFilters,
      serviceToOfferingMap,
      segmentToSubSegmentMap,
    });

    const onDrop = useCallback(
      (e: React.DragEvent) => {
        setDragOverExcludeZone(false);
        handleDrop(e);
      },
      [handleDrop]
    );

    const hasAnyExclusion =
      excludedGroups.length > 0 ||
      individualExcludedLines.length > 0 ||
      excludedServiceOfferings.length > 0 ||
      excludedAccounts.length > 0 ||
      excludedTechnologyPartners.length > 0 ||
      excludedPeople.length > 0 ||
      excludedSegmentGroups.length > 0 ||
      individualExcludedSegmentCodes.length > 0 ||
      excludedSubSegments.length > 0 ||
      excludedMacroGrades.length > 0 ||
      excludedMacroCategories.length > 0;

    const handleClearAll = useCallback(() => {
      const normalizedServiceLine = normalizeFilterValue(filters.serviceLine1);
      const normalizedOfferings = normalizeFilterValue(filters.serviceOfferings);
      const normalizedAccounts = normalizeFilterValue(filters.accounts);
      const normalizedTechPartners = normalizeFilterValue(filters.technologyPartners);
      const normalizedPeople = normalizeFilterValue(filters.people);
      const normalizedSegmentCodes = normalizeFilterValue(filters.subSegmentCodes);
      const normalizedSubSegments = normalizeFilterValue(filters.subSegments);

      setFilters((prev: Filters) => ({
        ...prev,
        serviceLine1: { included: normalizedServiceLine.included, excluded: [] },
        serviceOfferings: { included: normalizedOfferings.included, excluded: [] },
        accounts: { included: normalizedAccounts.included, excluded: [] },
        technologyPartners: { included: normalizedTechPartners.included, excluded: [] },
        people: { included: normalizedPeople.included, excluded: [] },
        subSegmentCodes: { included: normalizedSegmentCodes.included, excluded: [] },
        subSegments: { included: normalizedSubSegments.included, excluded: [] },
        macroGrades: { included: normalizeFilterValue(prev.macroGrades).included, excluded: [] },
        macroCategories: { included: normalizeFilterValue(prev.macroCategories).included, excluded: [] },
      }));
      onServiceLineModesChange?.((prev: Map<string, string>) => {
        const next = new Map(prev);
        excludedServiceLines.forEach((l: string) => next.delete(l));
        return next;
      });
      onSegmentModesChange?.((prev: Map<string, string>) => {
        const next = new Map(prev);
        excludedSegmentCodesAll.forEach((c: string) => next.delete(c));
        return next;
      });
    }, [
      filters,
      setFilters,
      onServiceLineModesChange,
      onSegmentModesChange,
      excludedServiceLines,
      excludedSegmentCodesAll,
    ]);

    return (
      <>
        {activeFilterCount > 0 && (
          <Box sx={{ display: "flex", justifyContent: "flex-start", mt: 2, mb: -1 }}>
            <Chip
              label={`${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}`}
              size="small"
              onClick={onFilterModalOpen}
              sx={{
                backgroundColor: "rgba(255,61,71,0.85)",
                color: "white",
                fontWeight: 600,
                fontSize: "0.65rem",
                height: 22,
                cursor: "pointer",
                "&:hover": { backgroundColor: "rgba(255,61,71,1)" },
              }}
            />
          </Box>
        )}
        <Box
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverExcludeZone(true);
          }}
          onDragLeave={() => {
            setDragOverExcludeZone(false);
          }}
          onDrop={onDrop}
          sx={{
            flexShrink: 0,
            mt: 3,
            p: 2,
            minHeight: 120,
            maxHeight: "35vh",
            overflowY: "auto",
            borderRadius: 2,
            border: dragOverExcludeZone ? `2px solid ${brand.primary}` : "none",
            backgroundColor: dragOverExcludeZone ? alpha(brand.primary, 0.12) : alpha(brand.primaryDeepest, 0.06),
            backdropFilter: "blur(8px)",
            transition:
              "background-color 0.25s ease-in-out, border-color 0.25s ease-in-out, box-shadow 0.25s ease-in-out, transform 0.25s ease-in-out",
            boxShadow: dragOverExcludeZone ? `inset 0 0 12px ${alpha(brand.primary, 0.2)}` : "none",
            transform: dragOverExcludeZone ? "scale(1.02)" : "scale(1)",
            "&::-webkit-scrollbar": { display: "none" },
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
              Exclusion zone
            </Typography>
            {hasAnyExclusion && (
              <IconButton
                size="small"
                onClick={handleClearAll}
                sx={{
                  color: theme.palette.text.disabled,
                  "&:hover": {
                    color: brand.primary,
                    backgroundColor: alpha(brand.primary, 0.1),
                  },
                }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          {!hasAnyExclusion ? (
            <Box sx={{ textAlign: "center", py: 1, position: "relative", minHeight: 20 }}>
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.text.disabled,
                  fontStyle: "italic",
                  display: "block",
                  position: "absolute",
                  inset: 0,
                  opacity: dragOverExcludeZone ? 0 : 1,
                  transition: "opacity 0.15s ease",
                }}
              >
                Drag an item here to exclude
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.text.disabled,
                  fontStyle: "italic",
                  display: "block",
                  position: "absolute",
                  inset: 0,
                  opacity: dragOverExcludeZone ? 1 : 0,
                  transition: "opacity 0.15s ease",
                }}
              >
                {"↓ Drop here to exclude"}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <ModeGroupedExclusion
                theme={theme}
                filters={filters}
                setFilters={setFilters}
                excludedGroups={excludedGroups}
                serviceLineModes={serviceLineModes}
                onServiceLineModesChange={onServiceLineModesChange}
                serviceToOfferingMap={serviceToOfferingMap}
                individualExcludedLines={individualExcludedLines}
                excludedSegmentGroups={excludedSegmentGroups}
                segmentModes={segmentModes}
                onSegmentModesChange={onSegmentModesChange}
                segmentToSubSegmentMap={segmentToSubSegmentMap}
                individualExcludedSegmentCodes={individualExcludedSegmentCodes}
              />

              <OfferingExclusionSection
                theme={theme}
                excludedServiceOfferings={excludedServiceOfferings}
                filters={filters}
                setFilters={setFilters}
              />

              <SimpleExclusionSection
                theme={theme}
                label="Sites"
                items={excludedAccounts}
                filterKey="accounts"
                filters={filters}
                setFilters={setFilters}
              />

              <SimpleExclusionSection
                theme={theme}
                label="Prestataires"
                items={excludedTechnologyPartners}
                filterKey="technologyPartners"
                filters={filters}
                setFilters={setFilters}
              />

              <SimpleExclusionSection
                theme={theme}
                label="Personnes"
                items={excludedPeople}
                filterKey="people"
                filters={filters}
                setFilters={setFilters}
              />

              <SimpleExclusionSection
                theme={theme}
                label="Familles d'actifs"
                items={excludedSubSegments}
                filterKey="subSegments"
                filters={filters}
                setFilters={setFilters}
                chipColor="#FF6B73"
              />

              <SimpleExclusionSection
                theme={theme}
                label="Niveaux"
                items={excludedMacroGrades}
                filterKey="macroGrades"
                filters={filters}
                setFilters={setFilters}
              />

              <SimpleExclusionSection
                theme={theme}
                label="Catégories"
                items={excludedMacroCategories}
                filterKey="macroCategories"
                filters={filters}
                setFilters={setFilters}
                labelMap={MACRO_CATEGORY_LABELS}
              />
            </Box>
          )}
        </Box>
      </>
    );
  }
);

ExclusionZone.displayName = "ExclusionZone";

export default ExclusionZone;
