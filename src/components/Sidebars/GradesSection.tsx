import React, { memo, useCallback, useMemo } from "react";
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
import { getGradeColor } from "../StaffingTab/constants";
import {
  MACRO_GRADES,
  SX_FLEX_ROW,
  SX_FLEX_ROW_FLEX1,
  SX_FLEX1,
  SX_EXPAND_BTN,
  SX_FLEX_COL_GAP05,
  SX_FLEX_COL_GAP15,
  SX_FLEX_GAP025,
  SX_SECTION_HEADER,
} from "./sidebarConstants";

interface GradesSectionProps {
  filters: any;
  setFilters: (fn: (prev: any) => any) => void;
  includedMacroGrades: string[];
  excludedMacroGrades: string[];
  expandedStaffingGroups: Record<string, boolean>;
  setExpandedStaffingGroups: (fn: any) => void;
}

const GradesSection = memo(
  ({
    filters,
    setFilters,
    includedMacroGrades,
    excludedMacroGrades,
    expandedStaffingGroups,
    setExpandedStaffingGroups,
  }: GradesSectionProps) => {
    const theme = useTheme();

    const handleMacroGradeClick = useCallback(
      (key: string) => {
        if (excludedMacroGrades.includes(key)) return;
        const current = normalizeFilterValue(filters.macroGrades);
        if (current.included.includes(key)) {
          setFilters((prev) => ({
            ...prev,
            macroGrades: {
              included: current.included.filter((k: string) => k !== key),
              excluded: current.excluded,
            },
          }));
        } else {
          setFilters((prev) => ({
            ...prev,
            macroGrades: {
              included: [...current.included, key],
              excluded: current.excluded,
            },
          }));
        }
      },
      [excludedMacroGrades, filters.macroGrades, setFilters]
    );

    return (
      <Box sx={{ mt: 3 }}>
        <Box sx={SX_SECTION_HEADER}>
          <Box sx={SX_FLEX_ROW}>
            <Typography variant="h6" fontWeight={600} color={theme.palette.primary.dark}>
              Grades
            </Typography>
            <Box sx={SX_FLEX_GAP025}>
              <IconButton
                size="small"
                onClick={() =>
                  setExpandedStaffingGroups((prev: any) => {
                    const anyExpanded = MACRO_GRADES.some((mg: any) => prev[mg.key]);
                    if (anyExpanded) return {} as any;
                    return prev;
                  })
                }
                sx={{
                  color: theme.palette.primary.main,
                  p: 0.5,
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  },
                }}
                title="Collapse all grades"
                aria-label="Collapse all grades"
              >
                <KeyboardArrowUpIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => {
                  const newExpanded: any = {};
                  MACRO_GRADES.forEach((mg: any) => {
                    newExpanded[mg.key] = true;
                  });
                  setExpandedStaffingGroups(newExpanded);
                }}
                sx={{
                  color: theme.palette.primary.main,
                  p: 0.5,
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  },
                }}
                title="Expand all grades"
                aria-label="Expand all grades"
              >
                <KeyboardArrowDownIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
          {(includedMacroGrades.length > 0 || excludedMacroGrades.length > 0) && (
            <IconButton
              size="small"
              aria-label="Clear grade filters"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  macroGrades: { included: [], excluded: [] },
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
          {MACRO_GRADES.map((mg) => {
            const isGradeIncluded = includedMacroGrades.includes(mg.key);
            const isGradeExcluded = excludedMacroGrades.includes(mg.key);
            const isExpanded = expandedStaffingGroups[mg.key] || false;
            return (
              <Box key={mg.key}>
                <Box
                  draggable={!isGradeExcluded}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("macroGrade", mg.key);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => handleMacroGradeClick(mg.key)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: isGradeExcluded ? "not-allowed" : "grab",
                    backgroundColor: isGradeIncluded
                      ? "#E63946"
                      : isGradeExcluded
                        ? alpha("#999", 0.2)
                        : theme.palette.grey[200],
                    color: isGradeIncluded ? "white" : isGradeExcluded ? "#999" : theme.palette.text.primary,
                    opacity: isGradeExcluded ? 0.5 : 1,
                    border: "2px solid transparent",
                    "&:hover": {
                      backgroundColor: isGradeExcluded
                        ? alpha("#999", 0.2)
                        : isGradeIncluded
                          ? darken("#E63946", 0.1)
                          : theme.palette.grey[300],
                    },
                    "&:active": {
                      cursor: isGradeExcluded ? "not-allowed" : "grabbing",
                    },
                  }}
                >
                  <Box sx={SX_FLEX_ROW_FLEX1}>
                    <Box sx={SX_FLEX1}>{mg.label}</Box>
                  </Box>
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedStaffingGroups((prev: any) => ({
                        ...prev,
                        [mg.key]: !prev[mg.key],
                      }));
                    }}
                    sx={SX_EXPAND_BTN}
                  >
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </Box>
                </Box>
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={SX_FLEX_COL_GAP05}>
                    {mg.grades.map((grade) => {
                      const gradeColor = getGradeColor(grade);
                      const isIndividualIncluded = includedMacroGrades.includes(grade);
                      const isActive = isGradeIncluded || isIndividualIncluded;
                      return (
                        <Box
                          key={grade}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isGradeExcluded) return;
                            const current = normalizeFilterValue(filters.macroGrades);
                            if (current.included.includes(grade)) {
                              setFilters((prev) => ({
                                ...prev,
                                macroGrades: {
                                  included: current.included.filter((k: string) => k !== grade),
                                  excluded: current.excluded,
                                },
                              }));
                            } else {
                              setFilters((prev) => ({
                                ...prev,
                                macroGrades: {
                                  included: [...current.included, grade],
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
                            cursor: isGradeExcluded ? "not-allowed" : "pointer",
                            backgroundColor: isActive
                              ? "#FF6B73"
                              : isGradeExcluded
                                ? alpha("#999", 0.2)
                                : theme.palette.grey[200],
                            color: isActive ? "white" : isGradeExcluded ? "#999" : theme.palette.text.primary,
                            opacity: isGradeExcluded ? 0.4 : 1,
                            transition: "background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease",
                            "&:hover": !isGradeExcluded
                              ? {
                                  backgroundColor: isActive ? darken("#FF6B73", 0.1) : theme.palette.grey[300],
                                }
                              : {},
                          }}
                        >
                          {grade}
                        </Box>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  }
);

GradesSection.displayName = "GradesSection";

export default GradesSection;
