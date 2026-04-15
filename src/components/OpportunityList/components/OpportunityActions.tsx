// OpportunityActions.js — Actions panel only (no Grid wrapper, no Staffing)
import React, { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "../../../utils/formatters";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import type { OpportunityAction } from "../../../types/actions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Avatar from "@mui/material/Avatar";
import { alpha, useTheme } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { brand } from "../../../config/brandConfig";

const PRIORITIES = [
  { value: "high", label: "High", color: "error" as const },
  { value: "medium", label: "Medium", color: "warning" as const },
  { value: "low", label: "Low", color: "info" as const },
];

const getDefaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().split("T")[0];
};

const EMPTY_ACTIONS: any[] = [];
const isDone = (status: string) => status === "done";

const OpportunityActions = ({ opportunityId, opportunityName, opportunityDetails }: any) => {
  const theme = useTheme();
  const actions = useUserDataStore((s) => s.opportunityActions[opportunityId] ?? EMPTY_ACTIONS);
  const [newAction, setNewAction] = useState({
    description: "",
    owner: "",
    dueDate: getDefaultDueDate(),
    priority: "medium",
    status: "open",
  });
  const [editingAction, setEditingAction] = useState<any>(null);
  const [isAddingAction, setIsAddingAction] = useState(false);

  // Export event listener
  useEffect(() => {
    const handleExportEvent = (event: any) => {
      if (event.detail.opportunityId === opportunityId) downloadMinutes();
    };
    window.addEventListener("exportOpportunityData", handleExportEvent);
    return () => window.removeEventListener("exportOpportunityData", handleExportEvent);
  }, [opportunityId, actions, opportunityDetails]);

  const handleAddAction = () => {
    if (!newAction.description || !newAction.owner) return;
    const actionToAdd = {
      ...newAction,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      opportunityId,
      opportunityName,
      opportunityEM: opportunityDetails?.em || "N/A",
      opportunityEP: opportunityDetails?.ep || "N/A",
      opportunityManager: opportunityDetails?.manager || "N/A",
      opportunityPartner: opportunityDetails?.partner || "N/A",
      opportunityAccount: opportunityDetails?.account || "N/A",
      opportunityStatus: opportunityDetails?.status || "N/A",
    };
    useUserDataStore.getState().setOpportunityActions(opportunityId, [...actions, actionToAdd as OpportunityAction]);
    setNewAction({ description: "", owner: "", dueDate: getDefaultDueDate(), priority: "medium", status: "open" });
    setIsAddingAction(false);
  };

  const handleUpdateAction = () => {
    if (!editingAction || !editingAction.description || !editingAction.owner) return;
    useUserDataStore.getState().setOpportunityActions(
      opportunityId,
      actions.map((a) => (a.id === editingAction.id ? editingAction : a))
    );
    setEditingAction(null);
  };

  const handleDeleteAction = (actionId: string) => {
    useUserDataStore.getState().setOpportunityActions(
      opportunityId,
      actions.filter((a) => a.id !== actionId)
    );
    if (editingAction && editingAction.id === actionId) setEditingAction(null);
  };

  const handleEditAction = (action: OpportunityAction) => {
    setEditingAction({ ...action });
    setIsAddingAction(false);
  };

  const handleToggleStatus = (actionId: string) => {
    useUserDataStore.getState().setOpportunityActions(
      opportunityId,
      actions.map((a) => (a.id === actionId ? { ...a, status: isDone(a.status) ? "open" : "done" } : a))
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR");
    } catch {
      return dateStr;
    }
  };
  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("fr-FR");
    } catch {
      return dateStr;
    }
  };

  const generateMinutes = () => {
    let minutes = `# Opportunity Report: ${opportunityName}\nDate: ${new Date().toLocaleDateString("fr-FR")}\n\n`;
    minutes += `## Opportunity Details\n\n- **ID**: ${opportunityId}\n- **Name**: ${opportunityName}\n`;
    minutes += `- **Status**: ${opportunityDetails?.status || "N/A"}\n- **Account**: ${opportunityDetails?.account || "N/A"}\n`;
    minutes += `- **Revenue**: ${typeof opportunityDetails?.grossRevenue === "number" ? formatCurrency(opportunityDetails.grossRevenue) : opportunityDetails?.grossRevenue || "N/A"}\n\n`;
    minutes += `## Team\n\n- **EM**: ${opportunityDetails?.em || "N/A"}\n- **EP**: ${opportunityDetails?.ep || "N/A"}\n`;
    minutes += `- **Manager**: ${opportunityDetails?.manager || "N/A"}\n- **Partner**: ${opportunityDetails?.partner || "N/A"}\n\n`;
    if (actions.length > 0) {
      minutes += `## Action Items\n\n`;
      actions.forEach((a: OpportunityAction) => {
        const icon = isDone(a.status) ? "✅" : "⏳";
        minutes += `- ${icon} **${a.description}**\n  - Owner: ${a.owner}, Due: ${formatDate(a.dueDate)}, Priority: ${a.priority}\n\n`;
      });
    }
    minutes += `## Summary\n\n- Total: ${actions.length}\n- Open: ${actions.filter((a) => !isDone(a.status)).length}\n- Completed: ${actions.filter((a) => isDone(a.status)).length}\n`;
    return minutes;
  };

  const downloadMinutes = () => {
    const blob = new Blob([generateMinutes()], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `opportunity_report_${opportunityId}_${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  const accentColor = brand.secondary;

  return (
    <Box>
      {/* Add button */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
        <IconButton
          size="small"
          aria-label="Add action item"
          onClick={() => {
            setIsAddingAction(true);
            setEditingAction(null);
          }}
          sx={{
            width: 28,
            height: 28,
            bgcolor: alpha(accentColor, 0.08),
            "&:hover": { bgcolor: alpha(accentColor, 0.15) },
          }}
        >
          <AddIcon sx={{ fontSize: 16, color: accentColor }} />
        </IconButton>
      </Box>

      {/* Form */}
      {(isAddingAction || editingAction) && (
        <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
          <Typography variant="subtitle2" gutterBottom fontWeight={600} color={accentColor}>
            {editingAction ? "Edit Action Item" : "New Action Item"}
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <TextField
              label="Description"
              fullWidth
              variant="outlined"
              size="small"
              value={editingAction ? editingAction.description : newAction.description}
              onChange={(e) =>
                editingAction
                  ? setEditingAction({ ...editingAction, description: e.target.value })
                  : setNewAction({ ...newAction, description: e.target.value })
              }
              placeholder="Describe the action to be taken..."
              inputProps={{ "aria-label": "Action description" }}
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Owner"
                variant="outlined"
                size="small"
                sx={{ flex: 1 }}
                value={editingAction ? editingAction.owner : newAction.owner}
                onChange={(e) =>
                  editingAction
                    ? setEditingAction({ ...editingAction, owner: e.target.value })
                    : setNewAction({ ...newAction, owner: e.target.value })
                }
                inputProps={{ "aria-label": "Action owner" }}
              />
              <TextField
                label="Due Date"
                type="date"
                variant="outlined"
                size="small"
                sx={{ width: 160 }}
                value={editingAction ? editingAction.dueDate : newAction.dueDate}
                onChange={(e) =>
                  editingAction
                    ? setEditingAction({ ...editingAction, dueDate: e.target.value })
                    : setNewAction({ ...newAction, dueDate: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
                inputProps={{ "aria-label": "Action due date" }}
              />
              <FormControl size="small" sx={{ width: 140 }}>
                <InputLabel>Priority</InputLabel>
                <Select
                  label="Priority"
                  value={editingAction ? editingAction.priority : newAction.priority}
                  onChange={(e) =>
                    editingAction
                      ? setEditingAction({ ...editingAction, priority: e.target.value })
                      : setNewAction({ ...newAction, priority: e.target.value })
                  }
                >
                  {PRIORITIES.map((p) => (
                    <MenuItem key={p.value} value={p.value}>
                      {p.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setIsAddingAction(false);
                  setEditingAction(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={editingAction ? handleUpdateAction : handleAddAction}
              >
                {editingAction ? "Update" : "Save"}
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* List */}
      {actions.length > 0 ? (
        <Box sx={{ borderRadius: 2, overflow: "hidden" }}>
          <List disablePadding>
            {actions.map((action, index) => (
              <React.Fragment key={action.id}>
                {index > 0 && <Divider component="li" />}
                <ListItem
                  alignItems="flex-start"
                  sx={{
                    py: 2,
                    px: 2,
                    position: "relative",
                    background: index % 2 === 0 ? alpha(theme.palette.background.default, 0.3) : "transparent",
                    opacity: isDone(action.status) ? 0.7 : 1,
                  }}
                >
                  <Box sx={{ display: "flex", width: "100%" }}>
                    <Avatar
                      sx={{
                        bgcolor: isDone(action.status) ? theme.palette.success.main : theme.palette.primary.main,
                        width: 36,
                        height: 36,
                        mr: 2,
                      }}
                    >
                      {getInitials(action.owner)}
                    </Avatar>
                    <Box sx={{ flex: 1, pr: 8 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5, alignItems: "center" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {action.owner}
                          </Typography>
                          <Chip
                            label={isDone(action.status) ? "Done" : "Open"}
                            size="small"
                            color={isDone(action.status) ? "success" : "default"}
                            variant="outlined"
                            sx={{ height: 20, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.75 } }}
                          />
                          {action.priority && (
                            <Chip
                              label={PRIORITIES.find((p) => p.value === action.priority)?.label || action.priority}
                              size="small"
                              color={PRIORITIES.find((p) => p.value === action.priority)?.color || "default"}
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.75 } }}
                            />
                          )}
                          <Chip
                            label={`Due: ${formatDate(action.dueDate)}`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.75 } }}
                          />
                        </Box>
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{ textDecoration: isDone(action.status) ? "line-through" : "none" }}
                      >
                        {action.description}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 0.5 }}>
                    <IconButton
                      size="small"
                      aria-label={isDone(action.status) ? "Mark action as open" : "Mark action as done"}
                      onClick={() => handleToggleStatus(action.id)}
                      sx={{ color: isDone(action.status) ? theme.palette.success.main : theme.palette.action.active }}
                    >
                      {isDone(action.status) ? (
                        <CheckCircleOutlineIcon fontSize="small" color="success" />
                      ) : (
                        <RadioButtonUncheckedIcon fontSize="small" />
                      )}
                    </IconButton>
                    <IconButton size="small" aria-label="Edit action item" onClick={() => handleEditAction(action)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="Delete action item"
                      onClick={() => handleDeleteAction(action.id)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Box>
      ) : (
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
          No actions yet
        </Typography>
      )}
    </Box>
  );
};

export default OpportunityActions;
