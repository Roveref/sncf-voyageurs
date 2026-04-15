import React, { useEffect, useState, useMemo } from "react";
import { Paper, Box, Chip, Button, Typography, TextField, Autocomplete, InputAdornment } from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

import { getUniqueValues } from "../utils/dataUtils";
import { easing } from "../styles/animations";
import { getIncludedValues } from "../utils/filterHelpers";
import AccountFilterModal from "./AccountFilterModal";
import TechnologyPartnerFilterModal from "./TechnologyPartnerFilterModal";
import PeopleFilterModal from "./PeopleFilterModal";

// Function to get all unique technology partners from the three columns
const getTechnologyPartners = (data) => {
  const partners = new Set();

  data.forEach((item) => {
    // Check all three technology partner columns
    [item["Technology Partner 1"], item["Technology Partner 2"], item["Technology Partner 3"]].forEach((partner) => {
      if (partner && partner !== "-" && partner.trim() !== "") {
        partners.add(partner.trim());
      }
    });
  });

  return Array.from(partners).sort();
};

// Function to get all unique people from Manager, Partner, EM (Engagement Manager), EP (Engagement Partner)
const getAllPeople = (data) => {
  const people = new Set();

  data.forEach((item) => {
    // Check all four people columns: Manager, Partner, EM, EP
    [item["Manager"], item["Partner"], item["EM"], item["EP"]].forEach((person) => {
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

const FilterPanel = ({ data, filters, onFilterChange, showNetRevenue, crmAccounts = [], manualAccounts = [] }) => {
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [techPartnerModalOpen, setTechPartnerModalOpen] = useState(false);
  const [peopleModalOpen, setPeopleModalOpen] = useState(false);

  // Cache CRM account names (stable, only changes on file upload)
  const crmAccountNames = useMemo(() => crmAccounts.map((a) => a.Account), [crmAccounts]);

  // Heavy computations that only depend on opportunity data (stable unless file re-uploaded)
  const technologyPartners = useMemo(() => (data.length > 0 ? getTechnologyPartners(data) : []), [data]);
  const people = useMemo(() => (data.length > 0 ? getAllPeople(data) : []), [data]);
  const opportunityAccounts = useMemo(() => (data.length > 0 ? getUniqueValues(data, "Account") : []), [data]);

  // Account list: combines opportunity + CRM (stable) + manual (small, changes)
  const allAccounts = useMemo(() => {
    const manualAccountNames = manualAccounts.map((a) => a.Account);
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

  const handleAccountChange = (newValue) => {
    onFilterChange({ accounts: newValue || [] });
  };

  const handleAccountModalApply = (selectedAccounts) => {
    handleAccountChange(selectedAccounts);
  };

  const handleRemoveAccount = (accountToRemove) => {
    const currentAccounts = getIncludedValues(filters.accounts);
    handleAccountChange(currentAccounts.filter((account) => account !== accountToRemove));
  };

  const handleTechnologyPartnerChange = (newValue) => {
    onFilterChange({ technologyPartners: newValue || [] });
  };

  const handleTechPartnerModalApply = (selectedPartners) => {
    handleTechnologyPartnerChange(selectedPartners);
  };

  const handleRemoveTechPartner = (partnerToRemove) => {
    const currentPartners = getIncludedValues(filters.technologyPartners);
    handleTechnologyPartnerChange(currentPartners.filter((partner) => partner !== partnerToRemove));
  };

  // Handler for People filter (unified: Manager, Partner, Engagement Manager, Engagement Partner)
  const handlePeopleChange = (newValue) => {
    onFilterChange({ people: newValue || [] });
  };

  const handlePeopleModalApply = (selectedPeople) => {
    handlePeopleChange(selectedPeople);
  };

  const handleRemovePerson = (personToRemove) => {
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
        alignItems: "flex-start",
        gap: 2,
        bgcolor: "background.paper",
        borderRadius: 2,
        p: 2,
      }}
    >
      {/* Filter Icon */}
      <Box sx={{ pt: 1 }}>
        <FilterListIcon color="primary" />
      </Box>

      {/* Account Filter - Click to open modal */}
      <Box sx={{ flex: 1 }}>
        <TextField
          fullWidth
          size="small"
          label="Accounts"
          variant="outlined"
          onClick={() => setAccountModalOpen(true)}
          value=""
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
            endAdornment: (
              <InputAdornment position="end" sx={{ position: "absolute", right: 8 }}>
                <ArrowDropDownIcon />
              </InputAdornment>
            ),
          }}
          sx={{
            cursor: "pointer",
            "& .MuiInputBase-root": {
              minHeight: 48,
              alignItems: "center",
              cursor: "pointer",
              position: "relative",
              paddingRight: "40px",
            },
            "& .MuiInputBase-input": {
              cursor: "pointer",
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
          label="Technology Partners"
          variant="outlined"
          onClick={() => setTechPartnerModalOpen(true)}
          value=""
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
            endAdornment: (
              <InputAdornment position="end" sx={{ position: "absolute", right: 8 }}>
                <ArrowDropDownIcon />
              </InputAdornment>
            ),
          }}
          sx={{
            cursor: "pointer",
            "& .MuiInputBase-root": {
              minHeight: 48,
              alignItems: "center",
              cursor: "pointer",
              position: "relative",
              paddingRight: "40px",
            },
            "& .MuiInputBase-input": {
              cursor: "pointer",
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
          label="People"
          variant="outlined"
          onClick={() => setPeopleModalOpen(true)}
          value=""
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
            endAdornment: (
              <InputAdornment position="end" sx={{ position: "absolute", right: 8 }}>
                <ArrowDropDownIcon />
              </InputAdornment>
            ),
          }}
          sx={{
            cursor: "pointer",
            "& .MuiInputBase-root": {
              minHeight: 48,
              alignItems: "center",
              cursor: "pointer",
              position: "relative",
              paddingRight: "40px",
            },
            "& .MuiInputBase-input": {
              cursor: "pointer",
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
            color="primary"
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
              transition: `all 0.2s ${easing.bounce}`,
              "&:hover": {
                transform: "scale(1.05)",
                "& .MuiButton-startIcon": {
                  transform: "scale(1.1) rotate(5deg)",
                  transition: `all 0.2s ${easing.bounce}`,
                },
              },
              "&:active": {
                transform: "scale(0.98)",
              },
            }}
          >
            Effacer tout
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default FilterPanel;
