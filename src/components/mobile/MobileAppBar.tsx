import { memo } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import FilterListIcon from "@mui/icons-material/FilterList";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { timing, easing } from "../../styles/animations";

interface MobileAppBarProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  activeTab: number;
  activeFilterCount: number;
  onFilterOpen: () => void;
  onOverflowOpen: (anchor: HTMLElement) => void;
  dataReady: boolean;
}

const TAB_LABELS = ["Parc", "Maint.", "Plan", "Cycle"];

const MobileAppBar = memo(
  ({
    darkMode,
    toggleDarkMode,
    activeTab,
    activeFilterCount,
    onFilterOpen,
    onOverflowOpen,
    dataReady,
  }: MobileAppBarProps) => (
    <AppBar
      position="fixed"
      elevation={0}
      sx={(theme) => ({
        backgroundColor: theme.palette.primary.dark,
        zIndex: theme.zIndex.drawer + 1,
        boxShadow: "none",
        transition: `background-color ${timing.normal} ${easing.elegant}`,
      })}
    >
      <Toolbar
        disableGutters
        sx={{
          height: 48,
          minHeight: "48px !important",
          px: 1.5,
          display: "flex",
          alignItems: "center",
          pt: "var(--safe-area-top)",
        }}
      >
        {/* Logo */}
        <Box
          display="flex"
          alignItems="center"
          role="button"
          tabIndex={0}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleDarkMode}
          sx={{ mr: 1.5, cursor: "pointer", flexShrink: 0 }}
        >
          <svg width="28" height="25" viewBox="0 0 28 25" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#mab_c0)">
              <g clipPath="url(#mab_c1)">
                <path
                  d="M15.3383 11.8074C16.6369 10.6491 17.3389 8.89423 17.3389 6.96374C17.3389 3.03266 14.531 0.294922 10.3542 0.294922H0V24.8643H10.5999C15.1628 24.8643 18.2164 21.951 18.2164 17.6339C18.2164 15.1769 17.1634 12.9657 15.3383 11.8074ZM4.56287 4.22602H9.79266C11.6178 4.22602 12.7059 5.3843 12.7059 7.20942C12.7059 9.03463 11.5827 10.1928 9.82771 10.1928H4.56287V4.22602ZM10.1085 20.9332H4.56287V14.124H10.1085C12.2144 14.124 13.5834 15.3876 13.5834 17.5286C13.5834 19.6697 12.2847 20.9332 10.1085 20.9332Z"
                  fill={darkMode ? "#000000" : "white"}
                />
                <path
                  d="M22.9832 0.212891C20.7551 0.212891 18.9482 2.0198 18.9482 4.24789C18.9482 6.47598 20.7551 8.28286 22.9832 8.28286C25.2113 8.28286 27.0182 6.47598 27.0182 4.24789C27.0182 2.0198 25.2127 0.212891 22.9832 0.212891ZM22.9832 6.18396C21.9134 6.18396 21.0471 5.31631 21.0471 4.24789C21.0471 3.17947 21.9148 2.31182 22.9832 2.31182C24.0516 2.31182 24.9192 3.17947 24.9192 4.24789C24.9192 5.31631 24.0516 6.18396 22.9832 6.18396Z"
                  fill={darkMode ? "#000000" : "white"}
                />
              </g>
            </g>
            <defs>
              <clipPath id="mab_c0">
                <rect width="27.3649" height="25" fill="white" />
              </clipPath>
              <clipPath id="mab_c1">
                <rect width="27.027" height="24.6597" fill="white" transform="translate(0 0.212891)" />
              </clipPath>
            </defs>
          </svg>
        </Box>

        {/* Active tab title */}
        <Typography
          variant="subtitle1"
          sx={{
            color: "white",
            fontWeight: 700,
            fontSize: "1rem",
            flexGrow: 1,
            letterSpacing: 0.3,
          }}
        >
          {TAB_LABELS[activeTab] ?? ""}
        </Typography>

        {/* Filter button with badge */}
        {dataReady && (
          <IconButton
            size="small"
            aria-label={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}`}
            onClick={onFilterOpen}
            sx={{ color: "white", mr: 0.5 }}
          >
            <Badge
              badgeContent={activeFilterCount}
              color="error"
              sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", minWidth: 16, height: 16 } }}
            >
              <FilterListIcon />
            </Badge>
          </IconButton>
        )}

        {/* Overflow menu */}
        {dataReady && (
          <IconButton
            size="small"
            aria-label="More options"
            onClick={(e) => onOverflowOpen(e.currentTarget)}
            sx={{ color: "white" }}
          >
            <MoreVertIcon />
          </IconButton>
        )}
      </Toolbar>
    </AppBar>
  )
);
MobileAppBar.displayName = "MobileAppBar";

export default MobileAppBar;
