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
 * TechnologyPartnerFilterModal Component
 *
 * A powerful technology partner filter with:
 * - Search input at the top
 * - Partners list with rich metadata (occurrences, top accounts, top segments)
 * - Multi-select functionality
 */
const TechnologyPartnerFilterModal = ({
  open,
  onClose,
  data,
  selectedPartners,
  onApply,
  showNetRevenue,
}: {
  open: boolean;
  onClose: () => void;
  data: Record<string, any>[];
  selectedPartners: string[];
  onApply: (partners: string[]) => void;
  showNetRevenue: boolean;
}) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const [searchText, setSearchText] = useState("");
  const [tempSelectedPartners, setTempSelectedPartners] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  // Initialize temp selection when dialog opens
  useEffect(() => {
    if (open) {
      setTempSelectedPartners([...selectedPartners]);
    }
  }, [open, selectedPartners]);

  // Build partner data with rich metadata
  const partnerData = useMemo(() => {
    const partnerMap = new Map();
    const revenueColumn = showNetRevenue ? "netRevenue" : "grossRevenue";

    data.forEach((item: Record<string, any>, index: number) => {
      const account = item.account;
      const segmentCode = item.subSegmentCode;
      const opportunityId = index; // Use row index as unique opportunity ID
      const revenue = parseFloat(item[revenueColumn]) || 0;

      // Track which partners are in this opportunity
      const partnersInThisOpportunity = new Set();
      [item.techPartner1, item.techPartner2, item.techPartner3].forEach((partner) => {
        if (partner && partner !== "-" && partner.trim() !== "") {
          partnersInThisOpportunity.add(partner.trim());
        }
      });

      // For each partner in this opportunity, count it once
      partnersInThisOpportunity.forEach((partnerName) => {
        if (!partnerMap.has(partnerName)) {
          partnerMap.set(partnerName, {
            name: partnerName,
            opportunitiesSet: new Set(),
            accountRevenue: new Map(), // account -> { opportunityIds: Set, totalRevenue: number }
            segmentOpportunities: new Map(), // segment -> Set of opportunity IDs
          });
        }

        const partnerInfo = partnerMap.get(partnerName);
        partnerInfo.opportunitiesSet.add(opportunityId);

        if (account) {
          if (!partnerInfo.accountRevenue.has(account)) {
            partnerInfo.accountRevenue.set(account, { opportunityIds: new Set(), totalRevenue: 0 });
          }
          const accountInfo = partnerInfo.accountRevenue.get(account);
          accountInfo.opportunityIds.add(opportunityId);
          accountInfo.totalRevenue += revenue;
        }

        if (segmentCode) {
          if (!partnerInfo.segmentOpportunities.has(segmentCode)) {
            partnerInfo.segmentOpportunities.set(segmentCode, new Set());
          }
          partnerInfo.segmentOpportunities.get(segmentCode).add(opportunityId);
        }
      });
    });

    // Convert to array and calculate top accounts/segments
    return Array.from(partnerMap.values())
      .map((partner) => {
        // Separate accounts by opportunity status and sort by revenue
        const opportunityAccountsArray = Array.from(partner.accountRevenue.entries() as IterableIterator<[string, any]>)
          .map(([account, info]: [string, any]) => {
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
          .filter((a: { account: string; revenue: number }) => a.revenue > 0) // Only include accounts with opportunity revenue
          .sort(
            (a: { account: string; revenue: number }, b: { account: string; revenue: number }) => b.revenue - a.revenue
          );

        const bookingAccountsArray = Array.from(partner.accountRevenue.entries() as IterableIterator<[string, any]>)
          .map(([account, info]: [string, any]) => {
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
          .filter((a: { account: string; revenue: number }) => a.revenue > 0) // Only include accounts with booking revenue
          .sort(
            (a: { account: string; revenue: number }, b: { account: string; revenue: number }) => b.revenue - a.revenue
          );

        // Sort segments by number of opportunities (descending)
        const segmentsArray = Array.from(
          partner.segmentOpportunities.entries() as IterableIterator<[string, Set<number>]>
        )
          .map(([segment, oppSet]: [string, Set<number>]) => ({ segment, count: oppSet.size }))
          .sort((a: { segment: string; count: number }, b: { segment: string; count: number }) => b.count - a.count);

        // Count active (status < 14) and booked (status == 14) opportunities
        let activeCount = 0;
        let bookedCount = 0;
        partner.opportunitiesSet.forEach((opportunityId: number) => {
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
          name: partner.name,
          occurrences: partner.opportunitiesSet.size, // Number of distinct opportunities
          activeCount, // Number of active opportunities (status < 14)
          bookedCount, // Number of booked opportunities (status == 14)
          topOpportunityAccounts: opportunityAccountsArray
            .slice(0, 3)
            .map((a: { account: string; revenue: number }) => a.account), // Top 3 accounts by opportunity revenue (status < 14)
          topBookingAccounts: bookingAccountsArray
            .slice(0, 3)
            .map((a: { account: string; revenue: number }) => a.account), // Top 3 accounts by booking revenue (status == 14)
          topSegments: segmentsArray.slice(0, 3).map((s: { segment: string; count: number }) => s.segment), // Top 3 segments by opportunity count
          totalAccounts: partner.accountRevenue.size,
          totalSegments: partner.segmentOpportunities.size,
        };
      })
      .sort((a, b) => b.occurrences - a.occurrences); // Sort by occurrences descending
  }, [data, showNetRevenue]);

  // Filter partners based on search
  const filteredPartners = useMemo(() => {
    return partnerData.filter((item) => {
      if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [partnerData, searchText]);

  // Determine if we should show all partners or limit to 15
  const hasActiveFilter = searchText;
  const MAX_INITIAL_PARTNERS = 15;
  const displayedPartners =
    showAll || hasActiveFilter ? filteredPartners : filteredPartners.slice(0, MAX_INITIAL_PARTNERS);

  const shouldShowLimitMessage = !showAll && !hasActiveFilter && filteredPartners.length > MAX_INITIAL_PARTNERS;

  const handleTogglePartner = (partner: string) => {
    setTempSelectedPartners((prev) => {
      if (prev.includes(partner)) {
        return prev.filter((p) => p !== partner);
      } else {
        return [...prev, partner];
      }
    });
  };

  const handleSelectAll = () => {
    const allDisplayedPartners = displayedPartners.map((item) => item.name);
    setTempSelectedPartners((prev) => {
      const allSelected = allDisplayedPartners.every((partner) => prev.includes(partner));

      if (allSelected) {
        return prev.filter((partner) => !allDisplayedPartners.includes(partner));
      } else {
        const newPartners = allDisplayedPartners.filter((partner) => !prev.includes(partner));
        return [...prev, ...newPartners];
      }
    });
  };

  const handleApply = () => {
    onApply(tempSelectedPartners);
    onClose();
  };

  const handleCancel = () => {
    setTempSelectedPartners([...selectedPartners]);
    setSearchText("");
    onClose();
  };

  const isAllDisplayedSelected =
    displayedPartners.length > 0 && displayedPartners.every((item) => tempSelectedPartners.includes(item.name));

  // Theme-aware colors
  const brandColor = dark ? theme.palette.primary.light : brandCfg.secondary;
  const brandColorHover = dark ? theme.palette.primary.dark : brandCfg.secondaryDark;
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
              Technology Partner Filter
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
            placeholder="Search technology partners..."
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
                <strong>{tempSelectedPartners.length}</strong> partner(s) selected
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>{displayedPartners.length}</strong> of <strong>{filteredPartners.length}</strong> shown
              </Typography>
            </Box>

            {/* Show all partners checkbox */}
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
                  Show all ({filteredPartners.length})
                </Typography>
              }
            />

            {searchText && (
              <Button variant="outlined" onClick={() => setSearchText("")} sx={{ borderRadius: 1.5 }}>
                Clear Search
              </Button>
            )}
          </Box>

          {/* Right Column: Partners List */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary" }}>
                Technology Partners
              </Typography>
              <Button
                variant="text"
                onClick={handleSelectAll}
                disabled={displayedPartners.length === 0}
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
                Showing first {MAX_INITIAL_PARTNERS} of {filteredPartners.length} partners. Use the search bar or check{" "}
                <strong>"Show all"</strong> to see everything.
              </Alert>
            )}

            {/* Partners List with Scroll */}
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
              {displayedPartners.length === 0 ? (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <SearchIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No technology partners found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Try adjusting your search term
                  </Typography>
                </Box>
              ) : (
                displayedPartners.map((item, index) => (
                  <Box
                    key={item.name}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      py: 2,
                      px: 2.5,
                      borderBottom:
                        index < displayedPartners.length - 1
                          ? `1px solid ${alpha(theme.palette.divider, 0.08)}`
                          : "none",
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
                            checked={tempSelectedPartners.includes(item.name)}
                            onChange={() => handleTogglePartner(item.name)}
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
                              fontWeight: tempSelectedPartners.includes(item.name) ? 600 : 500,
                              color: tempSelectedPartners.includes(item.name) ? "text.primary" : "text.secondary",
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
          Apply ({tempSelectedPartners.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default memo(TechnologyPartnerFilterModal);
