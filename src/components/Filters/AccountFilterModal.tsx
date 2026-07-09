import React, { useState, useEffect, useMemo, memo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTransition from "../common/DialogTransition";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { useTheme, alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import { brand as brandConfig } from "../../config/brandConfig";
import AccountFilterSidebar from "./AccountFilterSidebar";
import AccountListPanel from "./AccountListPanel";

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
  crmAccounts = [] as any[],
  manualAccounts = [] as any[],
}: any) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const [searchText, setSearchText] = useState("");
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [selectedSubSegments, setSelectedSubSegments] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [tempSelectedAccounts, setTempSelectedAccounts] = useState<string[]>([]);
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
    data.forEach((item: Record<string, any>) => {
      const account = item.account;
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

  // Build set of parent accounts (from _be_reportingparent column)
  const parentAccountSet = useMemo(() => {
    const set = new Set<string>();
    crmAccounts.forEach((crm: any) => {
      const parent = crm.parentAccount;
      if (parent && parent.trim()) set.add(parent.trim());
    });
    return set;
  }, [crmAccounts]);

  // Build set of manual account names
  const manualAccountSet = useMemo(() => {
    return new Set(manualAccounts.map((a: any) => a.account));
  }, [manualAccounts]);

  // Base account data from CRM (65k, stable) + opportunity data
  const baseAccountData = useMemo(() => {
    const accountMap = new Map();

    crmAccounts.forEach((crm: Record<string, any>) => {
      const account = crm.account;
      if (account && !accountMap.has(account)) {
        accountMap.set(account, {
          account,
          segmentCode: crm.subSegmentCode || "",
          subSegment: crm.subSegment || "",
          country: crm.country || "",
          isManual: false,
        });
      }
    });

    data.forEach((item: Record<string, any>) => {
      const account = item.account;
      const segmentCode = item.subSegmentCode;
      const subSegment = item.subSegment;
      if (account && segmentCode && !accountMap.has(account)) {
        accountMap.set(account, {
          account,
          segmentCode,
          subSegment: subSegment || "",
          country: item.country || "",
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

  // Final account data: merge base (stable) + manual accounts (small)
  const accountData = useMemo(() => {
    if (manualAccounts.length === 0) return sortedBaseAccounts;
    const newManual = manualAccounts
      .filter((acc: any) => acc.account && !baseAccountData.has(acc.account))
      .map((acc: any) => ({
        account: acc.account,
        segmentCode: acc.subSegmentCode || "",
        subSegment: acc.subSegment || "",
        country: acc.country || "",
        isManual: true,
      }));
    if (newManual.length === 0) return sortedBaseAccounts;
    return [...sortedBaseAccounts, ...newManual].sort((a, b) => a.account.localeCompare(b.account));
  }, [sortedBaseAccounts, baseAccountData, manualAccounts]);

  // Compute the source list based on the checkboxes
  const sourceAccounts = useMemo(() => {
    let source = accountData;
    if (onlyWithOpportunities) {
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

  // Get unique segments from source
  const segments = useMemo(() => {
    const segmentSet = new Set<string>();
    sourceAccounts.forEach((item) => {
      if (item.segmentCode) segmentSet.add(item.segmentCode);
    });
    return Array.from(segmentSet).sort();
  }, [sourceAccounts]);

  // Segment counts from source
  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sourceAccounts.forEach((item: any) => {
      if (item.segmentCode) {
        counts[item.segmentCode] = (counts[item.segmentCode] || 0) + 1;
      }
    });
    return counts;
  }, [sourceAccounts]);

  // Get sub-segments for selected segments (multi-select)
  const subSegments = useMemo(() => {
    if (selectedSegments.length === 0) return [];
    const subSegmentSet = new Set<string>();
    sourceAccounts.forEach((item) => {
      if (selectedSegments.includes(item.segmentCode) && item.subSegment) {
        subSegmentSet.add(item.subSegment);
      }
    });
    return Array.from(subSegmentSet).sort();
  }, [sourceAccounts, selectedSegments]);

  // Get unique countries from source
  const countries = useMemo(() => {
    const countrySet = new Set<string>();
    sourceAccounts.forEach((item) => {
      if (item.country) countrySet.add(item.country);
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
      if (searchText && !item.account.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (selectedSegments.length > 0 && !selectedSegments.includes(item.segmentCode)) return false;
      if (selectedSubSegments.length > 0 && !selectedSubSegments.includes(item.subSegment)) return false;
      if (selectedCountries.length > 0 && !selectedCountries.includes(item.country)) return false;
      return true;
    });
  }, [sourceAccounts, searchText, selectedSegments, selectedSubSegments, selectedCountries]);

  // Dynamic counts for checkboxes
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

  const handleToggleAccount = (account: string) => {
    setTempSelectedAccounts((prev) => {
      if (prev.includes(account)) return prev.filter((a) => a !== account);
      return [...prev, account];
    });
  };

  const handleSelectAll = () => {
    const allDisplayedAccounts = displayedAccounts.map((item) => item.account);
    setTempSelectedAccounts((prev) => {
      const allSelected = allDisplayedAccounts.every((account) => prev.includes(account));
      if (allSelected) return prev.filter((account) => !allDisplayedAccounts.includes(account));
      const newAccounts = allDisplayedAccounts.filter((account) => !prev.includes(account));
      return [...prev, ...newAccounts];
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

  const handleClearAll = () => {
    setSelectedSegments([]);
    setSelectedSubSegments([]);
    setSelectedCountries([]);
    setSearchText("");
  };

  const isAllDisplayedSelected =
    displayedAccounts.length > 0 && displayedAccounts.every((item) => tempSelectedAccounts.includes(item.account));

  // Theme-aware colors
  const brandColor = dark ? theme.palette.primary.light : brandConfig.secondary;
  const checkboxUnchecked = dark ? theme.palette.grey[600] : brandConfig.secondaryLightest;
  const accentBg = dark ? alpha(theme.palette.primary.main, 0.12) : brandConfig.secondaryBg;

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
              Filtre Sites
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
            placeholder="Rechercher des comptes..."
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

        {/* Main Content: Two Columns */}
        <Box sx={{ display: "flex", gap: 4, height: "calc(85vh - 240px)" }}>
          <AccountFilterSidebar
            segments={segments}
            segmentCounts={segmentCounts}
            selectedSegments={selectedSegments}
            onSegmentsChange={setSelectedSegments}
            subSegments={subSegments}
            selectedSubSegments={selectedSubSegments}
            onSubSegmentsChange={setSelectedSubSegments}
            countries={countries}
            selectedCountries={selectedCountries}
            onCountriesChange={setSelectedCountries}
            onlyWithOpportunities={onlyWithOpportunities}
            onOnlyWithOpportunitiesChange={setOnlyWithOpportunities}
            filteredWithOpportunitiesCount={filteredWithOpportunitiesCount}
            parentAccountsOnly={parentAccountsOnly}
            onParentAccountsOnlyChange={setParentAccountsOnly}
            filteredParentAccountsCount={filteredParentAccountsCount}
            showAll={showAll}
            onShowAllChange={setShowAll}
            filteredAccountsLength={filteredAccounts.length}
            tempSelectedAccountsCount={tempSelectedAccounts.length}
            displayedAccountsCount={displayedAccounts.length}
            searchText={searchText}
            brandColor={brandColor}
            checkboxUnchecked={checkboxUnchecked}
            accentBg={accentBg}
            onClearAll={handleClearAll}
          />

          <AccountListPanel
            displayedAccounts={displayedAccounts}
            filteredAccountsLength={filteredAccounts.length}
            tempSelectedAccounts={tempSelectedAccounts}
            oppCountMap={oppCountMap}
            showAll={showAll}
            maxDisplayedAccounts={MAX_DISPLAYED_ACCOUNTS}
            isAllDisplayedSelected={isAllDisplayedSelected}
            brandColor={brandColor}
            checkboxUnchecked={checkboxUnchecked}
            accentBg={accentBg}
            onToggleAccount={handleToggleAccount}
            onSelectAll={handleSelectAll}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 4, py: 2.5, backgroundColor: theme.palette.background.default }}>
        <Button onClick={handleCancel} variant="outlined" sx={{ px: 3, borderRadius: 1.5 }}>
          Annuler
        </Button>
        <Button onClick={handleApply} variant="contained" color="primary" sx={{ px: 3, borderRadius: 1.5 }}>
          Appliquer ({tempSelectedAccounts.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default memo(AccountFilterModal);
