/**
 * EmployeeMetadataTab — Tab 5: Employees
 */

import React, { memo, useMemo } from "react";
import {
  Box,
  Button,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Tooltip,
  alpha,
  useTheme,
  Checkbox,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useUserDataStore } from "../../../stores/useUserDataStore";

import { useMergedEmployeeData } from "../../../hooks/useMergedEmployeeData";
import { getEffectiveGrade } from "../../StaffingTab/types";
import { formatDateShort } from "./tabUtils";
import { useManagementDialog } from "../ManagementDialogContext";

const EmployeeMetadataTab = memo(({ empNameMap }: any) => {
  const { searchText, selectedItems, toggleSelect, toggleSelectAll, handleDeleteSelected } = useManagementDialog();
  const theme = useTheme();

  const { mergedMetadata: storeEmployeeMetadata, manualEmployees: storeManualEmployees } = useMergedEmployeeData();

  // Build combined employee list (metadata + manual)
  const allEmployees = useMemo(() => {
    const manualSet = new Set(storeManualEmployees.map((e) => e.empId));
    const manualNameMap = new Map(storeManualEmployees.map((e) => [e.empId, e.name]));
    const allEmpIds = new Set([...Object.keys(storeEmployeeMetadata), ...manualSet]);
    return Array.from(allEmpIds).map((empId) => {
      const meta = storeEmployeeMetadata[empId];
      const isManual = manualSet.has(empId);
      const name = meta?.name || manualNameMap.get(empId) || empId;
      const grade = meta?.gradeHistory ? getEffectiveGrade(meta.gradeHistory) : null;
      return {
        empId,
        name,
        grade,
        segment: meta?.segment,
        dm: meta?.dm,
        arrivalDate: meta?.arrivalDate,
        departureDate: meta?.departureDate,
        isManual,
        hasMeta: !!meta,
      };
    });
  }, [storeEmployeeMetadata, storeManualEmployees]);

  const lowerSearch = searchText.toLowerCase();
  const filtered = allEmployees.filter((e) => {
    if (!lowerSearch) return true;
    return (
      e.name.toLowerCase().includes(lowerSearch) ||
      e.empId.toLowerCase().includes(lowerSearch) ||
      (e.grade || "").toLowerCase().includes(lowerSearch) ||
      (e.segment || "").toLowerCase().includes(lowerSearch) ||
      (e.dm || "").toLowerCase().includes(lowerSearch)
    );
  });

  const allIds = filtered.map((e) => e.empId);
  const selCount = allIds.filter((id) => selectedItems.has(id)).length;

  return (
    <>
      {filtered.length === 0 ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {allEmployees.length === 0
              ? "Aucune métadonnée ni collaborateur manuel"
              : "Aucun résultat pour cette recherche"}
          </Typography>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 0.5,
              borderBottom: `1px solid ${theme.palette.divider}`,
              bgcolor: selCount > 0 ? alpha(theme.palette.error.main, 0.04) : "transparent",
            }}
          >
            <Checkbox
              size="small"
              checked={allIds.length > 0 && selCount === allIds.length}
              indeterminate={selCount > 0 && selCount < allIds.length}
              onChange={() => toggleSelectAll(allIds)}
            />
            {selCount > 0 ? (
              <>
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                  {selCount} selected
                </Typography>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeleteSelected}
                  sx={{ ml: "auto" }}
                >
                  Delete Selected
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                {filtered.length} employee
                {filtered.length !== 1 ? "s" : ""}
              </Typography>
            )}
          </Box>
          <List sx={{ py: 0 }}>
            {filtered.map((emp) => {
              return (
                <React.Fragment key={emp.empId}>
                  <Divider />
                  <ListItem
                    sx={{
                      py: 1,
                      px: 2,
                      bgcolor: selectedItems.has(emp.empId) ? alpha(theme.palette.primary.main, 0.05) : "transparent",
                      "&:hover": {
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                      },
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={selectedItems.has(emp.empId)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(emp.empId)}
                      sx={{ mr: 1, p: 0.5 }}
                    />
                    <ListItemText
                      primary={
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            noWrap
                            sx={{
                              maxWidth: 220,
                              fontSize: "0.82rem",
                            }}
                          >
                            {emp.name}
                          </Typography>
                          {emp.isManual && (
                            <Chip
                              label="Manual"
                              size="small"
                              color="info"
                              variant="outlined"
                              sx={{
                                height: 18,
                                fontSize: "0.6rem",
                              }}
                            />
                          )}
                          {emp.grade && (
                            <Chip
                              label={emp.grade}
                              size="small"
                              variant="outlined"
                              sx={{
                                height: 18,
                                fontSize: "0.6rem",
                              }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              flexWrap: "wrap",
                            }}
                          >
                            {emp.segment && (
                              <Typography variant="caption" color="text.secondary">
                                {emp.segment}
                              </Typography>
                            )}
                            {emp.dm && (
                              <Typography variant="caption" color="text.secondary">
                                DM: {emp.dm}
                              </Typography>
                            )}
                            {emp.arrivalDate && (
                              <Typography variant="caption" color="text.secondary">
                                Arr: {formatDateShort(emp.arrivalDate)}
                              </Typography>
                            )}
                            {emp.departureDate && (
                              <Typography variant="caption" color="text.secondary">
                                Dep: {formatDateShort(emp.departureDate)}
                              </Typography>
                            )}
                            {!emp.hasMeta && emp.isManual && (
                              <Typography variant="caption" color="text.disabled">
                                Manual employee (no metadata)
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Delete employee data">
                        <IconButton
                          edge="end"
                          size="small"
                          color="error"
                          onClick={() => {
                            const ds = useUserDataStore.getState();
                            ds.deleteOverride(emp.empId);
                            ds.removeManualEmployee(emp.empId);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              );
            })}
          </List>
        </>
      )}
    </>
  );
});

EmployeeMetadataTab.displayName = "EmployeeMetadataTab";

export default EmployeeMetadataTab;
