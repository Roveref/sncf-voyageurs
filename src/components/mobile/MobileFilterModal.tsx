import { memo, useState } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Badge from "@mui/material/Badge";
import CloseIcon from "@mui/icons-material/Close";
import FilterListIcon from "@mui/icons-material/FilterList";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

import LeftSidebar from "../Sidebars/LeftSidebar";
import RightSidebar from "../Sidebars/RightSidebar";
import { useFilterStore, useActiveFilterCount } from "../../stores/useFilterStore";
import { brand } from "../../config/brandConfig";

interface MobileFilterModalProps {
  open: boolean;
  onClose: () => void;
  activeTab: number;
}

const MobileFilterModal = memo(({ open, onClose, activeTab }: MobileFilterModalProps) => {
  const [filterTab, setFilterTab] = useState(0);
  const activeFilterCount = useActiveFilterCount();
  const handleClearAllFilters = useFilterStore((s) => s.handleClearAllFilters);

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      swipeAreaWidth={0}
      PaperProps={{
        sx: {
          maxHeight: "70vh",
          borderRadius: "16px 16px 0 0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      {/* Drag handle */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          pt: 1.25,
          pb: 0.5,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 4,
            borderRadius: 2,
            bgcolor: "action.disabled",
          }}
        />
      </Box>

      {/* Header bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1.5,
          py: 0.75,
          backgroundColor: "#330000",
          flexShrink: 0,
        }}
      >
        <IconButton edge="start" size="small" onClick={onClose} aria-label="Fermer" sx={{ color: "white" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
        <FilterListIcon sx={{ ml: 1, mr: 1, fontSize: 20, color: "rgba(255,255,255,0.7)" }} />
        <Typography sx={{ flex: 1, fontWeight: 700, fontSize: "1rem", color: "white" }}>Filtres</Typography>
        <Badge badgeContent={activeFilterCount} color="error" sx={{ mr: 2 }}>
          <Box />
        </Badge>
        {activeFilterCount > 0 && (
          <Button
            size="small"
            startIcon={<DeleteSweepIcon />}
            onClick={handleClearAllFilters}
            sx={{ color: "white", fontSize: "0.75rem", textTransform: "none" }}
          >
            Tout effacer
          </Button>
        )}
      </Box>

      {/* Filter tabs */}
      <Tabs
        value={filterTab}
        onChange={(_, v) => setFilterTab(v)}
        variant="fullWidth"
        sx={{
          bgcolor: "#4a0000",
          flexShrink: 0,
          "& .MuiTab-root": {
            color: "rgba(255,255,255,0.6)",
            fontWeight: 600,
            fontSize: "0.8rem",
            minHeight: 40,
            "&.Mui-selected": { color: "white" },
          },
          "& .MuiTabs-indicator": { backgroundColor: brand.primary, height: 3 },
        }}
      >
        <Tab label="Patrimoines & Grades" />
        <Tab label="UnitÃ©s & Offres" />
      </Tabs>

      {/* Scrollable filter content */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          pb: "calc(64px + var(--safe-area-bottom))",
        }}
      >
        {filterTab === 0 && <LeftSidebar activeTab={activeTab} />}
        {filterTab === 1 && <RightSidebar />}
      </Box>

      {/* Sticky apply button */}
      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          bgcolor: "background.paper",
          borderTop: 1,
          borderColor: "divider",
          pb: "var(--safe-area-bottom)",
          flexShrink: 0,
        }}
      >
        <Button
          fullWidth
          variant="contained"
          onClick={onClose}
          sx={{
            m: 1.5,
            py: 1.2,
            borderRadius: 2,
            fontWeight: 700,
            fontSize: "0.9rem",
            textTransform: "none",
            bgcolor: "#330000",
            "&:hover": { bgcolor: "#4a0000" },
          }}
        >
          Appliquer les filtres {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
        </Button>
      </Box>
    </SwipeableDrawer>
  );
});

MobileFilterModal.displayName = "MobileFilterModal";
export default MobileFilterModal;
