/**
 * FloatingActions — FAB stack and staffing needs button.
 * Extracted from App.tsx to reduce its size.
 */

import { memo } from "react";
import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import Chip from "@mui/material/Chip";
import Fade from "@mui/material/Fade";
import Badge from "@mui/material/Badge";
import AddIcon from "@mui/icons-material/Add";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import BusinessIcon from "@mui/icons-material/Business";
import GroupIcon from "@mui/icons-material/Group";
import GroupsIcon from "@mui/icons-material/Groups";
import { useUIStore } from "../../stores/useUIStore";
import { brand } from "../../config/brandConfig";

interface FloatingActionsProps {
  isPhone: boolean;
  totalStaffingNeedsCount: number;
}

const FloatingActions = memo(({ isPhone, totalStaffingNeedsCount }: FloatingActionsProps) => {
  const fabOpen = useUIStore((s) => s.fabOpen);
  const setFabOpen = useUIStore((s) => s.setFabOpen);
  const setCreateModalOpen = useUIStore((s) => s.setCreateModalOpen);
  const setCreateAccountModalOpen = useUIStore((s) => s.setCreateAccountModalOpen);
  const setCreateStaffingNeedModalOpen = useUIStore((s) => s.setCreateStaffingNeedModalOpen);
  const staffingNeedsDrawerOpen = useUIStore((s) => s.staffingNeedsDrawerOpen);
  const setStaffingNeedsDrawerOpen = useUIStore((s) => s.setStaffingNeedsDrawerOpen);

  return (
    <>
      {/* Backdrop overlay */}
      {fabOpen && (
        <Box
          onClick={() => setFabOpen(false)}
          sx={{ position: "fixed", inset: 0, zIndex: 9998, bgcolor: "rgba(0,0,0,0.25)", transition: "opacity 0.3s" }}
        />
      )}

      {/* Stack items — fan out above the FAB */}
      <Box
        sx={{
          position: "fixed",
          bottom: isPhone ? 152 : 100,
          left: isPhone ? "auto" : 32,
          right: isPhone ? 16 : "auto",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column-reverse",
          gap: 2.5,
          alignItems: "flex-start",
          opacity: fabOpen ? 1 : 0,
          transform: fabOpen ? "translateY(0)" : "translateY(20px)",
          pointerEvents: fabOpen ? "auto" : "none",
          transition:
            "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {[
          {
            label: "Staffing Need",
            icon: <GroupIcon sx={{ fontSize: 18 }} />,
            color: "warning" as const,
            onClick: () => {
              setFabOpen(false);
              setCreateStaffingNeedModalOpen(true);
            },
          },
          {
            label: "Account",
            icon: <BusinessIcon sx={{ fontSize: 18 }} />,
            color: "secondary" as const,
            onClick: () => {
              setFabOpen(false);
              setCreateAccountModalOpen(true);
            },
          },
          {
            label: "Opportunity",
            icon: <MonetizationOnIcon sx={{ fontSize: 18 }} />,
            color: "primary" as const,
            onClick: () => {
              setFabOpen(false);
              setCreateModalOpen(true);
            },
          },
        ].map((item, i) => (
          <Fade in={fabOpen} key={item.label} style={{ transitionDelay: fabOpen ? `${i * 60}ms` : "0ms" }}>
            <Box
              onClick={item.onClick}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                cursor: "pointer",
                "&:hover .fab-stack-label": { bgcolor: "grey.800" },
                "&:hover .fab-stack-icon": { transform: "scale(1.08)" },
              }}
            >
              <Chip
                label={item.label}
                className="fab-stack-label"
                sx={{
                  bgcolor: "grey.700",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  height: 32,
                  transition: "transform 0.2s, background-color 0.2s, opacity 0.2s",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              />
              <Fab
                size="small"
                color={item.color}
                aria-label={item.label}
                className="fab-stack-icon"
                sx={{
                  boxShadow: 3,
                  transition: "transform 0.2s",
                  width: isPhone ? 48 : 36,
                  height: isPhone ? 48 : 36,
                  minHeight: isPhone ? 48 : 36,
                }}
              >
                {item.icon}
              </Fab>
            </Box>
          </Fade>
        ))}
      </Box>

      {/* Bottom-left FAB row: Create + Staffing */}
      <Box
        sx={{
          position: "fixed",
          bottom: isPhone ? 80 : 32,
          left: isPhone ? "auto" : 32,
          right: isPhone ? 16 : "auto",
          zIndex: 9999,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        {/* Create FAB */}
        <Fab
          color="primary"
          aria-label="create"
          size="medium"
          data-onboarding="fab"
          onClick={() => setFabOpen(!fabOpen)}
          sx={{
            transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease",
            boxShadow: "0 6px 12px rgba(255, 61, 71, 0.3)",
            "&:hover": {
              transform: fabOpen ? "rotate(45deg) scale(1.08)" : "scale(1.08)",
              boxShadow: "0 8px 16px rgba(255, 61, 71, 0.4)",
            },
          }}
        >
          <AddIcon />
        </Fab>

        {/* Staffing Needs Overview */}
        {totalStaffingNeedsCount > 0 && (
          <Fab
            size="medium"
            aria-label="staffing needs"
            onClick={() => setStaffingNeedsDrawerOpen(!staffingNeedsDrawerOpen)}
            sx={{
              bgcolor: "#D97757",
              color: "#fff",
              boxShadow: "0 6px 12px rgba(217, 119, 87, 0.3)",
              transition: "transform 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease",
              "&:hover": {
                bgcolor: "#C4673F",
                transform: "scale(1.08)",
                boxShadow: "0 8px 16px rgba(217, 119, 87, 0.4)",
              },
            }}
          >
            <Badge
              badgeContent={totalStaffingNeedsCount}
              color="error"
              max={99}
              sx={{
                "& .MuiBadge-badge": { fontSize: "0.65rem", height: 16, minWidth: 16, top: -4, right: -4 },
              }}
            >
              <GroupsIcon sx={{ fontSize: 22 }} />
            </Badge>
          </Fab>
        )}
      </Box>
    </>
  );
});

FloatingActions.displayName = "FloatingActions";
export default FloatingActions;
