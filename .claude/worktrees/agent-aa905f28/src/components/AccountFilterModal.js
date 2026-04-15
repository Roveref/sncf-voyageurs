import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
  Autocomplete,
  IconButton,
  Divider,
  Alert,
  Chip,
  useTheme,
  alpha,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

/**
 * AccountFilterModal Component
 *
 * A powerful account filter with:
 * - Search input at the top
 * - Left section: Segment and Sub-segment filters
 * - Right section: Accounts list with their segments
 * - Multi-select functionality
 */
const AccountFilterModal = ({
  open,
  onClose,
  data,
  selectedAccounts,
  onApply,
  showNetRevenue,
  crmAccounts = [],
  manualAccounts = [],
}) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const [searchText, setSearchText] = useState("");
  const [selectedSegments, setSelectedSegments] = useState([]);
  const [selectedSubSegments, setSelectedSubSegments] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [tempSelectedAccounts, setTempSelectedAccounts] = useState([]);
  const [onlyWithOpportunities, setOnlyWithOpportunities] = useState(true);
  const [parentAccountsOnly, setParentAccountsOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Initialize temp selection when dialog opens
  useEffect(() => {
    if (open) {
      setTempSelectedAccounts([...selectedAccounts]);
    }
  }, [open, selectedAccounts]);

  // Build opportunity count per account
  const oppCountMap = useMemo(() => {
    const map = new Map();
    data.forEach((item) => {
      const account = item["Account"];
      if (account) {
        map.set(account, (map.get(account) || 0) + 1);
      }
    });
    return map;
  }, [data]);

  // Build set of accounts that have opportunities
  const opportunityAccountSet = useMemo(() => {
    return new Set(oppCountMap.keys());
  }, [oppCountMap]);

  // Build set of parent accounts (from _be_reportingparent column) - stable, only changes on file upload
  const parentAccountSet = useMemo(() => {
    const set = new Set();
    crmAccounts.forEach((crm) => {
      const parent = crm["Parent Account"];
      if (parent && parent.trim()) set.add(parent.trim());
    });
    return set;
  }, [crmAccounts]);

  // Build set of manual account names - small array, fast
  const manualAccountSet = useMemo(() => {
    return new Set(manualAccounts.map((a) => a.Account));
  }, [manualAccounts]);

  // Base account data from CRM (65k, stable) + opportunity data - only recalculates on file upload
  const baseAccountData = useMemo(() => {
    const accountMap = new Map();

    crmAccounts.forEach((crm) => {
      const account = crm["Account"];
      if (account && !accountMap.has(account)) {
        accountMap.set(account, {
          account,
          segmentCode: crm["Sub Segment Code"] || "",
          subSegment: crm["Sub Segment"] || "",
          country: crm["Country"] || "",
          isManual: false,
        });
      }
    });

    data.forEach((item) => {
      const account = item["Account"];
      const segmentCode = item["Sub Segment Code"];
      const subSegment = item["Sub Segment"];
      if (account && segmentCode && !accountMap.has(account)) {
        accountMap.set(account, {
          account,
          segmentCode,
          subSegment: subSegment || "",
          country: item["Country"] || "",
          isManual: false,
        });
      }
    });

    return accountMap;
  }, [data, crmAccounts]);

  // Sorted base - stable, only recalculates on file upload
  const sortedBaseAccounts = useMemo(() => {
    return Array.from(baseAccountData.values()).sort((a, b) => a.account.localeCompare(b.account));
  }, [baseAccountData]);

  // Final account data: merge base (stable) + manual accounts (small) - fast recalculation
  const accountData = useMemo(() => {
    if (manualAccounts.length === 0) return sortedBaseAccounts;
    const newManual = manualAccounts
      .filter((acc) => acc.Account && !baseAccountData.has(acc.Account))
      .map((acc) => ({
        account: acc.Account,
        segmentCode: acc["Sub Segment Code"] || "",
        subSegment: acc["Sub Segment"] || "",
        country: acc["Country"] || "",
        isManual: true,
      }));
    if (newManual.length === 0) return sortedBaseAccounts;
    return [...sortedBaseAccounts, ...newManual].sort((a, b) => a.account.localeCompare(b.account));
  }, [sortedBaseAccounts, baseAccountData, manualAccounts]);

  // Compute the source list based on the checkboxes
  const sourceAccounts = useMemo(() => {
    let source = accountData;
    if (onlyWithOpportunities) {
      // Always keep manual accounts visible regardless of opportunity count
      source = source.filter((item) => opportunityAccountSet.has(item.account) || manualAccountSet.has(item.account));
    }
    if (parentAccountsOnly) {
      source = source.filter((item) => parentAccountSet.has(item.account));
    }
    return source;
  }, [
    accountData,
    opportunityAccountSet,
    manualAccountSet,
    onlyWithOpportunities,
    parentAccountsOnly,
    parentAccountSet,
  ]);

  // Get unique segments from source (adjusts with checkbox)
  const segments = useMemo(() => {
    const segmentSet = new Set();
    sourceAccounts.forEach((item) => {
      if (item.segmentCode) {
        segmentSet.add(item.segmentCode);
      }
    });
    return Array.from(segmentSet).sort();
  }, [sourceAccounts]);

  // Segment counts from source
  const segmentCounts = useMemo(() => {
    const counts = {};
    sourceAccounts.forEach((item) => {
      if (item.segmentCode) {
        counts[item.segmentCode] = (counts[item.segmentCode] || 0) + 1;
      }
    });
    return counts;
  }, [sourceAccounts]);

  // Get sub-segments for selected segments (multi-select)
  const subSegments = useMemo(() => {
    if (selectedSegments.length === 0) return [];

    const subSegmentSet = new Set();
    sourceAccounts.forEach((item) => {
      if (selectedSegments.includes(item.segmentCode) && item.subSegment) {
        subSegmentSet.add(item.subSegment);
      }
    });
    return Array.from(subSegmentSet).sort();
  }, [sourceAccounts, selectedSegments]);

  // Get unique countries from source
  const countries = useMemo(() => {
    const countrySet = new Set();
    sourceAccounts.forEach((item) => {
      if (item.country) {
        countrySet.add(item.country);
      }
    });
    return Array.from(countrySet).sort();
  }, [sourceAccounts]);

  // Reset sub-segments that are no longer valid when segments change
  useEffect(() => {
    if (selectedSegments.length === 0) {
      setSelectedSubSegments([]);
    } else {
      setSelectedSubSegments((prev) => prev.filter((ss) => subSegments.includes(ss)));
    }
  }, [selectedSegments, subSegments]);

  // Filter accounts based on search and segment/sub-segment/country filters
  const filteredAccounts = useMemo(() => {
    return sourceAccounts.filter((item) => {
      if (searchText && !item.account.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }

      if (selectedSegments.length > 0 && !selectedSegments.includes(item.segmentCode)) {
        return false;
      }

      if (selectedSubSegments.length > 0 && !selectedSubSegments.includes(item.subSegment)) {
        return false;
      }

      if (selectedCountries.length > 0 && !selectedCountries.includes(item.country)) {
        return false;
      }

      return true;
    });
  }, [sourceAccounts, searchText, selectedSegments, selectedSubSegments, selectedCountries]);

  // Dynamic counts for checkboxes based on current dropdown filters (segment/sub-segment/country/search)
  const filteredWithOpportunitiesCount = useMemo(() => {
    return filteredAccounts.filter(
      (item) => opportunityAccountSet.has(item.account) || manualAccountSet.has(item.account)
    ).length;
  }, [filteredAccounts, opportunityAccountSet, manualAccountSet]);

  const filteredParentAccountsCount = useMemo(() => {
    return filteredAccounts.filter((item) => parentAccountSet.has(item.account)).length;
  }, [filteredAccounts, parentAccountSet]);

  // Limit displayed accounts for performance (65k+ accounts possible)
  const MAX_DISPLAYED_ACCOUNTS = 50;
  const displayedAccounts = showAll ? filteredAccounts : filteredAccounts.slice(0, MAX_DISPLAYED_ACCOUNTS);

  const shouldShowLimitMessage = !showAll && filteredAccounts.length > MAX_DISPLAYED_ACCOUNTS;

  const handleToggleAccount = (account) => {
    setTempSelectedAccounts((prev) => {
      if (prev.includes(account)) {
        return prev.filter((a) => a !== account);
      } else {
        return [...prev, account];
      }
    });
  };

  const handleSelectAll = () => {
    const allDisplayedAccounts = displayedAccounts.map((item) => item.account);
    setTempSelectedAccounts((prev) => {
      // If all displayed accounts are already selected, deselect them
      const allSelected = allDisplayedAccounts.every((account) => prev.includes(account));

      if (allSelected) {
        return prev.filter((account) => !allDisplayedAccounts.includes(account));
      } else {
        // Add all displayed accounts that aren't already selected
        const newAccounts = allDisplayedAccounts.filter((account) => !prev.includes(account));
        return [...prev, ...newAccounts];
      }
    });
  };

  const handleApply = () => {
    onApply(tempSelectedAccounts);
    onClose();
  };

  const handleCancel = () => {
    setTempSelectedAccounts([...selectedAccounts]);
    setSearchText("");
    setSelectedSegments([]);
    setSelectedSubSegments([]);
    setSelectedCountries([]);
    onClose();
  };

  const isAllDisplayedSelected =
    displayedAccounts.length > 0 && displayedAccounts.every((item) => tempSelectedAccounts.includes(item.account));

  // Theme-aware colors
  const brandColor = dark ? theme.palette.primary.light : "#806659";
  const brandColorHover = dark ? theme.palette.primary.dark : "#6B5549";
  const checkboxUnchecked = dark ? theme.palette.grey[600] : "#CCC1BC";
  const borderHover = dark ? theme.palette.grey[500] : "#B2A59F";
  const accentBg = dark ? alpha(theme.palette.primary.main, 0.12) : "#E6DEDA";

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: "85vh",
          maxHeight: "92vh",
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 2,
          pt: 3,
          px: 4,
          backgroundColor: dark ? theme.palette.grey[900] : "#F5F5F5",
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <FilterListIcon sx={{ color: brandColor, fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, color: "text.primary" }}>
              Account Filter
            </Typography>
          </Box>
          <IconButton
            onClick={handleCancel}
            size="small"
            sx={{
              "&:hover": {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 4, pt: "40px !important", backgroundColor: theme.palette.background.default }}>
        {/* Search Input */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search accounts by name..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1.5, color: "text.disabled" }} />,
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: theme.palette.background.paper,
                borderRadius: 2,
                "&:hover fieldset": {
                  borderColor: borderHover,
                },
                "&.Mui-focused fieldset": {
                  borderColor: brandColor,
                  borderWidth: 2,
                },
              },
            }}
          />
        </Box>

        {/* Main Content: Two Columns */}
        <Box sx={{ display: "flex", gap: 4, height: "calc(85vh - 240px)" }}>
          {/* Left Column: Segment Filters */}
          <Box
            sx={{
              width: "32%",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              backgroundColor: theme.palette.background.paper,
              borderRadius: 2,
              p: 3,
              border: `1px solid ${theme.palette.divider}`,
              overflowY: "auto",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <FilterListIcon sx={{ color: brandColor, fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary", flex: 1 }}>
                Filters
              </Typography>
              {(selectedSegments.length > 0 ||
                selectedSubSegments.length > 0 ||
                selectedCountries.length > 0 ||
                searchText) && (
                <Typography
                  variant="caption"
                  onClick={() => {
                    setSelectedSegments([]);
                    setSelectedSubSegments([]);
                    setSelectedCountries([]);
                    setSearchText("");
                  }}
                  sx={{
                    color: brandColor,
                    fontWeight: 600,
                    cursor: "pointer",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  Clear all
                </Typography>
              )}
            </Box>

            <Autocomplete
              multiple
              options={segments}
              value={selectedSegments}
              onChange={(e, newValue) => setSelectedSegments(newValue)}
              getOptionLabel={(option) => `${option} (${segmentCounts[option] || 0})`}
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
                  label="Segments"
                  placeholder={selectedSegments.length === 0 ? "All segments" : ""}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 1.5,
                    },
                  }}
                />
              )}
            />

            <Autocomplete
              multiple
              options={subSegments}
              value={selectedSubSegments}
              onChange={(e, newValue) => setSelectedSubSegments(newValue)}
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
                  label="Sub-Segments"
                  placeholder={selectedSubSegments.length === 0 ? "All sub-segments" : ""}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 1.5,
                    },
                  }}
                />
              )}
            />

            <Autocomplete
              multiple
              options={countries}
              value={selectedCountries}
              onChange={(e, newValue) => setSelectedCountries(newValue)}
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
                  onChange={(e) => setOnlyWithOpportunities(e.target.checked)}
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
                  onChange={(e) => setParentAccountsOnly(e.target.checked)}
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
                  onChange={(e) => setShowAll(e.target.checked)}
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
                  Show all ({filteredAccounts.length})
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
                <strong>{tempSelectedAccounts.length}</strong> account(s) selected
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>{displayedAccounts.length}</strong> of <strong>{filteredAccounts.length}</strong> shown
              </Typography>
            </Box>
          </Box>

          {/* Divider */}
          <Divider orientation="vertical" flexItem />

          {/* Right Column: Accounts List */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary" }}>
                Accounts List
              </Typography>
              <Button
                variant="text"
                onClick={handleSelectAll}
                disabled={displayedAccounts.length === 0}
                sx={{
                  textTransform: "none",
                  fontWeight: 500,
                  color: brandColor,
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                {isAllDisplayedSelected ? "Deselect All" : "Select All Displayed"}
              </Button>
            </Box>

            {/* Show limit message or performance warning */}
            {shouldShowLimitMessage && (
              <Alert
                severity="info"
                icon={<InfoOutlinedIcon />}
                sx={{
                  mb: 2,
                  backgroundColor: alpha(theme.palette.info.main, 0.12),
                  "& .MuiAlert-icon": {
                    color: theme.palette.info.main,
                  },
                }}
              >
                Showing {MAX_DISPLAYED_ACCOUNTS} of {filteredAccounts.length} accounts. Use the search bar, select a
                segment, or check <strong>"Show all"</strong> to see everything.
              </Alert>
            )}
            {showAll && filteredAccounts.length > 500 && (
              <Alert
                severity="warning"
                sx={{
                  mb: 2,
                  backgroundColor: alpha(theme.palette.warning.main, 0.12),
                  "& .MuiAlert-icon": {
                    color: theme.palette.warning.main,
                  },
                }}
              >
                Displaying {filteredAccounts.length} accounts — the list may be slow.
              </Alert>
            )}

            {/* Accounts List with Scroll */}
            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                backgroundColor: theme.palette.background.paper,
                "&::-webkit-scrollbar": {
                  width: "8px",
                },
                "&::-webkit-scrollbar-track": {
                  backgroundColor: dark ? theme.palette.grey[800] : "#F5F5F5",
                  borderRadius: 2,
                },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: checkboxUnchecked,
                  borderRadius: 2,
                  "&:hover": {
                    backgroundColor: borderHover,
                  },
                },
              }}
            >
              {displayedAccounts.length === 0 ? (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <SearchIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No accounts found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Try adjusting your filters or search term
                  </Typography>
                </Box>
              ) : (
                displayedAccounts.map((item, index) => {
                  const oppCount = oppCountMap.get(item.account) || 0;
                  return (
                    <Box
                      key={item.account}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 1.5,
                        px: 2,
                        borderBottom:
                          index < displayedAccounts.length - 1 ? `1px solid ${theme.palette.divider}` : "none",
                        transition: "background-color 0.15s ease",
                        "&:hover": {
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={tempSelectedAccounts.includes(item.account)}
                            onChange={() => handleToggleAccount(item.account)}
                            sx={{
                              color: checkboxUnchecked,
                              "&.Mui-checked": {
                                color: brandColor,
                              },
                            }}
                          />
                        }
                        label={
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: tempSelectedAccounts.includes(item.account) ? 600 : 400,
                              color: tempSelectedAccounts.includes(item.account) ? "text.primary" : "text.secondary",
                            }}
                          >
                            {item.account}
                          </Typography>
                        }
                        sx={{ flex: 1, m: 0 }}
                      />
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                        {item.isManual && (
                          <Chip
                            label="New"
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              backgroundColor: alpha(theme.palette.info.main, 0.12),
                              color: theme.palette.info.dark,
                            }}
                          />
                        )}
                        {oppCount > 0 && (
                          <Chip
                            label={`${oppCount} opp${oppCount > 1 ? "s" : ""}`}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              backgroundColor: alpha(theme.palette.success.main, 0.12),
                              color: theme.palette.success.dark,
                            }}
                          />
                        )}
                        <Typography
                          variant="caption"
                          sx={{
                            backgroundColor: accentBg,
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 1.5,
                            fontWeight: 600,
                            color: brandColor,
                            fontSize: "0.75rem",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {item.segmentCode}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 4,
          py: 2.5,
          backgroundColor: dark ? theme.palette.grey[900] : "#F5F5F5",
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Button
          onClick={handleCancel}
          variant="outlined"
          sx={{
            borderColor: checkboxUnchecked,
            color: brandColor,
            textTransform: "none",
            fontWeight: 500,
            px: 3,
            borderRadius: 1.5,
            "&:hover": {
              borderColor: borderHover,
              backgroundColor: dark ? theme.palette.grey[800] : "#F5F5F5",
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          sx={{
            backgroundColor: dark ? theme.palette.primary.main : "#806659",
            textTransform: "none",
            fontWeight: 600,
            px: 3,
            borderRadius: 1.5,
            "&:hover": {
              backgroundColor: brandColorHover,
            },
          }}
        >
          Apply ({tempSelectedAccounts.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AccountFilterModal;
