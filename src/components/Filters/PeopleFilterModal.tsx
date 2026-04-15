import React, { useState, useEffect, useMemo, memo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import { useTheme, alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { brand as brandCfg } from "../../config/brandConfig";

/**
 * PeopleFilterModal Component
 *
 * A powerful people filter with:
 * - Search input at the top
 * - People list with rich metadata (occurrences, top accounts, top segments)
 * - Multi-select functionality
 */
const PeopleFilterModal = ({
  open,
  onClose,
  data,
  selectedPeople,
  onApply,
  showNetRevenue,
}: {
  open: boolean;
  onClose: () => void;
  data: Record<string, any>[];
  selectedPeople: string[];
  onApply: (people: string[]) => void;
  showNetRevenue: boolean;
}) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const [searchText, setSearchText] = useState("");
  const [tempSelectedPeople, setTempSelectedPeople] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  // Initialize temp selection when dialog opens
  useEffect(() => {
    if (open) {
      setTempSelectedPeople([...selectedPeople]);
    }
  }, [open, selectedPeople]);

  // Build people data with rich metadata
  const peopleData = useMemo(() => {
    const peopleMap = new Map();
    const revenueColumn = showNetRevenue ? "netRevenue" : "grossRevenue";

    data.forEach((item, index) => {
      const account = item.account;
      const segmentCode = item.subSegmentCode;
      const opportunityId = index; // Use row index as unique opportunity ID
      const revenue = parseFloat(item[revenueColumn]) || 0;

      // Track which people are in this opportunity
      const peopleInThisOpportunity = new Set();
      [item.manager, item.partner, item.em, item.ep].forEach((person) => {
        if (person && person !== "-") {
          const personName = String(person).trim();
          if (personName !== "" && personName !== "-") {
            peopleInThisOpportunity.add(personName);
          }
        }
      });

      // For each person in this opportunity, count it once
      peopleInThisOpportunity.forEach((personName) => {
        if (!peopleMap.has(personName)) {
          peopleMap.set(personName, {
            name: personName,
            opportunitiesSet: new Set(),
            accountRevenue: new Map(), // account -> { opportunityIds: Set, totalRevenue: number }
            segmentOpportunities: new Map(), // segment -> Set of opportunity IDs
          });
        }

        const personInfo = peopleMap.get(personName);
        personInfo.opportunitiesSet.add(opportunityId);

        if (account) {
          if (!personInfo.accountRevenue.has(account)) {
            personInfo.accountRevenue.set(account, { opportunityIds: new Set(), totalRevenue: 0 });
          }
          const accountInfo = personInfo.accountRevenue.get(account);
          accountInfo.opportunityIds.add(opportunityId);
          accountInfo.totalRevenue += revenue;
        }

        if (segmentCode) {
          if (!personInfo.segmentOpportunities.has(segmentCode)) {
            personInfo.segmentOpportunities.set(segmentCode, new Set());
          }
          personInfo.segmentOpportunities.get(segmentCode).add(opportunityId);
        }
      });
    });

    // Convert to array and calculate top accounts/segments
    return Array.from(peopleMap.values())
      .map((person) => {
        // Separate accounts by opportunity status and sort by revenue
        const opportunityAccountsArray = (
          Array.from(person.accountRevenue.entries()) as [
            string,
            { opportunityIds: Set<number>; totalRevenue: number },
          ][]
        )
          .map(([account, info]: [string, { opportunityIds: Set<number>; totalRevenue: number }]) => {
            // Calculate revenue for opportunities with status < 14
            let oppRevenue = 0;
            info.opportunityIds.forEach((opportunityId: number) => {
              const item = data[opportunityId];
              if (item && item.status < 14) {
                oppRevenue += parseFloat(item[revenueColumn]) || 0;
              }
            });
            return { account, revenue: oppRevenue };
          })
          .filter((a: { account: string; revenue: number }) => a.revenue > 0)
          .sort(
            (a: { account: string; revenue: number }, b: { account: string; revenue: number }) => b.revenue - a.revenue
          );

        const bookingAccountsArray = (
          Array.from(person.accountRevenue.entries()) as [
            string,
            { opportunityIds: Set<number>; totalRevenue: number },
          ][]
        )
          .map(([account, info]: [string, { opportunityIds: Set<number>; totalRevenue: number }]) => {
            // Calculate revenue for opportunities with status == 14
            let bookingRevenue = 0;
            info.opportunityIds.forEach((opportunityId: number) => {
              const item = data[opportunityId];
              if (item && item.status === 14) {
                bookingRevenue += parseFloat(item[revenueColumn]) || 0;
              }
            });
            return { account, revenue: bookingRevenue };
          })
          .filter((a: { account: string; revenue: number }) => a.revenue > 0)
          .sort(
            (a: { account: string; revenue: number }, b: { account: string; revenue: number }) => b.revenue - a.revenue
          );

        // Sort segments by number of opportunities (descending)
        const segmentsArray = (Array.from(person.segmentOpportunities.entries()) as [string, Set<number>][])
          .map(([segment, oppSet]: [string, Set<number>]) => ({ segment, count: oppSet.size }))
          .sort((a: { segment: string; count: number }, b: { segment: string; count: number }) => b.count - a.count);

        // Count active (status < 14) and booked (status == 14) opportunities
        let activeCount = 0;
        let bookedCount = 0;
        person.opportunitiesSet.forEach((opportunityId: number) => {
          const item = data[opportunityId];
          if (item) {
            if (item.status < 14) {
              activeCount++;
            } else if (item.status === 14) {
              bookedCount++;
            }
          }
        });

        return {
          name: person.name,
          occurrences: person.opportunitiesSet.size, // Number of distinct opportunities
          activeCount, // Number of active opportunities (status < 14)
          bookedCount, // Number of booked opportunities (status == 14)
          topOpportunityAccounts: opportunityAccountsArray
            .slice(0, 3)
            .map((a: { account: string; revenue: number }) => a.account), // Top 3 opportunity accounts by revenue
          topBookingAccounts: bookingAccountsArray
            .slice(0, 3)
            .map((a: { account: string; revenue: number }) => a.account), // Top 3 booking accounts by revenue
          topSegments: segmentsArray.slice(0, 3).map((s: { segment: string; count: number }) => s.segment), // Top 3 segments by opportunity count
          totalAccounts: person.accountRevenue.size,
          totalSegments: person.segmentOpportunities.size,
        };
      })
      .sort((a, b) => b.occurrences - a.occurrences); // Sort by occurrences descending
  }, [data, showNetRevenue]);

  // Filter people based on search
  const filteredPeople = useMemo(() => {
    return peopleData.filter((item) => {
      if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [peopleData, searchText]);

  // Determine if we should show all people or limit to 15
  const hasActiveFilter = searchText;
  const MAX_INITIAL_PEOPLE = 15;
  const displayedPeople = showAll || hasActiveFilter ? filteredPeople : filteredPeople.slice(0, MAX_INITIAL_PEOPLE);

  const shouldShowLimitMessage = !showAll && !hasActiveFilter && filteredPeople.length > MAX_INITIAL_PEOPLE;

  const handleTogglePerson = (person: string) => {
    setTempSelectedPeople((prev) => {
      if (prev.includes(person)) {
        return prev.filter((p) => p !== person);
      } else {
        return [...prev, person];
      }
    });
  };

  const handleSelectAll = () => {
    const allDisplayedPeople = displayedPeople.map((item) => item.name);
    setTempSelectedPeople((prev) => {
      const allSelected = allDisplayedPeople.every((person) => prev.includes(person));

      if (allSelected) {
        return prev.filter((person) => !allDisplayedPeople.includes(person));
      } else {
        const newPeople = allDisplayedPeople.filter((person) => !prev.includes(person));
        return [...prev, ...newPeople];
      }
    });
  };

  const handleApply = () => {
    onApply(tempSelectedPeople);
    onClose();
  };

  const handleCancel = () => {
    setTempSelectedPeople([...selectedPeople]);
    setSearchText("");
    onClose();
  };

  const isAllDisplayedSelected =
    displayedPeople.length > 0 && displayedPeople.every((item) => tempSelectedPeople.includes(item.name));

  // Theme-aware colors
  const brandColor = dark ? theme.palette.primary.light : brandCfg.secondary;
  const brandColorHover = dark ? theme.palette.primary.dark : "#6B5549";
  const checkboxUnchecked = dark ? theme.palette.grey[600] : brandCfg.secondaryLightest;
  const borderHover = dark ? theme.palette.grey[500] : brandCfg.secondaryLighter;
  const accentBg = dark ? alpha(theme.palette.primary.main, 0.12) : brandCfg.secondaryBg;

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      TransitionComponent={DialogTransition}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: "85vh",
          maxHeight: "92vh",
          borderRadius: "12px",
        },
      }}
    >
      <DialogTitle sx={{ pb: 2, pt: 3, px: 4, backgroundColor: theme.palette.background.default }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <FilterListIcon sx={{ color: brandColor, fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, color: "text.primary" }}>
              People Filter
            </Typography>
          </Box>
          <IconButton
            onClick={handleCancel}
            size="small"
            aria-label="Close filter"
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
            placeholder="Search people by name..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1.5, color: "text.disabled" }} />,
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: theme.palette.background.paper,
                borderRadius: 2,
                "& fieldset": { border: "none" },
              },
            }}
          />
        </Box>

        {/* Main Content: Single Column */}
        <Box sx={{ display: "flex", gap: 4, height: "calc(85vh - 240px)" }}>
          {/* Left Column: Selection Summary */}
          <Box
            sx={{
              width: "25%",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              backgroundColor: theme.palette.background.paper,
              borderRadius: 2,
              p: 3,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}>
              Selection Summary
            </Typography>

            <Box
              sx={{
                backgroundColor: accentBg,
                borderRadius: 2,
                p: 2,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, color: brandColor, mb: 1 }}>
                Statistics
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                <strong>{tempSelectedPeople.length}</strong> person(s) selected
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>{displayedPeople.length}</strong> of <strong>{filteredPeople.length}</strong> shown
              </Typography>
            </Box>

            {/* Show all people checkbox */}
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
                  Show all ({filteredPeople.length})
                </Typography>
              }
            />

            {searchText && (
              <Button variant="outlined" onClick={() => setSearchText("")} sx={{ borderRadius: 1.5 }}>
                Clear Search
              </Button>
            )}
          </Box>

          {/* Right Column: People List */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary" }}>
                People
              </Typography>
              <Button
                variant="text"
                onClick={handleSelectAll}
                disabled={displayedPeople.length === 0}
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

            {/* Show limit message if applicable */}
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
                Showing first {MAX_INITIAL_PEOPLE} of {filteredPeople.length} people. Use the search bar or check{" "}
                <strong>"Show all"</strong> to see everything.
              </Alert>
            )}

            {/* People List with Scroll */}
            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                borderRadius: 2,
                backgroundColor: theme.palette.background.paper,
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              {displayedPeople.length === 0 ? (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <SearchIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No people found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Try adjusting your search term
                  </Typography>
                </Box>
              ) : (
                displayedPeople.map((item, index) => (
                  <Box
                    key={item.name}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      py: 2,
                      px: 2.5,
                      borderBottom:
                        index < displayedPeople.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.08)}` : "none",
                      transition: "background-color 0.15s ease",
                      "&:hover": {
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    {/* Main row with checkbox and name */}
                    <Box sx={{ display: "flex", alignItems: "flex-start" }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={tempSelectedPeople.includes(item.name)}
                            onChange={() => handleTogglePerson(item.name)}
                            sx={{
                              color: checkboxUnchecked,
                              "&.Mui-checked": {
                                color: brandColor,
                              },
                              mt: -0.5,
                            }}
                          />
                        }
                        label={
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: tempSelectedPeople.includes(item.name) ? 600 : 500,
                              color: tempSelectedPeople.includes(item.name) ? "text.primary" : "text.secondary",
                            }}
                          >
                            {item.name}
                          </Typography>
                        }
                        sx={{ flex: 1, m: 0 }}
                      />
                    </Box>

                    {/* Metadata row */}
                    <Box sx={{ ml: 4.5, mt: 0.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
                      {/* Occurrences */}
                      <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                        <strong>{item.occurrences}</strong> opportunity(ies) (<strong>{item.activeCount}</strong>{" "}
                        active, <strong>{item.bookedCount}</strong> booked) | <strong>{item.totalAccounts}</strong>{" "}
                        account(s) | <strong>{item.totalSegments}</strong> segment(s)
                      </Typography>

                      {/* Top segments */}
                      {item.topSegments.length > 0 && (
                        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
                          <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.75rem" }}>
                            Top segments:
                          </Typography>
                          {item.topSegments.map((segment) => (
                            <Typography
                              key={segment}
                              variant="caption"
                              sx={{
                                backgroundColor: accentBg,
                                px: 0.75,
                                py: 0.25,
                                borderRadius: 0.75,
                                fontWeight: 600,
                                color: brandColor,
                                fontSize: "0.7rem",
                              }}
                            >
                              {segment}
                            </Typography>
                          ))}
                        </Box>
                      )}

                      {/* Top opportunity accounts (< status 14) */}
                      {item.topOpportunityAccounts.length > 0 && (
                        <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.75rem" }}>
                          Main opportunity accounts ({"< status 14"}): {item.topOpportunityAccounts.join(", ")}
                        </Typography>
                      )}

                      {/* Top booking accounts (status 14) */}
                      {item.topBookingAccounts.length > 0 && (
                        <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.75rem" }}>
                          Main booking accounts (status 14): {item.topBookingAccounts.join(", ")}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 4, py: 2.5, backgroundColor: theme.palette.background.default }}>
        <Button onClick={handleCancel} variant="outlined" sx={{ px: 3, borderRadius: 1.5 }}>
          Cancel
        </Button>
        <Button onClick={handleApply} variant="contained" color="primary" sx={{ px: 3, borderRadius: 1.5 }}>
          Apply ({tempSelectedPeople.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default memo(PeopleFilterModal);
