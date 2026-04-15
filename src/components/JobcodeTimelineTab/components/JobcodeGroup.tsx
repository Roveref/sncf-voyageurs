/**
 * JobcodeGroup — visual parity with staffing's GroupedEmployeeList
 * (GroupedEmployeeList.tsx:138-451), with two labeled sub-sections per
 * jobcode:
 *   1. Opportunités — the opportunity rows
 *   2. SAP — the SAP employee rows (only when there is data)
 *
 * Each sub-section has its own mini-header (chevron + label + count)
 * and its own indent wrapper with the per-jobcode color.
 */
import { memo, useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { JobcodeGroupHeader } from "./JobcodeGroupHeader";
import { JobcodeGanttRow } from "./JobcodeGanttRow";
import { JobcodeSapEmployeeRow } from "./JobcodeSapEmployeeRow";
import { useSapForJobcode } from "../hooks/useSapForJobcode";
import { getJobcodeGroupColors } from "../utils/groupColors";
import type { Jobcode } from "../hooks/useJobcodeData";

// Indent geometry, matches staffing's DM_INDENT_PX (GroupedEmployeeList.tsx:29-32)
const DM_ML = 12;
const DM_BORDER = 1;
const DM_PL = 11;
const DM_INDENT_PX = DM_ML + DM_BORDER + DM_PL; // 24

interface SubSectionHeaderProps {
  label: string;
  count: number;
  collapsed: boolean;
  color: string;
  onToggle: () => void;
}

const SubSectionHeader = memo(({ label, count, collapsed, color, onToggle }: SubSectionHeaderProps) => (
  <Box
    onClick={onToggle}
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 0.5,
      ml: `${DM_ML}px`,
      pl: `${DM_PL}px`,
      borderLeft: `${DM_BORDER}px solid`,
      borderColor: color,
      py: 0.25,
      cursor: "pointer",
      userSelect: "none",
      "&:hover": { opacity: 0.8 },
    }}
  >
    {collapsed ? (
      <ChevronRightIcon sx={{ fontSize: 12, color: "text.disabled" }} />
    ) : (
      <ExpandMoreIcon sx={{ fontSize: 12, color: "text.disabled" }} />
    )}
    <Typography
      component="span"
      sx={{
        fontSize: "0.65rem",
        fontWeight: 700,
        color: "text.disabled",
        textTransform: "uppercase",
        letterSpacing: 0.6,
      }}
    >
      {label}
    </Typography>
    <Typography
      component="span"
      sx={{
        fontSize: "0.65rem",
        fontWeight: 600,
        color: "text.disabled",
      }}
    >
      ({count})
    </Typography>
  </Box>
));
SubSectionHeader.displayName = "JobcodeSubSectionHeader";

interface JobcodeGroupProps {
  jobcode: Jobcode;
  opportunities: Record<string, unknown>[];
  timelineStart: Date | string;
  timelineEnd: Date | string;
  leftColumnWidth: number;
  rowHeight: number;
  onOpportunityClick?: (opp: Record<string, unknown>) => void;
}

const JobcodeGroup = memo(
  ({
    jobcode,
    opportunities,
    timelineStart,
    timelineEnd,
    leftColumnWidth,
    rowHeight,
    onOpportunityClick,
  }: JobcodeGroupProps) => {
    const [groupCollapsed, setGroupCollapsed] = useState(false);
    const [oppsCollapsed, setOppsCollapsed] = useState(false);
    const [sapCollapsed, setSapCollapsed] = useState(false);

    // Eagerly fetch SAP data for this jobcode — the SAP sub-section is now
    // permanent (not gated behind a toggle).
    const sapEmployees = useSapForJobcode(jobcode.jobcode);
    const colors = getJobcodeGroupColors(jobcode.jobcode);

    const toggleGroupCollapsed = useCallback(() => setGroupCollapsed((c) => !c), []);
    const toggleOppsCollapsed = useCallback(() => setOppsCollapsed((c) => !c), []);
    const toggleSapCollapsed = useCallback(() => setSapCollapsed((c) => !c), []);

    const indentSx = {
      ml: `${DM_ML}px`,
      pl: `${DM_PL}px`,
      borderLeft: `${DM_BORDER}px solid`,
      borderColor: colors.border,
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    } as const;

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <JobcodeGroupHeader
          jobcode={jobcode}
          opportunities={opportunities}
          timelineStart={timelineStart}
          timelineEnd={timelineEnd}
          leftColumnWidth={leftColumnWidth}
          collapsed={groupCollapsed}
          onToggleCollapsed={toggleGroupCollapsed}
        />

        <Collapse in={!groupCollapsed} timeout="auto" unmountOnExit>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {/* Section 1 — Opportunités */}
            <SubSectionHeader
              label="Opportunités"
              count={opportunities.length}
              collapsed={oppsCollapsed}
              color={colors.border}
              onToggle={toggleOppsCollapsed}
            />
            <Collapse in={!oppsCollapsed} timeout="auto" unmountOnExit>
              <Box sx={indentSx}>
                {opportunities.map((opp, i) => (
                  <JobcodeGanttRow
                    key={(opp as { opportunityId?: string }).opportunityId || i}
                    opportunity={opp}
                    timelineStart={timelineStart}
                    timelineEnd={timelineEnd}
                    leftColumnWidth={leftColumnWidth}
                    rowHeight={rowHeight}
                    leftColShrink={DM_INDENT_PX}
                    onOpportunityClick={onOpportunityClick}
                  />
                ))}
              </Box>
            </Collapse>

            {/* Section 2 — SAP (only when there is SAP data for this jobcode) */}
            {sapEmployees.length > 0 && (
              <>
                <SubSectionHeader
                  label="SAP"
                  count={sapEmployees.length}
                  collapsed={sapCollapsed}
                  color={colors.border}
                  onToggle={toggleSapCollapsed}
                />
                <Collapse in={!sapCollapsed} timeout="auto" unmountOnExit>
                  <Box sx={indentSx}>
                    {sapEmployees.map((emp) => (
                      <JobcodeSapEmployeeRow
                        key={emp.empId}
                        employee={emp}
                        timelineStart={timelineStart}
                        timelineEnd={timelineEnd}
                        leftColumnWidth={leftColumnWidth}
                        leftColShrink={DM_INDENT_PX}
                      />
                    ))}
                  </Box>
                </Collapse>
              </>
            )}
          </Box>
        </Collapse>
      </Box>
    );
  }
);
JobcodeGroup.displayName = "JobcodeGroup";

export { JobcodeGroup };
