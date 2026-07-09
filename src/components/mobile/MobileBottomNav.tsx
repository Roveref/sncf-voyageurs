import { memo } from "react";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Paper from "@mui/material/Paper";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";

interface MobileBottomNavProps {
  activeTab: number;
  onTabChange: (newTab: number) => void;
}

const TAB_ITEMS = [
  { label: "Parc", icon: <TrendingUpRoundedIcon /> },
  { label: "Maint.", icon: <TaskAltRoundedIcon /> },
  { label: "Plan", icon: <GroupsRoundedIcon /> },
  { label: "Cycle", icon: <HubRoundedIcon /> },
  { label: "Conf.", icon: <PersonAddAltRoundedIcon /> },
] as const;

const MobileBottomNav = memo(({ activeTab, onTabChange }: MobileBottomNavProps) => (
  <Paper
    sx={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: (theme) => theme.zIndex.appBar,
      pb: "var(--safe-area-bottom)",
      borderTop: "1px solid",
      borderColor: "divider",
    }}
    elevation={8}
  >
    <BottomNavigation
      value={activeTab}
      onChange={(_, newValue) => onTabChange(newValue)}
      showLabels
      sx={(theme) => ({
        height: 56,
        bgcolor: theme.palette.primary.dark,
        "& .MuiBottomNavigationAction-root": {
          color: "rgba(255,255,255,0.5)",
          minWidth: 60,
          py: 0.5,
          "&.Mui-selected": {
            color: theme.palette.primary.main,
          },
        },
        "& .MuiBottomNavigationAction-label": {
          fontSize: "0.65rem",
          "&.Mui-selected": {
            fontSize: "0.7rem",
            fontWeight: 700,
          },
        },
      })}
    >
      {TAB_ITEMS.map(({ label, icon }) => (
        <BottomNavigationAction key={label} label={label} icon={icon} />
      ))}
    </BottomNavigation>
  </Paper>
));
MobileBottomNav.displayName = "MobileBottomNav";

export default MobileBottomNav;
