/**
 * ScenariosTab — Tab 6: Scenarios
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
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import useScenarioStore from "../../../stores/useScenarioStore";
import { deleteScenarioWithCleanup } from "../../../stores/helpers";
import { formatDateShort } from "./tabUtils";
import { useManagementDialog } from "../ManagementDialogContext";

const ScenariosTab = memo(({ empNameMap, opportunityData, collapsedGroups }: any) => {
  const { searchText, selectedItems, toggleSelect, toggleSelectAll, handleDeleteSelected, toggleGroupCollapse } =
    useManagementDialog();
  const theme = useTheme();

  const storeScenarios = useScenarioStore((s) => s.scenarios);

  const allScenarios = storeScenarios;

  const lowerSearch = searchText.toLowerCase();
  const filtered = allScenarios.filter((sc) => {
    if (!lowerSearch) return true;
    return sc.name.toLowerCase().includes(lowerSearch) || (sc.description || "").toLowerCase().includes(lowerSearch);
  });

  const allIds = filtered.map((sc) => sc.id);
  const selCount = allIds.filter((id) => selectedItems.has(id)).length;

  // TYPE_CONFIG for assignment overrides
  const ASSIGN_TYPE = useMemo(
    () => ({
      create: {
        Icon: AddCircleOutlineIcon,
        color: "#10b981",
        label: "Ajout",
      },
      edit: { Icon: EditIcon, color: "#3b82f6", label: "Modif." },
      delete: {
        Icon: DeleteOutlineIcon,
        color: "#ef4444",
        label: "Suppr.",
      },
    }),
    []
  );

  return (
    <>
      {filtered.length === 0 ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {allScenarios.length === 0 ? "No scenarios" : "No results matching your search"}
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
                {filtered.length} scenario
                {filtered.length !== 1 ? "s" : ""}
              </Typography>
            )}
          </Box>
          <List sx={{ py: 0 }}>
            {filtered.map((sc) => {
              const assignEntries = Object.entries(sc.assignmentOverrides || {});
              const empOverEntries = Object.entries(sc.employeeOverrides || {});
              const assignCount = assignEntries.length;
              const empOverCount = empOverEntries.length;
              const baseName = sc.baseScenarioId
                ? allScenarios.find((s) => s.id === sc.baseScenarioId)?.name || "deleted"
                : "real";
              const detailKey = `sc-detail-${sc.id}`;
              const isExpanded = collapsedGroups.has(detailKey);
              const hasDetails = assignCount > 0 || empOverCount > 0;
              return (
                <React.Fragment key={sc.id}>
                  <Divider />
                  <ListItem
                    sx={{
                      py: 1,
                      px: 2,
                      cursor: hasDetails ? "pointer" : "default",
                      bgcolor: selectedItems.has(sc.id) ? alpha(theme.palette.primary.main, 0.05) : "transparent",
                      "&:hover": {
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                      },
                    }}
                    onClick={() => hasDetails && toggleGroupCollapse(detailKey)}
                  >
                    <Checkbox
                      size="small"
                      checked={selectedItems.has(sc.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(sc.id)}
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
                          {hasDetails &&
                            (isExpanded ? (
                              <ExpandLessIcon
                                sx={{
                                  fontSize: 16,
                                  color: "text.disabled",
                                }}
                              />
                            ) : (
                              <ExpandMoreIcon
                                sx={{
                                  fontSize: 16,
                                  color: "text.disabled",
                                }}
                              />
                            ))}
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            noWrap
                            sx={{
                              maxWidth: 220,
                              fontSize: "0.82rem",
                            }}
                          >
                            {sc.name}
                          </Typography>
                          {assignCount > 0 && (
                            <Chip
                              label={`${assignCount} assign.`}
                              size="small"
                              variant="outlined"
                              sx={{
                                height: 18,
                                fontSize: "0.6rem",
                              }}
                            />
                          )}
                          {empOverCount > 0 && (
                            <Chip
                              label={`${empOverCount} emp.`}
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
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            mt: 0.5,
                            flexWrap: "wrap",
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            Base: {baseName}
                          </Typography>
                          {sc.description && (
                            <Typography variant="caption" color="text.secondary">
                              {sc.description}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.disabled">
                            {formatDateShort(sc.updatedAt)}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Delete scenario">
                        <IconButton
                          edge="end"
                          size="small"
                          color="error"
                          onClick={() => deleteScenarioWithCleanup(sc.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>

                  {/* Expanded detail: assignment + employee overrides */}
                  {hasDetails && isExpanded && (
                    <Box
                      sx={{
                        pl: 6,
                        pr: 2,
                        pb: 1.5,
                        bgcolor: alpha(theme.palette.grey[500], 0.02),
                      }}
                    >
                      {/* Assignment overrides */}
                      {assignCount > 0 && (
                        <Box
                          sx={{
                            mb: empOverCount > 0 ? 1.5 : 0,
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            color="text.secondary"
                            sx={{
                              display: "block",
                              mb: 0.5,
                            }}
                          >
                            Assignment overrides ({assignCount})
                          </Typography>
                          {assignEntries.map(([key, override]) => {
                            const cfg = ASSIGN_TYPE[override.type] || ASSIGN_TYPE.edit;
                            const empName = empNameMap.get(override.data?.empId) || override.data?.empId || "?";
                            const jobNo = override.data?.jobNo || "";
                            const opp = opportunityData.find(
                              (o: any) => o.jobNo === jobNo || o.opportunityId === jobNo
                            );
                            const jobLabel = opp
                              ? `${opp.account ? opp.account + " - " : ""}${opp.opportunity || jobNo}`
                              : jobNo;
                            return (
                              <Box
                                key={key}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                  py: 0.5,
                                  px: 1,
                                  mb: 0.25,
                                  borderRadius: 1,
                                  bgcolor: alpha(cfg.color, 0.05),
                                  border: `1px solid ${alpha(cfg.color, 0.12)}`,
                                }}
                              >
                                <Tooltip title={cfg.label}>
                                  <cfg.Icon
                                    sx={{
                                      fontSize: 14,
                                      color: cfg.color,
                                      flexShrink: 0,
                                    }}
                                  />
                                </Tooltip>
                                <Box
                                  sx={{
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                    }}
                                    noWrap
                                  >
                                    {empName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" noWrap>
                                    {jobLabel}
                                    {override.data?.startDate ? ` · ${override.data.startDate}` : ""}
                                  </Typography>
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      )}

                      {/* Employee overrides */}
                      {empOverCount > 0 && (
                        <Box>
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            color="text.secondary"
                            sx={{
                              display: "block",
                              mb: 0.5,
                            }}
                          >
                            Employee overrides ({empOverCount})
                          </Typography>
                          {empOverEntries.map(([empId, override]) => {
                            const empName = empNameMap.get(empId) || empId;
                            const isRemoved = override.isRemoved;
                            const isVirtual = override.isVirtual;
                            const color = isRemoved ? "#ef4444" : isVirtual ? "#10b981" : "#8b5cf6";
                            const EmpIcon = isRemoved ? PersonRemoveIcon : isVirtual ? PersonAddIcon : SwapHorizIcon;
                            const label = isRemoved ? "Depart" : isVirtual ? "Virtuel" : "Metadata";
                            return (
                              <Box
                                key={empId}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                  py: 0.5,
                                  px: 1,
                                  mb: 0.25,
                                  borderRadius: 1,
                                  bgcolor: alpha(color, 0.05),
                                  border: `1px solid ${alpha(color, 0.12)}`,
                                }}
                              >
                                <Tooltip title={label}>
                                  <EmpIcon
                                    sx={{
                                      fontSize: 14,
                                      color,
                                      flexShrink: 0,
                                    }}
                                  />
                                </Tooltip>
                                <Box
                                  sx={{
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                    }}
                                    noWrap
                                  >
                                    {empName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" noWrap>
                                    {override.metadata?.team ? `Equipe: ${override.metadata.team}` : ""}
                                    {override.metadata?.dm ? ` · DM: ${override.metadata.dm}` : ""}
                                  </Typography>
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  )}
                </React.Fragment>
              );
            })}
          </List>
        </>
      )}
    </>
  );
});

ScenariosTab.displayName = "ScenariosTab";

export default ScenariosTab;
