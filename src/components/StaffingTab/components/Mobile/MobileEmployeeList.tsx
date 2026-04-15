import { memo, useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import SearchIcon from "@mui/icons-material/Search";
import MobileEmployeeCard from "./MobileEmployeeCard";
import EmployeeDetailSheet from "./EmployeeDetailSheet";
import type { Employee } from "../../types";

interface MobileEmployeeListProps {
  employees: Employee[];
  dailyGrid: Map<string, { cells: any[] }>;
  timelineStart: Date;
  timelineEnd: Date;
  enabledHolidayDates: Set<string>;
  heatmapMode: string;
  /** Search state from parent (StaffingTab filters) */
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Called when employee detail actions need to bubble up */
  onPeriodClick?: (empId: string, startDate: string, endDate: string) => void;
}

const MAX_MOBILE_EMPLOYEES = 50;

const MobileEmployeeList = memo(
  ({
    employees,
    dailyGrid,
    timelineStart,
    timelineEnd,
    enabledHolidayDates,
    heatmapMode,
    searchValue,
    onSearchChange,
    onPeriodClick,
  }: MobileEmployeeListProps) => {
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [groupBy, setGroupBy] = useState<string>("none");

    const handleCardClick = useCallback((emp: Employee) => {
      setSelectedEmployee(emp);
    }, []);

    /** Compute TU rate for each employee from dailyGrid */
    const tuRates = useMemo(() => {
      const map = new Map<string, number | null>();
      for (const emp of employees) {
        const grid = dailyGrid.get(emp.empId);
        if (!grid || grid.cells.length === 0) {
          map.set(emp.empId, null);
          continue;
        }
        let totalNet = 0;
        let totalCh = 0;
        for (const cell of grid.cells) {
          if (cell.isInactive || cell.isWeekend || cell.isHoliday) continue;
          const segments = cell.segments || [];
          let dayNet = 0;
          let dayCh = 0;
          for (const seg of segments) {
            dayNet += seg.utilization ?? 0;
            if (seg.isChargeable) dayCh += seg.utilization ?? 0;
          }
          totalNet += dayNet;
          totalCh += dayCh;
        }
        map.set(emp.empId, totalNet > 0 ? (totalCh / totalNet) * 100 : null);
      }
      return map;
    }, [employees, dailyGrid]);

    const displayEmployees = useMemo(() => employees.slice(0, MAX_MOBILE_EMPLOYEES), [employees]);

    return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Sticky toolbar */}
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            bgcolor: "background.default",
            px: 1,
            pt: 1,
            pb: 0.75,
            display: "flex",
            gap: 1,
            alignItems: "center",
          }}
        >
          <TextField
            size="small"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            sx={{ flex: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18 }} />
                  </InputAdornment>
                ),
                sx: { height: 36, borderRadius: 2, fontSize: "0.85rem" },
              },
            }}
          />
          <Select
            size="small"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            sx={{ minWidth: 90, height: 36, fontSize: "0.8rem" }}
          >
            <MenuItem value="none">All</MenuItem>
            <MenuItem value="grade">Grade</MenuItem>
            <MenuItem value="subTeam">Team</MenuItem>
          </Select>
        </Box>

        {/* Count */}
        <Box sx={{ px: 1.5, pb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {employees.length} employee{employees.length !== 1 ? "s" : ""}
            {employees.length > MAX_MOBILE_EMPLOYEES && ` (showing ${MAX_MOBILE_EMPLOYEES})`}
          </Typography>
        </Box>

        {/* Cards */}
        <Box sx={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch", pb: 2 }}>
          {displayEmployees.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 6 }}>
              No employees match the current filters
            </Typography>
          ) : (
            displayEmployees.map((emp) => (
              <MobileEmployeeCard
                key={emp.empId}
                employee={emp}
                tuRate={tuRates.get(emp.empId) ?? null}
                onClick={handleCardClick}
              />
            ))
          )}
        </Box>

        {/* Employee detail sheet */}
        {selectedEmployee && (
          <EmployeeDetailSheet
            employee={selectedEmployee}
            dailyGrid={dailyGrid}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            enabledHolidayDates={enabledHolidayDates}
            heatmapMode={heatmapMode}
            onClose={() => setSelectedEmployee(null)}
            onPeriodClick={onPeriodClick}
          />
        )}
      </Box>
    );
  }
);
MobileEmployeeList.displayName = "MobileEmployeeList";

export default MobileEmployeeList;
