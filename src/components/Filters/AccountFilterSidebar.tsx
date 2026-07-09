import React, { memo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import FilterListIcon from "@mui/icons-material/FilterList";
import { useTheme } from "@mui/material/styles";

interface AccountFilterSidebarProps {
  segments: string[];
  segmentCounts: Record<string, number>;
  selectedSegments: string[];
  onSegmentsChange: (value: string[]) => void;
  subSegments: string[];
  selectedSubSegments: string[];
  onSubSegmentsChange: (value: string[]) => void;
  countries: string[];
  selectedCountries: string[];
  onCountriesChange: (value: string[]) => void;
  onlyWithOpportunities: boolean;
  onOnlyWithOpportunitiesChange: (checked: boolean) => void;
  filteredWithOpportunitiesCount: number;
  parentAccountsOnly: boolean;
  onParentAccountsOnlyChange: (checked: boolean) => void;
  filteredParentAccountsCount: number;
  showAll: boolean;
  onShowAllChange: (checked: boolean) => void;
  filteredAccountsLength: number;
  tempSelectedAccountsCount: number;
  displayedAccountsCount: number;
  searchText: string;
  brandColor: string;
  checkboxUnchecked: string;
  accentBg: string;
  onClearAll: () => void;
}

const AccountFilterSidebar = ({
  segments,
  segmentCounts,
  selectedSegments,
  onSegmentsChange,
  subSegments,
  selectedSubSegments,
  onSubSegmentsChange,
  countries,
  selectedCountries,
  onCountriesChange,
  onlyWithOpportunities,
  onOnlyWithOpportunitiesChange,
  filteredWithOpportunitiesCount,
  parentAccountsOnly,
  onParentAccountsOnlyChange,
  filteredParentAccountsCount,
  showAll,
  onShowAllChange,
  filteredAccountsLength,
  tempSelectedAccountsCount,
  displayedAccountsCount,
  searchText,
  brandColor,
  checkboxUnchecked,
  accentBg,
  onClearAll,
}: AccountFilterSidebarProps) => {
  const theme = useTheme();

  const hasActiveFilters =
    selectedSegments.length > 0 || selectedSubSegments.length > 0 || selectedCountries.length > 0 || searchText;

  return (
    <Box
      sx={{
        width: "32%",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        backgroundColor: theme.palette.background.paper,
        borderRadius: 2,
        p: 3,
        overflowY: "auto",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <FilterListIcon sx={{ color: brandColor, fontSize: 20 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary", flex: 1 }}>
          Filters
        </Typography>
        {hasActiveFilters && (
          <Typography
            variant="caption"
            onClick={onClearAll}
            sx={{
              color: brandColor,
              fontWeight: 600,
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Tout effacer
          </Typography>
        )}
      </Box>

      <Autocomplete<string, true>
        multiple
        options={segments}
        value={selectedSegments}
        onChange={(_e, newValue) => onSegmentsChange(newValue)}
        getOptionLabel={(option: string) => `${option} (${segmentCounts[option] || 0})`}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option}
              label={option}
              size="small"
              sx={{ backgroundColor: accentBg, color: brandColor, fontWeight: 600, fontSize: "0.7rem" }}
            />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Patrimoines"
            placeholder={selectedSegments.length === 0 ? "Tous les patrimoines" : ""}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 1.5,
                "& fieldset": { border: "none" },
              },
            }}
          />
        )}
      />

      <Autocomplete<string, true>
        multiple
        options={subSegments}
        value={selectedSubSegments}
        onChange={(_e, newValue) => onSubSegmentsChange(newValue)}
        disabled={selectedSegments.length === 0 || subSegments.length === 0}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option}
              label={option}
              size="small"
              sx={{ backgroundColor: accentBg, color: brandColor, fontWeight: 600, fontSize: "0.7rem" }}
            />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Familles d'actifs"
            placeholder={selectedSubSegments.length === 0 ? "Toutes les familles" : ""}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 1.5,
                "& fieldset": { border: "none" },
              },
            }}
          />
        )}
      />

      <Autocomplete<string, true>
        multiple
        options={countries}
        value={selectedCountries}
        onChange={(_e, newValue) => onCountriesChange(newValue)}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option}
              label={option}
              size="small"
              sx={{ backgroundColor: accentBg, color: brandColor, fontWeight: 600, fontSize: "0.7rem" }}
            />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Countries"
            placeholder={selectedCountries.length === 0 ? "All countries" : ""}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 1.5,
                "& fieldset": { border: "none" },
              },
            }}
          />
        )}
      />

      {/* Only with opportunities checkbox */}
      <FormControlLabel
        control={
          <Checkbox
            checked={onlyWithOpportunities}
            onChange={(e) => onOnlyWithOpportunitiesChange(e.target.checked)}
            sx={{
              color: checkboxUnchecked,
              "&.Mui-checked": {
                color: brandColor,
              },
            }}
          />
        }
        label={
          <Typography variant="body2" sx={{ fontWeight: 500, color: "text.secondary" }}>
            Only with opportunities ({filteredWithOpportunitiesCount})
          </Typography>
        }
      />

      {/* Parent accounts only checkbox */}
      <FormControlLabel
        control={
          <Checkbox
            checked={parentAccountsOnly}
            onChange={(e) => onParentAccountsOnlyChange(e.target.checked)}
            sx={{
              color: checkboxUnchecked,
              "&.Mui-checked": {
                color: brandColor,
              },
            }}
          />
        }
        label={
          <Typography variant="body2" sx={{ fontWeight: 500, color: "text.secondary" }}>
            Parent accounts only ({filteredParentAccountsCount})
          </Typography>
        }
      />

      {/* Show all accounts checkbox */}
      <FormControlLabel
        control={
          <Checkbox
            checked={showAll}
            onChange={(e) => onShowAllChange(e.target.checked)}
            sx={{
              color: checkboxUnchecked,
              "&.Mui-checked": {
                color: brandColor,
              },
            }}
          />
        }
        label={
          <Typography variant="body2" sx={{ fontWeight: 500, color: "text.secondary" }}>
            Show all ({filteredAccountsLength})
          </Typography>
        }
      />

      <Divider sx={{ my: 1 }} />

      {/* Selection Info */}
      <Box
        sx={{
          backgroundColor: accentBg,
          borderRadius: 2,
          p: 2,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, color: brandColor, mb: 1 }}>
          Selection Summary
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          <strong>{tempSelectedAccountsCount}</strong> account(s) selected
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>{displayedAccountsCount}</strong> of <strong>{filteredAccountsLength}</strong> shown
        </Typography>
      </Box>
    </Box>
  );
};

AccountFilterSidebar.displayName = "AccountFilterSidebar";

export default memo(AccountFilterSidebar);
