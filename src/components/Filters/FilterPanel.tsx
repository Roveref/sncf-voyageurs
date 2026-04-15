import React, { useEffect, useState, useMemo, memo } from "react";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import InputAdornment from "@mui/material/InputAdornment";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";

import { getUniqueValues } from "../../utils/dataUtils";
import { easing } from "../../styles/animations";
import { getIncludedValues } from "../../utils/filterHelpers";
import AccountFilterModal from "./AccountFilterModal";
import TechnologyPartnerFilterModal from "./TechnologyPartnerFilterModal";
import PeopleFilterModal from "./PeopleFilterModal";

// Function to get all unique technology partners from the three columns
const getTechnologyPartners = (data: Record<string, any>[]) => {
  const partners = new Set();

  data.forEach((item: Record<string, any>) => {
    // Check all three technology partner columns
    [item.techPartner1, item.techPartner2, item.techPartner3].forEach((partner) => {
      if (partner && partner !== "-" && partner.trim() !== "") {
        partners.add(partner.trim());
      }
    });
  });

  return Array.from(partners).sort();
};

// Function to get all unique people from Manager, Partner, EM (Engagement Manager), EP (Engagement Partner)
const getAllPeople = (data: Record<string, any>[]) => {
  const people = new Set();

  data.forEach((item: Record<string, any>) => {
    // Check all four people columns: Manager, Partner, EM, EP
    [item.manager, item.partner, item.em, item.ep].forEach((person) => {
      if (person && person !== "-") {
        const normalized = String(person).trim();
        if (normalized !== "" && normalized !== "-") {
          people.add(normalized);
        }
      }
    });
  });

  return Array.from(people).sort();
};

