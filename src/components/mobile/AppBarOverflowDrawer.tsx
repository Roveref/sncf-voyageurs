import { memo } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Switch from "@mui/material/Switch";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import BusinessIcon from "@mui/icons-material/Business";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import { brand } from "../../config/brandConfig";

interface AppBarOverflowDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  // I&O toggle
  showIO: string;
  toggleIO: () => void;
  // Lost toggle (bookings only)
  showLost: boolean;
  toggleLost: () => void;
  isBookingsTab: boolean;
  // Revenue toggle
  showNetRevenue: boolean;
  toggleNetRevenue: () => void;
}

const AppBarOverflowDrawer = memo(
  ({
    open,
    onClose,
    onOpen,
    showIO,
    toggleIO,
    showLost,
    toggleLost,
    isBookingsTab,
    showNetRevenue,
    toggleNetRevenue,
  }: AppBarOverflowDrawerProps) => {
    const ioLabel =
      {
        off: "GAIF masqué",
        show: "Afficher GAIF",
        ioOnly: "GAIF uniquement",
        ioTeam: "Équipe GAIF",
        ioLead: "Responsable GAIF",
      }[showIO] ?? "GAIF";

    return (
      <SwipeableDrawer
        anchor="right"
        open={open}
        onClose={onClose}
        onOpen={onOpen}
        disableSwipeToOpen
        sx={{
          "& .MuiDrawer-paper": {
            width: 280,
            pt: "var(--safe-area-top)",
            bgcolor: "#330000",
          },
        }}
      >
        <Box sx={{ pt: 2, px: 2, pb: 1 }}>
          <Typography
            variant="subtitle2"
            sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 1 }}
          >
            Display options
          </Typography>
        </Box>
        <List sx={{ px: 1 }}>
          {/* I&O toggle */}
          <ListItem
            onClick={toggleIO}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              minHeight: 48,
              cursor: "pointer",
              "&:active": { bgcolor: "rgba(255,255,255,0.1)" },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: "white" }}>
              <BusinessIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={ioLabel}
              primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 500, color: "white" }}
            />
            <Switch
              edge="end"
              checked={showIO !== "off"}
              onChange={toggleIO}
              size="small"
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: brand.primaryDark },
                "& .MuiSwitch-track": { backgroundColor: "rgba(255,255,255,0.3)" },
              }}
            />
          </ListItem>

          {/* Lost toggle — only on Bookings tab */}
          {isBookingsTab && (
            <ListItem
              onClick={toggleLost}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                minHeight: 48,
                cursor: "pointer",
                "&:active": { bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: "white" }}>
                {showLost ? <CancelOutlinedIcon fontSize="small" /> : <CheckCircleOutlineIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText
                primary={showLost ? "Déclassés" : "Maintenance"}
                primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 500, color: "white" }}
              />
              <Switch
                edge="end"
                checked={showLost}
                onChange={toggleLost}
                size="small"
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: brand.primaryDark },
                  "& .MuiSwitch-track": { backgroundColor: "rgba(255,255,255,0.3)" },
                }}
              />
            </ListItem>
          )}

          <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", my: 1 }} />

          {/* Revenue toggle */}
          <ListItem
            onClick={toggleNetRevenue}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              minHeight: 48,
              cursor: "pointer",
              "&:active": { bgcolor: "rgba(255,255,255,0.1)" },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: "white" }}>
              <MonetizationOnIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={showNetRevenue ? "Coût maintenance" : "Coût total"}
              primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 500, color: "white" }}
            />
            <Switch
              edge="end"
              checked={showNetRevenue}
              onChange={toggleNetRevenue}
              size="small"
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: brand.primaryDark },
                "& .MuiSwitch-track": { backgroundColor: "rgba(255,255,255,0.3)" },
              }}
            />
          </ListItem>
        </List>
      </SwipeableDrawer>
    );
  }
);
AppBarOverflowDrawer.displayName = "AppBarOverflowDrawer";

export default AppBarOverflowDrawer;
