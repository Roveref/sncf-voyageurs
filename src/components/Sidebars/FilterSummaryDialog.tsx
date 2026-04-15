import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import ClearIcon from "@mui/icons-material/Clear";
import { alpha } from "@mui/material/styles";
import { normalizeFilterValue, removeValue } from "../../utils/filterHelpers";
import type { Filters, FilterValue } from "../../utils/filterHelpers";
import { brand } from "../../config/brandConfig";
import type { Theme } from "@mui/material/styles";

interface FilterSummaryDialogProps {
  theme: Theme;
  open: boolean;
  onClose: () => void;
  filters: Filters;
  setFilters: (updater: (prev: Filters) => Filters) => void;
  segmentModes: Map<string, string>;
  onSegmentModesChange: (updater: (prev: Map<string, string>) => Map<string, string>) => void;
  serviceLineModes: Map<string, string>;
  onServiceLineModesChange: (updater: (prev: Map<string, string>) => Map<string, string>) => void;
  onClearAllFilters: () => void;
  segmentToSubSegmentMap: Record<string, string[]>;
  serviceToOfferingMap: Record<string, string[]>;
}

const FilterSummaryDialog = memo(
  ({
    theme,
    open,
    onClose,
    filters,
    setFilters,
    segmentModes,
    onSegmentModesChange,
    serviceLineModes,
    onServiceLineModesChange,
    onClearAllFilters,
    segmentToSubSegmentMap,
    serviceToOfferingMap,
  }: FilterSummaryDialogProps) => {
    return (
      <Dialog open={open} onClose={onClose} TransitionComponent={DialogTransition} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pb: 1,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Active filters
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <ClearIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {(() => {
            const sections: React.ReactElement[] = [];

            // Helper: build a section
            const addSection = (
              title: string,
              included: string[],
              excluded: string[],
              onRemove: (v: string) => void
            ) => {
              if (included.length === 0 && excluded.length === 0) return;
              sections.push(
                <Box key={title} sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: theme.palette.text.secondary,
                      display: "block",
                      mb: 0.5,
                    }}
                  >
                    {title}
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {included.map((v: string) => (
                      <Chip
                        key={`inc-${v}`}
                        label={v}
                        size="small"
                        onDelete={() => onRemove(v)}
                        sx={{
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                          color: theme.palette.primary.main,
                          fontWeight: 500,
                          fontSize: "0.75rem",
                        }}
                      />
                    ))}
                    {excluded.map((v: string) => (
                      <Chip
                        key={`exc-${v}`}
                        label={`\u2715 ${v}`}
                        size="small"
                        onDelete={() => onRemove(v)}
                        sx={{
                          backgroundColor: alpha(brand.primary, 0.1),
                          color: brand.primary,
                          fontWeight: 500,
                          fontSize: "0.75rem",
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              );
            };

            const segCodes = normalizeFilterValue(filters.subSegmentCodes);
            const subSegs = normalizeFilterValue(filters.subSegments);
            const sLines = normalizeFilterValue(filters.serviceLine1);
            const sOff = normalizeFilterValue(filters.serviceOfferings);
            const accts = normalizeFilterValue(filters.accounts);
            const techP = normalizeFilterValue(filters.technologyPartners);
            const ppl = normalizeFilterValue(filters.people);
            const mGrades = normalizeFilterValue(filters.macroGrades);
            const mCats = normalizeFilterValue(filters.macroCategories);

            // Segment Codes -- split by mode (Opp / Team / Both)
            const segRemove = (v: string) => {
              setFilters((prev: Filters) => {
                let updatedSubSegments = prev.subSegments;
                const childSubSegs = segmentToSubSegmentMap?.[v] || [];
                if (childSubSegs.length > 0) {
                  const remainingCodes = normalizeFilterValue(prev.subSegmentCodes)
                    .included.concat(normalizeFilterValue(prev.subSegmentCodes).excluded)
                    .filter((c: string) => c !== v);
                  const coveredByOtherCodes = new Set<string>();
                  remainingCodes.forEach((code: string) => {
                    (segmentToSubSegmentMap?.[code] || []).forEach((s: string) => coveredByOtherCodes.add(s));
                  });
                  childSubSegs.forEach((sub: string) => {
                    if (!coveredByOtherCodes.has(sub)) {
                      updatedSubSegments = removeValue(updatedSubSegments, sub);
                    }
                  });
                }
                return {
                  ...prev,
                  subSegmentCodes: removeValue(prev.subSegmentCodes, v),
                  subSegments: updatedSubSegments,
                };
              });
              onSegmentModesChange?.((prev: Map<string, string>) => {
                const next = new Map(prev);
                next.delete(v);
                return next;
              });
            };
            const allSegCodes = [...segCodes.included, ...segCodes.excluded];
            if (allSegCodes.length > 0) {
              const byMode: Record<string, { inc: string[]; exc: string[] }> = {
                opp: { inc: [], exc: [] },
                team: { inc: [], exc: [] },
                both: { inc: [], exc: [] },
              };
              segCodes.included.forEach((c: string) => {
                const m = segmentModes.get(c) || "opp";
                byMode[m].inc.push(c);
              });
              segCodes.excluded.forEach((c: string) => {
                const m = segmentModes.get(c) || "opp";
                byMode[m].exc.push(c);
              });
              const modeLabels = {
                opp: "Segments — Opp.",
                team: "Segments — Team",
                both: "Segments — Team & Opp.",
              };
              (["opp", "team", "both"] as const).forEach((m) => {
                addSection(modeLabels[m], byMode[m].inc, byMode[m].exc, segRemove);
              });
            }
            addSection("Sub-Segments", subSegs.included, subSegs.excluded, (v: string) => {
              setFilters((prev: Filters) => {
                const updatedSubSegments = removeValue(prev.subSegments, v);
                const remainingSubs = new Set([
                  ...normalizeFilterValue(updatedSubSegments).included,
                  ...normalizeFilterValue(updatedSubSegments).excluded,
                ]);
                let updatedSegmentCodes = prev.subSegmentCodes;
                Object.keys(segmentToSubSegmentMap || {}).forEach((code: string) => {
                  const children = segmentToSubSegmentMap[code] || [];
                  if (children.includes(v)) {
                    const hasOtherChild = children.some((c: string) => c !== v && remainingSubs.has(c));
                    if (!hasOtherChild) {
                      updatedSegmentCodes = removeValue(updatedSegmentCodes, code);
                    }
                  }
                });
                return {
                  ...prev,
                  subSegments: updatedSubSegments,
                  subSegmentCodes: updatedSegmentCodes,
                };
              });
            });
            // Service Lines -- split by mode (Opp / Team / Both)
            const slRemove = (v: string) => {
              setFilters((prev: Filters) => {
                let updatedOfferings = prev.serviceOfferings;
                const childOfferings = serviceToOfferingMap?.[v] || [];
                if (childOfferings.length > 0) {
                  const remainingLines = normalizeFilterValue(prev.serviceLine1)
                    .included.concat(normalizeFilterValue(prev.serviceLine1).excluded)
                    .filter((l: string) => l !== v);
                  const coveredByOtherLines = new Set<string>();
                  remainingLines.forEach((line: string) => {
                    (serviceToOfferingMap?.[line] || []).forEach((o: string) => coveredByOtherLines.add(o));
                  });
                  childOfferings.forEach((off: string) => {
                    if (!coveredByOtherLines.has(off)) {
                      updatedOfferings = removeValue(updatedOfferings, off);
                    }
                  });
                }
                return {
                  ...prev,
                  serviceLine1: removeValue(prev.serviceLine1, v),
                  serviceOfferings: updatedOfferings,
                };
              });
              onServiceLineModesChange?.((prev: Map<string, string>) => {
                const next = new Map(prev);
                next.delete(v);
                return next;
              });
            };
            const allSLs = [...sLines.included, ...sLines.excluded];
            if (allSLs.length > 0) {
              const slByMode: Record<string, { inc: string[]; exc: string[] }> = {
                opp: { inc: [], exc: [] },
                team: { inc: [], exc: [] },
                both: { inc: [], exc: [] },
              };
              sLines.included.forEach((l: string) => {
                const m = serviceLineModes.get(l) || "opp";
                slByMode[m].inc.push(l);
              });
              sLines.excluded.forEach((l: string) => {
                const m = serviceLineModes.get(l) || "opp";
                slByMode[m].exc.push(l);
              });
              const slModeLabels = {
                opp: "Service Lines — Opp.",
                team: "Service Lines — Team",
                both: "Service Lines — Team & Opp.",
              };
              (["opp", "team", "both"] as const).forEach((m) => {
                addSection(slModeLabels[m], slByMode[m].inc, slByMode[m].exc, slRemove);
              });
            } else {
              addSection("Service Lines", sLines.included, sLines.excluded, slRemove);
            }
            addSection("Service Offerings", sOff.included, sOff.excluded, (v: string) => {
              setFilters((prev: Filters) => {
                const updatedOfferings = removeValue(prev.serviceOfferings, v);
                const remainingOffs = new Set([
                  ...normalizeFilterValue(updatedOfferings).included,
                  ...normalizeFilterValue(updatedOfferings).excluded,
                ]);
                let updatedServiceLines = prev.serviceLine1;
                Object.keys(serviceToOfferingMap || {}).forEach((line: string) => {
                  const children = serviceToOfferingMap[line] || [];
                  if (children.includes(v)) {
                    const hasOtherChild = children.some((c: string) => c !== v && remainingOffs.has(c));
                    if (!hasOtherChild) {
                      updatedServiceLines = removeValue(updatedServiceLines, line);
                    }
                  }
                });
                return {
                  ...prev,
                  serviceOfferings: updatedOfferings,
                  serviceLine1: updatedServiceLines,
                };
              });
            });
            addSection("Accounts", accts.included, accts.excluded, (v: string) => {
              setFilters((prev: Filters) => ({
                ...prev,
                accounts: removeValue(prev.accounts, v),
              }));
            });
            addSection("Technology Partners", techP.included, techP.excluded, (v: string) => {
              setFilters((prev: Filters) => ({
                ...prev,
                technologyPartners: removeValue(prev.technologyPartners, v),
              }));
            });
            addSection("People", ppl.included, ppl.excluded, (v: string) => {
              setFilters((prev: Filters) => ({
                ...prev,
                people: removeValue(prev.people, v),
              }));
            });
            addSection("Macro Grades", mGrades.included, mGrades.excluded, (v: string) => {
              setFilters((prev: Filters) => ({
                ...prev,
                macroGrades: removeValue(prev.macroGrades, v),
              }));
            });
            addSection("Macro Categories", mCats.included, mCats.excluded, (v: string) => {
              setFilters((prev: Filters) => ({
                ...prev,
                macroCategories: removeValue(prev.macroCategories, v),
              }));
            });

            return sections.length > 0 ? (
              sections
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.disabled,
                  textAlign: "center",
                  py: 2,
                }}
              >
                No active filter
              </Typography>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              onClearAllFilters?.();
              onClose();
            }}
            color="error"
            variant="outlined"
            size="small"
          >
            Clear all
          </Button>
          <Button onClick={onClose} variant="contained" size="small">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
);

FilterSummaryDialog.displayName = "FilterSummaryDialog";

export default FilterSummaryDialog;
