import React, { memo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ClearIcon from "@mui/icons-material/Clear";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { alpha, darken, useTheme } from "@mui/material/styles";
import { normalizeFilterValue } from "../../utils/filterHelpers";
import { CATEGORY_TREE, CATEGORY_LABELS } from "../StaffingTab/constants";
import { CATEGORY_THEME } from "../StaffingTab/constants/theme";
import {
  MACRO_CATEGORIES,
  SX_FLEX_ROW,
  SX_FLEX_ROW_FLEX1,
  SX_FLEX1,
  SX_EXPAND_BTN,
  SX_FLEX_COL_GAP05,
  SX_FLEX_COL_GAP15,
  SX_FLEX_GAP025,
  SX_SECTION_HEADER,
} from "./sidebarConstants";

interface CategoriesSectionProps {
  filters: any;
  setFilters: (fn: (prev: any) => any) => void;
  includedMacroCategories: string[];
  excludedMacroCategories: string[];
  expandedCatGroups: Record<string, boolean>;
  setExpandedCatGroups: (fn: any) => void;
}

const CategoriesSection = memo(
  ({
    filters,
    setFilters,
    includedMacroCategories,
    excludedMacroCategories,
    expandedCatGroups,
    setExpandedCatGroups,
  }: CategoriesSectionProps) => {
    const theme = useTheme();

    const handleMacroCategoryClick = useCallback(
      (key: string) => {
        if (excludedMacroCategories.includes(key)) return;
        const current = normalizeFilterValue(filters.macroCategories);
        if (current.included.includes(key)) {
          setFilters((prev) => ({
            ...prev,
            macroCategories: {
              included: current.included.filter((k: string) => k !== key),
              excluded: current.excluded,
            },
          }));
        } else {
          setFilters((prev) => ({
            ...prev,
            macroCategories: {
              included: [...current.included, key],
              excluded: current.excluded,
            },
          }));
        }
      },
      [excludedMacroCategories, filters.macroCategories, setFilters]
    );

    return (
      <Box sx={{ mt: 3 }}>
        <Box sx={SX_SECTION_HEADER}>
          <Box sx={SX_FLEX_ROW}>
            <Typography variant="h6" fontWeight={600} color={theme.palette.primary.dark}>
              CatÃ©gories
            </Typography>
            <Box sx={SX_FLEX_GAP025}>
              <IconButton
                size="small"
                onClick={() => setExpandedCatGroups({})}
                sx={{
                  color: theme.palette.primary.main,
                  p: 0.5,
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  },
                }}
                title="Collapse all categories"
                aria-label="Collapse all categories"
              >
                <KeyboardArrowUpIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => {
                  const newExpanded: Record<string, boolean> = {};
                  MACRO_CATEGORIES.forEach((mc) => {
                    newExpanded[mc.key] = true;
                  });
                  setExpandedCatGroups(newExpanded);
                }}
                sx={{
                  color: theme.palette.primary.main,
                  p: 0.5,
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  },
                }}
                title="Expand all categories"
                aria-label="Expand all categories"
              >
                <KeyboardArrowDownIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
          {(includedMacroCategories.length > 0 || excludedMacroCategories.length > 0) && (
            <IconButton
              size="small"
              aria-label="Clear category filters"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  macroCategories: { included: [], excluded: [] },
                }))
              }
              sx={{ color: theme.palette.primary.main, p: 0.5 }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
        <Divider sx={{ mb: 1.5, borderColor: theme.palette.primary.light }} />
        <Box sx={SX_FLEX_COL_GAP15}>
          {MACRO_CATEGORIES.map((mc) => {
            const isCatIncluded = includedMacroCategories.includes(mc.key);
            const isCatExcluded = excludedMacroCategories.includes(mc.key);
            const isExpanded = expandedCatGroups[mc.key] || false;
            const treeEntry = CATEGORY_TREE.find((t: any) => t.main === mc.key);
            const subs = treeEntry ? treeEntry.subs : [];
            return (
              <Box key={mc.key}>
                <Box
                  draggable={!isCatExcluded}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("macroCategory", mc.key);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => handleMacroCategoryClick(mc.key)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: isCatExcluded ? "not-allowed" : "grab",
                    backgroundColor: isCatIncluded
                      ? "#E63946"
                      : isCatExcluded
                        ? alpha("#999", 0.2)
                        : theme.palette.grey[200],
                    color: isCatIncluded ? "white" : isCatExcluded ? "#999" : theme.palette.text.primary,
                    opacity: isCatExcluded ? 0.5 : 1,
                    border: "2px solid transparent",
                    "&:hover": {
                      backgroundColor: isCatExcluded
                        ? alpha("#999", 0.2)
                        : isCatIncluded
                          ? darken("#E63946", 0.1)
                          : theme.palette.grey[300],
                    },
                    "&:active": {
                      cursor: isCatExcluded ? "not-allowed" : "grabbing",
                    },
                  }}
                >
                  <Box sx={SX_FLEX_ROW_FLEX1}>
                    <Box sx={SX_FLEX1}>{mc.label}</Box>
                  </Box>
                  {subs.length > 0 && (
                    <Box
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCatGroups((prev: any) => ({
                          ...prev,
                          [mc.key]: !prev[mc.key],
                        }));
                      }}
                      sx={SX_EXPAND_BTN}
                    >
                      {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </Box>
                  )}
                </Box>
                {subs.length > 0 && (
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={SX_FLEX_COL_GAP05}>
                      {subs.map((sub: string) => {
                        const catTheme = CATEGORY_THEME[sub] || CATEGORY_THEME.unknown;
                        const isIndividualIncluded = includedMacroCategories.includes(sub);
                        const isActive = isCatIncluded || isIndividualIncluded;
                        return (
                          <Box
                            key={sub}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isCatExcluded) return;
                              const current = normalizeFilterValue(filters.macroCategories);
                              if (current.included.includes(sub)) {
                                setFilters((prev) => ({
                                  ...prev,
                                  macroCategories: {
                                    included: current.included.filter((k: string) => k !== sub),
                                    excluded: current.excluded,
                                  },
                                }));
                              } else {
                                setFilters((prev) => ({
                                  ...prev,
                                  macroCategories: {
                                    included: [...current.included, sub],
                                    excluded: current.excluded,
                                  },
                                }));
                              }
                            }}
                            sx={{
                              borderRadius: 1.5,
                              px: 1.5,
                              py: 0.5,
                              fontSize: "0.75rem",
                              fontWeight: isActive ? 600 : 500,
                              cursor: isCatExcluded ? "not-allowed" : "pointer",
                              backgroundColor: isActive
                                ? "#FF6B73"
                                : isCatExcluded
                                  ? alpha("#999", 0.2)
                                  : theme.palette.grey[200],
                              color: isActive ? "white" : isCatExcluded ? "#999" : theme.palette.text.primary,
                              opacity: isCatExcluded ? 0.4 : 1,
                              transition: "background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease",
                              "&:hover": !isCatExcluded
                                ? {
                                    backgroundColor: isActive ? darken("#FF6B73", 0.1) : theme.palette.grey[300],
                                  }
                                : {},
                            }}
                          >
                            {CATEGORY_LABELS[sub] || sub}
                          </Box>
                        );
                      })}
                    </Box>
                  </Collapse>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  }
);

CategoriesSection.displayName = "CategoriesSection";

export default CategoriesSection;
