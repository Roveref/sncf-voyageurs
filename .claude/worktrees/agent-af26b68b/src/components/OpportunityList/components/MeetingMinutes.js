// MeetingMinutes.js
import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Divider,
  TextField,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  FormControlLabel,
  alpha,
  useTheme,
  Tooltip,
  IconButton,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Avatar,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import AssignmentIcon from "@mui/icons-material/Assignment";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import BusinessIcon from "@mui/icons-material/Business";
import EventNoteIcon from "@mui/icons-material/EventNote";
import PersonIcon from "@mui/icons-material/Person";
import GroupIcon from "@mui/icons-material/Group";
import InfoIcon from "@mui/icons-material/Info";
import DescriptionIcon from "@mui/icons-material/Description";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";

const MeetingMinutes = ({ id }) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [allActions, setAllActions] = useState([]);
  const [meetingDetails, setMeetingDetails] = useState({
    title: "Pipeline Review Meeting",
    date: new Date().toISOString().split("T")[0],
    attendees: "",
    summary: "",
  });
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [actionsByClient, setActionsByClient] = useState({});
  const [activeStep, setActiveStep] = useState(0);

  // Load all actions from localStorage when dialog opens
  useEffect(() => {
    if (open) {
      const actions = getAllOpportunityActions();
      setAllActions(actions);

      // Group actions by client first, then by opportunity
      const groupedByClient = groupActionsByClient(actions);
      setActionsByClient(groupedByClient);
    }
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setActiveStep(0);
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // Fetch all actions from localStorage
  const getAllOpportunityActions = () => {
    const allActions = [];

    // Iterate through localStorage to find all opportunity actions
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("opportunity_actions_")) {
        try {
          const opportunityActions = JSON.parse(localStorage.getItem(key));
          allActions.push(...opportunityActions);
        } catch {
          // Invalid JSON - skip this entry
        }
      }
    }

    return allActions;
  };

  // Group actions by client first, then by opportunity
  const groupActionsByClient = (actions) => {
    const groupedByClient = {};

    actions.forEach((action) => {
      const clientName = action.opportunityAccount || "Unknown Client";
      const oppName = action.opportunityName || `Opportunity ${action.opportunityId}`;

      if (!groupedByClient[clientName]) {
        groupedByClient[clientName] = {};
      }

      if (!groupedByClient[clientName][oppName]) {
        groupedByClient[clientName][oppName] = [];
      }

      groupedByClient[clientName][oppName].push(action);
    });

    return groupedByClient;
  };

  // Format date for better display
  const formatDate = (dateStr) => {
    try {
      const dateObj = new Date(dateStr);
      return dateObj.toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Generate the minutes document
  const generateMinutes = () => {
    // Filter actions based on user preferences
    const filteredActions = includeCompleted ? allActions : allActions.filter((action) => action.status === "open");

    // Group filtered actions by client
    const filteredGroupedByClient = groupActionsByClient(filteredActions);

    // Create the minutes document content
    let minutes = `# ${meetingDetails.title}\n`;
    minutes += `Date: ${formatDate(meetingDetails.date)}\n\n`;

    if (meetingDetails.attendees) {
      minutes += `## Attendees\n${meetingDetails.attendees}\n\n`;
    }

    if (meetingDetails.summary) {
      minutes += `## Meeting Summary\n${meetingDetails.summary}\n\n`;
    }

    minutes += `## Action Items By Client\n\n`;

    // Add action items grouped by client then opportunity
    Object.entries(filteredGroupedByClient).forEach(([clientName, opportunities]) => {
      minutes += `### Client: ${clientName}\n\n`;

      // Iterate through each opportunity for this client
      Object.entries(opportunities).forEach(([oppName, oppActions]) => {
        // Use the first action to get opportunity details
        const firstAction = oppActions[0];

        minutes += `#### ${oppName}\n\n`;

        // Add opportunity details including ID, EM, EP, Manager, Partner and Status
        minutes += `**Opportunity ID:** ${firstAction.opportunityId || "N/A"}\n`;
        minutes += `**Status:** ${firstAction.opportunityStatus || "N/A"}\n`;
        minutes += `**Engagement Manager:** ${firstAction.opportunityEM || "N/A"}\n`;
        minutes += `**Engagement Partner:** ${firstAction.opportunityEP || "N/A"}\n`;
        minutes += `**Manager:** ${firstAction.opportunityManager || "N/A"}\n`;
        minutes += `**Partner:** ${firstAction.opportunityPartner || "N/A"}\n\n`;

        oppActions.forEach((action) => {
          const priorityLabels = {
            high: "🔴 High",
            medium: "🟠 Medium",
            low: "🟢 Low",
          };
          const priorityText = priorityLabels[action.priority] || action.priority;
          const statusIcon = action.status === "completed" ? "✅" : "⏳";

          minutes += `- ${statusIcon} **${action.description}**\n`;
          minutes += `  - Owner: ${action.owner}\n`;
          minutes += `  - Due Date: ${formatDate(action.dueDate)}\n`;
          minutes += `  - Priority: ${priorityText}\n`;
          minutes += `\n`;
        });
      });
    });

    // Add general statistics
    minutes += `## Meeting Statistics\n\n`;
    minutes += `- Total Clients Reviewed: ${Object.keys(filteredGroupedByClient).length}\n`;
    minutes += `- Total Opportunities Reviewed: ${
      Object.keys(
        filteredActions.reduce((acc, action) => {
          acc[action.opportunityId] = true;
          return acc;
        }, {})
      ).length
    }\n`;
    minutes += `- Total Action Items: ${filteredActions.length}\n`;

    const openActions = filteredActions.filter((a) => a.status === "open").length;
    const completedActions = filteredActions.filter((a) => a.status === "completed").length;

    minutes += `- Open Action Items: ${openActions}\n`;
    minutes += `- Completed Action Items: ${completedActions}\n`;

    // Add high priority actions summary
    const highPriorityActions = filteredActions.filter((a) => a.priority === "high" && a.status === "open");
    if (highPriorityActions.length > 0) {
      minutes += `\n## High Priority Action Items Summary\n\n`;
      highPriorityActions.forEach((action) => {
        minutes += `- **${action.description}** (Client: ${action.opportunityAccount || "Unknown"}, ${action.opportunityName})\n`;
        minutes += `  - Owner: ${action.owner}, Due: ${formatDate(action.dueDate)}\n`;
      });
    }

    // Add footer
    minutes += `\n---\n`;
    minutes += `Minutes generated on ${new Date().toLocaleString("fr-FR")}\n`;

    return minutes;
  };

  // Download the minutes as a markdown file
  const downloadMinutes = () => {
    const minutes = generateMinutes();
    const element = document.createElement("a");
    const file = new Blob([minutes], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);

    // Format the filename with the meeting date
    const meetingDate = meetingDetails.date || new Date().toISOString().split("T")[0];
    element.download = `pipeline_meeting_minutes_${meetingDate.replace(/-/g, "")}.md`;

    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    handleNext(); // Move to the confirmation step
  };

  // Count the total actions across all opportunities and clients
  const countTotalActions = () => {
    return allActions.length;
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return theme.palette.error.main;
      case "medium":
        return theme.palette.warning.main;
      case "low":
        return theme.palette.info.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  // Generate avatar initials for person
  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2);
  };

  // Render dialog content according to step
  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <>
            <Box sx={{ mb: 3, mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Create meeting minutes with actions from all opportunities. You can add meeting details and customize
                the content before exporting.
              </Typography>
            </Box>

            <Paper
              sx={{
                p: 3,
                mb: 3,
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                borderRadius: 2,
                boxShadow: theme.shadows[3],
                transition: "all 0.3s",
                "&:hover": {
                  boxShadow: theme.shadows[6],
                  transform: "translateY(-2px)",
                },
              }}
            >
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Meeting Details
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                <TextField
                  label="Meeting Title"
                  variant="outlined"
                  fullWidth
                  size="small"
                  value={meetingDetails.title}
                  onChange={(e) => setMeetingDetails({ ...meetingDetails, title: e.target.value })}
                  InputProps={{
                    startAdornment: <EventNoteIcon color="action" sx={{ mr: 1 }} />,
                  }}
                />

                <Box sx={{ display: "flex", gap: 2 }}>
                  <TextField
                    label="Meeting Date"
                    type="date"
                    variant="outlined"
                    size="small"
                    value={meetingDetails.date}
                    onChange={(e) => setMeetingDetails({ ...meetingDetails, date: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                </Box>

                <TextField
                  label="Attendees (one per line)"
                  variant="outlined"
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  value={meetingDetails.attendees}
                  onChange={(e) => setMeetingDetails({ ...meetingDetails, attendees: e.target.value })}
                  placeholder="John Doe, IT Manager&#10;Jane Smith, Project Lead"
                  InputProps={{
                    startAdornment: <GroupIcon color="action" sx={{ mr: 1, mt: 1 }} />,
                  }}
                />

                <TextField
                  label="Meeting Summary"
                  variant="outlined"
                  fullWidth
                  multiline
                  rows={3}
                  size="small"
                  value={meetingDetails.summary}
                  onChange={(e) => setMeetingDetails({ ...meetingDetails, summary: e.target.value })}
                  placeholder="Key decisions and discussion points from the meeting..."
                  InputProps={{
                    startAdornment: <DescriptionIcon color="action" sx={{ mr: 1, mt: 1 }} />,
                  }}
                />
              </Box>
            </Paper>
          </>
        );
      case 1:
        return (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Action Items Overview
              </Typography>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeCompleted}
                    onChange={(e) => setIncludeCompleted(e.target.checked)}
                    color="primary"
                  />
                }
                label="Include completed actions"
              />

              <Box sx={{ mb: 3, mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Chip
                  icon={<BusinessIcon />}
                  label={`${Object.keys(actionsByClient).length} Clients`}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  icon={<BusinessIcon />}
                  label={`${
                    Object.keys(
                      allActions.reduce((acc, action) => {
                        acc[action.opportunityId] = true;
                        return acc;
                      }, {})
                    ).length
                  } Opportunities`}
                  color="secondary"
                  variant="outlined"
                />
                <Chip
                  icon={<AssignmentIcon />}
                  label={`${countTotalActions()} Total Actions`}
                  color="info"
                  variant="outlined"
                />
                <Chip
                  label={`${allActions.filter((a) => a.status === "open").length} Open Actions`}
                  color="info"
                  variant="outlined"
                />
                <Chip
                  label={`${allActions.filter((a) => a.priority === "high" && a.status === "open").length} High Priority`}
                  color="error"
                  variant="outlined"
                />
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Actions by Client
            </Typography>

            {Object.keys(actionsByClient).length > 0 ? (
              <List
                sx={{
                  maxHeight: "300px",
                  overflow: "auto",
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.background.paper, 0.5),
                  boxShadow: theme.shadows[3],
                  transition: "all 0.3s",
                  "&:hover": {
                    boxShadow: theme.shadows[6],
                    transform: "translateY(-2px)",
                  },
                }}
              >
                {Object.entries(actionsByClient).map(([clientName, opportunities]) => {
                  const clientActions = Object.values(opportunities).flat();
                  const totalOpenActions = clientActions.filter((a) => a.status === "open").length;
                  const totalHighPriorityActions = clientActions.filter(
                    (a) => a.priority === "high" && a.status === "open"
                  ).length;

                  return (
                    <React.Fragment key={clientName}>
                      <ListItem
                        sx={{
                          px: 2,
                          py: 1.5,
                          borderLeft: `4px solid ${theme.palette.primary.main}`,
                          bgcolor: alpha(theme.palette.primary.main, 0.04),
                          "&:hover": {
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                              <BusinessIcon fontSize="small" sx={{ mr: 1, color: "primary.main" }} />
                              <Typography variant="body2" fontWeight={600}>
                                Client: {clientName}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                {Object.keys(opportunities).length} opportunities, {clientActions.length} action items
                              </Typography>

                              <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                                <Chip
                                  label={`${totalOpenActions} open action${totalOpenActions !== 1 ? "s" : ""}`}
                                  size="small"
                                  variant="outlined"
                                  color="info"
                                  sx={{ height: 20, fontSize: "0.7rem" }}
                                />
                                {totalHighPriorityActions > 0 && (
                                  <Chip
                                    label={`${totalHighPriorityActions} high priority`}
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    sx={{ height: 20, fontSize: "0.7rem" }}
                                  />
                                )}
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>

                      {/* List opportunities under this client */}
                      {Object.entries(opportunities).map(([oppName, oppActions]) => {
                        // Get the first action to extract opportunity details
                        const firstAction = oppActions[0];

                        return (
                          <ListItem
                            key={oppName}
                            sx={{
                              pl: 4,
                              pr: 2,
                              py: 1,
                              borderLeft: `2px solid ${theme.palette.secondary.main}`,
                              ml: 2,
                              bgcolor: alpha(theme.palette.background.paper, 0.5),
                            }}
                          >
                            <ListItemText
                              primary={
                                <Typography variant="body2" fontWeight={500}>
                                  {oppName} ({firstAction.opportunityStatus})
                                </Typography>
                              }
                              secondary={
                                <Box sx={{ mt: 0.5 }}>
                                  <Grid container spacing={1} sx={{ alignItems: "center" }}>
                                    {firstAction.opportunityEM && firstAction.opportunityEM !== "N/A" && (
                                      <Grid item xs={12} sm={6}>
                                        <Box sx={{ display: "flex", alignItems: "center" }}>
                                          <Avatar
                                            sx={{
                                              width: 20,
                                              height: 20,
                                              fontSize: "0.6rem",
                                              bgcolor: theme.palette.primary.main,
                                              mr: 0.5,
                                            }}
                                          >
                                            {getInitials(firstAction.opportunityEM)}
                                          </Avatar>
                                          <Typography variant="caption" color="text.secondary">
                                            EM: <b>{firstAction.opportunityEM}</b>
                                          </Typography>
                                        </Box>
                                      </Grid>
                                    )}

                                    {firstAction.opportunityEP && firstAction.opportunityEP !== "N/A" && (
                                      <Grid item xs={12} sm={6}>
                                        <Box sx={{ display: "flex", alignItems: "center" }}>
                                          <Avatar
                                            sx={{
                                              width: 20,
                                              height: 20,
                                              fontSize: "0.6rem",
                                              bgcolor: theme.palette.secondary.main,
                                              mr: 0.5,
                                            }}
                                          >
                                            {getInitials(firstAction.opportunityEP)}
                                          </Avatar>
                                          <Typography variant="caption" color="text.secondary">
                                            EP: <b>{firstAction.opportunityEP}</b>
                                          </Typography>
                                        </Box>
                                      </Grid>
                                    )}
                                  </Grid>

                                  <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                                    <Chip
                                      label={`${oppActions.length} action${oppActions.length !== 1 ? "s" : ""}`}
                                      size="small"
                                      variant="outlined"
                                      color="secondary"
                                      sx={{ height: 18, fontSize: "0.65rem" }}
                                    />
                                    <Chip
                                      label={`${oppActions.filter((a) => a.status === "open").length} open`}
                                      size="small"
                                      variant="outlined"
                                      color="info"
                                      sx={{ height: 18, fontSize: "0.65rem" }}
                                    />
                                  </Box>
                                </Box>
                              }
                            />
                          </ListItem>
                        );
                      })}
                      <Divider component="li" />
                    </React.Fragment>
                  );
                })}
              </List>
            ) : (
              <Paper
                sx={{
                  p: 3,
                  textAlign: "center",
                  bgcolor: alpha(theme.palette.background.paper, 0.5),
                  border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                  borderRadius: 2,
                  boxShadow: theme.shadows[3],
                  transition: "all 0.3s",
                  "&:hover": {
                    boxShadow: theme.shadows[6],
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  No actions found for any opportunities
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  Add actions to opportunities to include them in the meeting minutes
                </Typography>
              </Paper>
            )}

            {Object.keys(actionsByClient).length > 0 && (
              <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: 2 }}>
                <Typography variant="body2">
                  Your meeting minutes will include details for {Object.keys(actionsByClient).length} clients with{" "}
                  {
                    Object.keys(
                      allActions.reduce((acc, action) => {
                        acc[action.opportunityId] = true;
                        return acc;
                      }, {})
                    ).length
                  }{" "}
                  opportunities and {includeCompleted ? "all" : "open"} action items (
                  {includeCompleted ? countTotalActions() : allActions.filter((a) => a.status === "open").length}).
                </Typography>
              </Box>
            )}
          </>
        );
      case 2:
        return (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <CheckCircleOutlineIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Meeting Minutes Generated Successfully
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your meeting minutes have been downloaded as a markdown file.
            </Typography>
            <Box sx={{ mt: 4, p: 3, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: 2 }}>
              <Typography variant="body2">
                The file contains information about {Object.keys(actionsByClient).length} clients with{" "}
                {
                  Object.keys(
                    allActions.reduce((acc, action) => {
                      acc[action.opportunityId] = true;
                      return acc;
                    }, {})
                  ).length
                }{" "}
                opportunities and{" "}
                {includeCompleted ? countTotalActions() : allActions.filter((a) => a.status === "open").length} action
                items.
              </Typography>
            </Box>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Button
        id={id}
        variant="contained"
        color="primary"
        startIcon={<AssignmentIcon />}
        onClick={handleOpen}
        sx={{ ml: 1 }}
      >
        Meeting Minutes
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
          },
        }}
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <FormatListBulletedIcon sx={{ mr: 1.5, color: "primary.main" }} />
            <Typography variant="h6" fontWeight={600}>
              Generate Pipeline Meeting Minutes
            </Typography>
          </Box>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ px: 3, py: 2 }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            <Step>
              <StepLabel>Meeting Information</StepLabel>
              <StepContent>{getStepContent(0)}</StepContent>
            </Step>
            <Step>
              <StepLabel>Review Action Items</StepLabel>
              <StepContent>{getStepContent(1)}</StepContent>
            </Step>
            <Step>
              <StepLabel>Confirmation</StepLabel>
              <StepContent>{getStepContent(2)}</StepContent>
            </Step>
          </Stepper>
        </DialogContent>

        <Divider />

        <DialogActions sx={{ px: 3, py: 2.5, justifyContent: "space-between" }}>
          <Button onClick={handleClose} color="inherit">
            {activeStep === 2 ? "Close" : "Cancel"}
          </Button>

          <Box>
            {activeStep > 0 && activeStep < 2 && (
              <Button onClick={handleBack} sx={{ mr: 1 }}>
                Back
              </Button>
            )}

            {activeStep < 1 && (
              <Button
                onClick={handleNext}
                variant="contained"
                color="primary"
                disabled={Object.keys(actionsByClient).length === 0}
              >
                Next
              </Button>
            )}

            {activeStep === 1 && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<DownloadIcon />}
                onClick={downloadMinutes}
                disabled={Object.keys(actionsByClient).length === 0}
              >
                Generate & Download
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MeetingMinutes;
