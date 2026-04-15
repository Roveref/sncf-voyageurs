import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import MobileOpportunityCard from "./components/MobileOpportunityCard";

import { useOpportunityFilters, useOpportunitySorting } from "./hooks";

interface MobileOpportunityListProps {
  data: any[];
  title?: string;
  showNetRevenue?: boolean;
  showIO?: boolean;
  setEditOpportunity?: any;
  onManualOpportunityUpdated?: any;
  hideWinFilter?: boolean;
  hideStatusFilter?: boolean;
  excludeStatuses?: any[];
}

const MobileOpportunityList = memo(
  ({
    data,
    title,
    showNetRevenue = false,
    showIO = true,
    setEditOpportunity,
    onManualOpportunityUpdated,
    hideWinFilter = false,
    hideStatusFilter = false,
    excludeStatuses = [],
  }: MobileOpportunityListProps) => {
    const opportunitiesData = Array.isArray(data) ? data : [];

    const { searchText, filteredData, setSearchText } = useOpportunityFilters(opportunitiesData);

    const { sortedData } = useOpportunitySorting(filteredData, showNetRevenue);

    const displayData = useMemo(() => sortedData.slice(0, 100), [sortedData]);

    return (
      <Box sx={{ width: "100%" }}>
        {/* Title + count */}
        {title && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1, mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {sortedData.length} result{sortedData.length !== 1 ? "s" : ""}
            </Typography>
          </Box>
        )}

        {/* Search */}
        <Box sx={{ px: 0.5, mb: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search opportunities..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                  </InputAdornment>
                ),
                sx: { borderRadius: 2, height: 40 },
              },
            }}
          />
        </Box>

        {/* Cards */}
        {displayData.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
            No opportunities found
          </Typography>
        ) : (
          displayData.map((row: any, i: number) => (
            <MobileOpportunityCard
              key={row.opportunityId || i}
              row={row}
              showNetRevenue={showNetRevenue}
              showIO={showIO}
              setEditOpportunity={setEditOpportunity}
              onManualOpportunityUpdated={onManualOpportunityUpdated}
            />
          ))
        )}

        {sortedData.length > 100 && (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", display: "block", py: 2 }}>
            Showing 100 of {sortedData.length} results
          </Typography>
        )}
      </Box>
    );
  }
);
MobileOpportunityList.displayName = "MobileOpportunityList";

export default MobileOpportunityList;