const FilterPanel = ({
  data,
  filters,
  onFilterChange,
  showNetRevenue,
  crmAccounts = [],
  manualAccounts = [],
  searchText = "",
  onSearchTextChange,
}: {
  data: any[];
  filters: any;
  onFilterChange: any;
  showNetRevenue: boolean;
  crmAccounts?: any[];
  manualAccounts?: any[];
  searchText?: string;
  onSearchTextChange?: (value: string) => void;
}) => {
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [techPartnerModalOpen, setTechPartnerModalOpen] = useState(false);
  const [peopleModalOpen, setPeopleModalOpen] = useState(false);

  // Cache CRM account names (stable, only changes on file upload)
  const crmAccountNames = useMemo(() => crmAccounts.map((a) => a.account), [crmAccounts]);

  // Heavy computations that only depend on opportunity data (stable unless file re-uploaded)
  const technologyPartners = useMemo(() => (data.length > 0 ? getTechnologyPartners(data) : []), [data]);
  const people = useMemo(() => (data.length > 0 ? getAllPeople(data) : []), [data]);
  const opportunityAccounts = useMemo(() => (data.length > 0 ? getUniqueValues(data, "account") : []), [data]);

  // Account list: combines opportunity + CRM (stable) + manual (small, changes)
  const allAccounts = useMemo(() => {
    const manualAccountNames = manualAccounts.map((a) => a.account);
    return [...new Set([...opportunityAccounts, ...crmAccountNames, ...manualAccountNames])].sort();
  }, [opportunityAccounts, crmAccountNames, manualAccounts]);

  // Combine into filterOptions
  const filterOptions = useMemo(
    () => ({
      accounts: allAccounts,
      technologyPartners,
      people,
    }),
    [allAccounts, technologyPartners, people]
  );

  const handleAccountChange = (newValue: string[]) => {
    onFilterChange({ accounts: newValue || [] });
  };

  const handleAccountModalApply = (selectedAccounts: string[]) => {
    handleAccountChange(selectedAccounts);
  };

  const handleRemoveAccount = (accountToRemove: string) => {
    const currentAccounts = getIncludedValues(filters.accounts);
    handleAccountChange(currentAccounts.filter((account) => account !== accountToRemove));
  };

  const handleTechnologyPartnerChange = (newValue: string[]) => {
    onFilterChange({ technologyPartners: newValue || [] });
  };

  const handleTechPartnerModalApply = (selectedPartners: string[]) => {
    handleTechnologyPartnerChange(selectedPartners);
  };

  const handleRemoveTechPartner = (partnerToRemove: string) => {
    const currentPartners = getIncludedValues(filters.technologyPartners);
    handleTechnologyPartnerChange(currentPartners.filter((partner) => partner !== partnerToRemove));
  };

  // Handler for People filter (unified: Manager, Partner, Engagement Manager, Engagement Partner)
  const handlePeopleChange = (newValue: string[]) => {
    onFilterChange({ people: newValue || [] });
  };

  const handlePeopleModalApply = (selectedPeople: string[]) => {
    handlePeopleChange(selectedPeople);
  };

  const handleRemovePerson = (personToRemove: string) => {
    const currentPeople = getIncludedValues(filters.people);
    handlePeopleChange(currentPeople.filter((person) => person !== personToRemove));
  };

  const handleClearFilters = () => {
    onFilterChange({
      accounts: [],
      technologyPartners: [],
      people: [],
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.accounts && filters.accounts.length > 0) count++;
    if (filters.technologyPartners && filters.technologyPartners.length > 0) count++;
    if (filters.people && filters.people.length > 0) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: "background.paper",
        borderRadius: 3,
        px: 2,
        height: 72,
      }}
    >
      {/* Filter Icon */}
      <FilterListIcon color="primary" />

      {/* Search Field */}
      {onSearchTextChange && (
        <TextField
          size="small"
          placeholder="Search..."
          value={searchText}
          onChange={(e) => onSearchTextChange(e.target.value)}
          inputProps={{ "aria-label": "Search" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            flex: 1,
            minWidth: 0,
            "& .MuiInput-underline:before": { display: "none" },
            "& .MuiInput-underline:after": { display: "none" },
            "& .MuiOutlinedInput-notchedOutline": { border: "none" },
            "& .MuiInputBase-root": {
              height: 40,
              bgcolor: searchText ? "rgba(255, 61, 71, 0.08)" : "action.hover",
              borderRadius: 1,
              px: 1,
              fontSize: "0.875rem",
            },
            "& .MuiInputBase-input": {
              py: 0,
              "&::placeholder": { fontSize: "0.875rem" },
            },
          }}
        />
      )}

      {/* Account Filter - Click to open modal */}
      <Box sx={{ flex: 1 }}>
        <TextField
          fullWidth
          size="small"
          variant="standard"
          onClick={() => setAccountModalOpen(true)}
          value=""
          placeholder={getIncludedValues(filters.accounts).length > 0 ? "" : "Accounts"}
          inputProps={{ "aria-label": "Filter by account" }}
          InputProps={{
            readOnly: true,
            startAdornment: getIncludedValues(filters.accounts).length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                {getIncludedValues(filters.accounts).map((account) => (
                  <Chip
                    key={account}
                    label={account}
                    size="small"
                    onDelete={(e) => {
                      e.stopPropagation();
                      handleRemoveAccount(account);
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    draggable="true"
                    onDragStart={(e) => {
                      e.dataTransfer.setData("account", account);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    sx={{
                      cursor: "grab",
                      "&:active": {
                        cursor: "grabbing",
                      },
                    }}
                  />
                ))}
              </Box>
            ),
          }}
          sx={{
            cursor: "pointer",
            "& .MuiInput-underline:before": { display: "none" },
            "& .MuiInput-underline:after": { display: "none" },
            "& .MuiInputBase-root": {
              height: 40,
              alignItems: "center",
              cursor: "pointer",
              bgcolor: "action.hover",
              borderRadius: 1,
              px: 1.5,
              fontSize: "0.875rem",
            },
            "& .MuiInputBase-input": {
              cursor: "pointer",
              py: 0,
              "&::placeholder": { fontSize: "0.875rem" },
            },
          }}
        />
      </Box>

      {/* Account Filter Modal */}
      <AccountFilterModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        data={data}
        selectedAccounts={getIncludedValues(filters.accounts)}
        onApply={handleAccountModalApply}
        showNetRevenue={showNetRevenue}
        crmAccounts={crmAccounts}
        manualAccounts={manualAccounts}
      />

      {/* Technology Partners Filter - Click to open modal */}
      <Box sx={{ flex: 1 }}>
        <TextField
          fullWidth
          size="small"
          variant="standard"
          onClick={() => setTechPartnerModalOpen(true)}
          value=""
          placeholder={getIncludedValues(filters.technologyPartners).length > 0 ? "" : "Technology Partners"}
          inputProps={{ "aria-label": "Filter by technology partner" }}
          InputProps={{
            readOnly: true,
            startAdornment: getIncludedValues(filters.technologyPartners).length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                {getIncludedValues(filters.technologyPartners).map((partner) => (
                  <Chip
                    key={partner}
                    label={partner}
                    size="small"
                    onDelete={(e) => {
                      e.stopPropagation();
                      handleRemoveTechPartner(partner);
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    draggable="true"
                    onDragStart={(e) => {
                      e.dataTransfer.setData("technologyPartner", partner);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    sx={{
                      cursor: "grab",
                      "&:active": {
                        cursor: "grabbing",
                      },
                    }}
                  />
                ))}
              </Box>
            ),
          }}
          sx={{
            cursor: "pointer",
            "& .MuiInput-underline:before": { display: "none" },
            "& .MuiInput-underline:after": { display: "none" },
            "& .MuiInputBase-root": {
              height: 40,
              alignItems: "center",
              cursor: "pointer",
              bgcolor: "action.hover",
              borderRadius: 1,
              px: 1.5,
              fontSize: "0.875rem",
            },
            "& .MuiInputBase-input": {
              cursor: "pointer",
              py: 0,
              "&::placeholder": { fontSize: "0.875rem" },
            },
          }}
        />
      </Box>

      {/* Technology Partner Filter Modal */}
      <TechnologyPartnerFilterModal
        open={techPartnerModalOpen}
        onClose={() => setTechPartnerModalOpen(false)}
        data={data}
        selectedPartners={getIncludedValues(filters.technologyPartners)}
        onApply={handleTechPartnerModalApply}
        showNetRevenue={showNetRevenue}
      />

      {/* People Filter - Click to open modal */}
      <Box sx={{ flex: 1 }}>
        <TextField
          fullWidth
          size="small"
          variant="standard"
          onClick={() => setPeopleModalOpen(true)}
          value=""
          placeholder={getIncludedValues(filters.people).length > 0 ? "" : "People"}
          inputProps={{ "aria-label": "Filter by person" }}
          InputProps={{
            readOnly: true,
            startAdornment: getIncludedValues(filters.people).length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                {getIncludedValues(filters.people).map((person) => (
                  <Chip
                    key={person}
                    label={person}
                    size="small"
                    onDelete={(e) => {
                      e.stopPropagation();
                      handleRemovePerson(person);
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    draggable="true"
                    onDragStart={(e) => {
                      e.dataTransfer.setData("person", person);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    sx={{
                      cursor: "grab",
                      "&:active": {
                        cursor: "grabbing",
                      },
                    }}
                  />
                ))}
              </Box>
            ),
          }}
          sx={{
            cursor: "pointer",
            "& .MuiInput-underline:before": { display: "none" },
            "& .MuiInput-underline:after": { display: "none" },
            "& .MuiInputBase-root": {
              height: 40,
              alignItems: "center",
              cursor: "pointer",
              bgcolor: "action.hover",
              borderRadius: 1,
              px: 1.5,
              fontSize: "0.875rem",
            },
            "& .MuiInputBase-input": {
              cursor: "pointer",
              py: 0,
              "&::placeholder": { fontSize: "0.875rem" },
            },
          }}
        />
      </Box>

      {/* People Filter Modal */}
      <PeopleFilterModal
        open={peopleModalOpen}
        onClose={() => setPeopleModalOpen(false)}
        data={data}
        selectedPeople={getIncludedValues(filters.people)}
        onApply={handlePeopleModalApply}
        showNetRevenue={showNetRevenue}
      />

      {/* Clear All Button */}
      {activeFilterCount > 0 && (
        <Box sx={{ pt: 1 }}>
          <Button
            variant="text"
            color="secondary"
            size="small"
            startIcon={<ClearIcon />}
            onClick={handleClearFilters}
            TouchRippleProps={{
              style: {
                animationDuration: "400ms",
              },
            }}
            sx={{
              ml: "auto",
              transition: `transform 0.2s ${easing.bounce}`,
              "&:hover": {
                transform: "scale(1.05)",
                "& .MuiButton-startIcon": {
                  transform: "scale(1.1) rotate(5deg)",
                  transition: `transform 0.2s ${easing.bounce}`,
                },
              },
              "&:active": {
                transform: "scale(0.98)",
              },
            }}
          >
            Clear all
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default memo(FilterPanel);
