/**
 * ManagerSelector — Dropdown to select a manager for team filtering.
 */

import React, { memo, useState, useMemo } from "react";
import Box from "@mui/material/Box";
import PersonIcon from "@mui/icons-material/Person";
import GroupIcon from "@mui/icons-material/Group";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { getGradeColor, compareGrades } from "../../constants";
import { easing } from "../../../../styles/animations";
import type { Employee } from "../../types";

interface ManagerInfo {
  empId: string;
  name: string;
  grade: string;
  subTeam: string;
  directReports: string[];
  allReports: string[];
}

interface ManagerSelectorProps {
  managers: Record<string, ManagerInfo>;
  selectedManager: string | null;
  onSelect: (empId: string | null) => void;
  employees: Employee[];
}

const ManagerSelector = memo(({ managers, selectedManager, onSelect, employees }: ManagerSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const managerList = useMemo(() => {
    return Object.values(managers).sort((a, b) => {
      const gradeCompare = compareGrades(a.grade, b.grade);
      if (gradeCompare !== 0) return gradeCompare;
      return a.name.localeCompare(b.name);
    });
  }, [managers]);

  const selectedManagerData = selectedManager ? managers[selectedManager] : null;

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        component="button"
        onClick={() => setIsOpen(!isOpen)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1.25,
          bgcolor: "#fff",
          border: 1,
          borderColor: "#d1d5db",
          borderRadius: 2,
          "&:hover": { bgcolor: "background.default" },
          minWidth: "280px",
          cursor: "pointer",
          background: "none",
          fontFamily: "inherit",
        }}
      >
        <PersonIcon sx={{ fontSize: 20, color: "text.disabled" }} />
        <Box sx={{ flex: 1, textAlign: "left" }}>
          {selectedManagerData ? (
            <>
              <Box sx={{ fontWeight: 500, color: "text.primary" }}>{selectedManagerData.name}</Box>
              <Box sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                {selectedManagerData.grade} • {selectedManagerData.directReports.length} direct reports
              </Box>
            </>
          ) : (
            <Box sx={{ color: "text.secondary" }}>All employees</Box>
          )}
        </Box>
        <ExpandMoreIcon
          sx={{
            fontSize: 20,
            color: "text.disabled",
            transition: `transform 0.3s ${easing.elegant}`,
            transform: isOpen ? "rotate(180deg)" : "none",
          }}
        />
      </Box>

      {isOpen && (
        <>
          <Box sx={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setIsOpen(false)} />
          <Box
            sx={{
              position: "absolute",
              top: "100%",
              left: 0,
              mt: 0.5,
              width: "100%",
              bgcolor: "#fff",
              borderRadius: 2,
              boxShadow: 3,
              border: 1,
              borderColor: "#e5e7eb",
              py: 0.5,
              zIndex: 20,
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            <Box
              component="button"
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              sx={{
                width: "100%",
                px: 2,
                py: 1,
                textAlign: "left",
                "&:hover": { bgcolor: "background.default" },
                display: "flex",
                alignItems: "center",
                gap: 1,
                cursor: "pointer",
                border: "none",
                background: "none",
                fontFamily: "inherit",
                ...(!selectedManager && { bgcolor: "#eff6ff" }),
              }}
            >
              <GroupIcon sx={{ fontSize: 16, color: "text.disabled" }} />
              <Box component="span" sx={{ fontWeight: 500 }}>
                All employees
              </Box>
              <Box component="span" sx={{ fontSize: "0.875rem", color: "text.secondary", ml: "auto" }}>
                {employees.length}
              </Box>
            </Box>

            <Box sx={{ borderTop: 1, borderColor: "#f3f4f6", my: 0.5 }} />

            {managerList.map((manager) => {
              const gradeColors = getGradeColor(manager.grade);
              const isSelected = selectedManager === manager.empId;

              return (
                <Box
                  component="button"
                  key={manager.empId}
                  onClick={() => {
                    onSelect(manager.empId);
                    setIsOpen(false);
                  }}
                  sx={{
                    width: "100%",
                    px: 2,
                    py: 1,
                    textAlign: "left",
                    "&:hover": { bgcolor: "background.default" },
                    cursor: "pointer",
                    border: "none",
                    background: "none",
                    fontFamily: "inherit",
                    ...(isSelected && { bgcolor: "#eff6ff" }),
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <HowToRegIcon sx={{ fontSize: 16, color: "#3b82f6" }} />
                    <Box component="span" sx={{ fontWeight: 500, color: "text.primary" }}>
                      {manager.name}
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        px: 1,
                        py: 0.25,
                        fontSize: "0.75rem",
                        borderRadius: 1,
                        bgcolor: gradeColors.bg,
                        color: gradeColors.text,
                      }}
                    >
                      {manager.grade}
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 0.5,
                      ml: 3,
                      fontSize: "0.75rem",
                      color: "text.secondary",
                    }}
                  >
                    <Box component="span">{manager.directReports.length} directs</Box>
                    <Box component="span">&bull;</Box>
                    <Box component="span">{manager.allReports.length} total</Box>
                    <Box component="span">&bull;</Box>
                    <Box component="span">{manager.subTeam}</Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </>
      )}
    </Box>
  );
});

ManagerSelector.displayName = "ManagerSelector";

export default ManagerSelector;
