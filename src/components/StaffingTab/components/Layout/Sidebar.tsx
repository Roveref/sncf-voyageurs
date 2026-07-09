import React, { memo } from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Badge from "@mui/material/Badge";
import GroupIcon from "@mui/icons-material/Group";
import AddIcon from "@mui/icons-material/Add";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ScienceIcon from "@mui/icons-material/Science";
import WarningIcon from "@mui/icons-material/Warning";
import BugReportIcon from "@mui/icons-material/BugReport";
import { easing } from "../../../../styles/animations";
import { ExportButton } from "../Dashboard";

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 224;

/** Navigation items for the sidebar */
export const NAV_ITEMS = [
  { id: "employees", label: "EmployÃ©s", icon: GroupIcon },
  { id: "skills", label: "CompÃ©tences", icon: EmojiEventsIcon },
  { id: "simulation", label: "Simulation", icon: ScienceIcon },
  { id: "debug", label: "Debug", icon: BugReportIcon },
];

/**
 * Application sidebar with navigation and actions.
 */
const Sidebar = memo(
  ({
    activeTab,
    onTabChange,
    collapsed,
    onToggle,
    onAddAssignment,
    alertCount,
    onShowAlerts,
    employees,
    projects,
    alerts,
    teamTuStats,
  }: any) => {
    const drawerWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

    return (
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            bgcolor: "text.primary",
            color: "grey.300",
            transition: `width 300ms ${easing.elegant}`,
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            zIndex: 30,
          },
        }}
      >
        {/* Top - logo / collapse toggle */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 56,
            px: 2,
            borderBottom: 1,
            borderColor: "grey.700",
          }}
        >
          {!collapsed && (
            <Typography
              variant="subtitle2"
              sx={{
                color: "common.white",
                fontWeight: 600,
                letterSpacing: "0.05em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Staffing
            </Typography>
          )}
          <IconButton
            onClick={onToggle}
            aria-label={collapsed ? "Open menu" : "Close menu"}
            sx={{ color: "grey.400", "&:hover": { bgcolor: "grey.700" } }}
            size="small"
          >
            {collapsed ? <MenuIcon fontSize="small" /> : <CloseIcon fontSize="small" />}
          </IconButton>
        </Box>

        {/* Nav items */}
        <List component="nav" aria-label="Main menu" sx={{ flex: 1, py: 1.5, px: 1, overflowY: "auto" }}>
          {NAV_ITEMS.map(({ id, label, icon: Icon }: any) => {
            const isActive = activeTab === id;
            return (
              <ListItemButton
                key={id}
                onClick={() => onTabChange(id)}
                title={collapsed ? label : undefined}
                aria-current={isActive ? "page" : undefined}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  px: 1.5,
                  py: 1,
                  minHeight: 40,
                  justifyContent: collapsed ? "center" : "flex-start",
                  bgcolor: isActive ? "grey.800" : "transparent",
                  color: isActive ? "common.white" : "grey.300",
                  "&:hover": { bgcolor: "grey.800" },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: "inherit",
                    minWidth: 0,
                    mr: collapsed ? 0 : 1.5,
                    justifyContent: "center",
                  }}
                >
                  <Icon fontSize="small" />
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{
                      variant: "body2",
                      fontWeight: 500,
                      noWrap: true,
                    }}
                  />
                )}
              </ListItemButton>
            );
          })}
        </List>

        {/* Actions section */}
        <Box sx={{ px: 1, py: 1.5, borderTop: 1, borderColor: "grey.700" }}>
          {!collapsed && (
            <Typography
              sx={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "grey.500",
                px: 1.5,
                mb: 1,
              }}
            >
              Actions
            </Typography>
          )}

          {/* New Assignment button */}
          <ListItemButton
            onClick={onAddAssignment}
            title="New Assignment"
            sx={{
              borderRadius: 2,
              px: 1.5,
              py: 1,
              mb: 0.5,
              color: "#60a5fa",
              justifyContent: collapsed ? "center" : "flex-start",
              "&:hover": { bgcolor: "grey.800" },
            }}
          >
            <ListItemIcon
              sx={{
                color: "inherit",
                minWidth: 0,
                mr: collapsed ? 0 : 1.5,
                justifyContent: "center",
              }}
            >
              <AddIcon fontSize="small" />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary="New Assignment"
                primaryTypographyProps={{
                  variant: "body2",
                  fontWeight: 500,
                  noWrap: true,
                }}
              />
            )}
          </ListItemButton>

          {/* Alerts button */}
          <ListItemButton
            onClick={onShowAlerts}
            title="Alerts"
            sx={{
              borderRadius: 2,
              px: 1.5,
              py: 1,
              mb: 0.5,
              color: "grey.300",
              justifyContent: collapsed ? "center" : "flex-start",
              position: "relative",
              "&:hover": { bgcolor: "grey.800" },
            }}
          >
            <ListItemIcon
              sx={{
                color: "inherit",
                minWidth: 0,
                mr: collapsed ? 0 : 1.5,
                justifyContent: "center",
              }}
            >
              <Badge
                badgeContent={alertCount}
                color="error"
                invisible={!alertCount || alertCount === 0}
                sx={{
                  "& .MuiBadge-badge": {
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: 18,
                    height: 18,
                  },
                }}
              >
                <WarningIcon fontSize="small" />
              </Badge>
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary="Alerts"
                primaryTypographyProps={{
                  variant: "body2",
                  fontWeight: 500,
                  noWrap: true,
                }}
              />
            )}
            {!collapsed && alertCount > 0 && (
              <Box
                component="span"
                sx={{
                  bgcolor: "error.main",
                  color: "common.white",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: "9999px",
                  minWidth: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  px: 0.5,
                }}
              >
                {alertCount}
              </Box>
            )}
          </ListItemButton>

          <ExportButton
            employees={employees}
            projects={projects}
            alerts={alerts}
            teamTuStats={teamTuStats}
            compact={true}
            dropdownPosition="right"
          />
        </Box>
      </Drawer>
    );
  }
);

Sidebar.displayName = "Sidebar";

export default Sidebar;
