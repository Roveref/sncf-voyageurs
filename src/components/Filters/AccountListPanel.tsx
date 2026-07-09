import React, { memo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import { useTheme, alpha } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

interface AccountItem {
  account: string;
  segmentCode: string;
  subSegment: string;
  country: string;
  isManual: boolean;
}

interface AccountListPanelProps {
  displayedAccounts: AccountItem[];
  filteredAccountsLength: number;
  tempSelectedAccounts: string[];
  oppCountMap: Map<string, number>;
  showAll: boolean;
  maxDisplayedAccounts: number;
  isAllDisplayedSelected: boolean;
  brandColor: string;
  checkboxUnchecked: string;
  accentBg: string;
  onToggleAccount: (account: string) => void;
  onSelectAll: () => void;
}

const AccountListPanel = ({
  displayedAccounts,
  filteredAccountsLength,
  tempSelectedAccounts,
  oppCountMap,
  showAll,
  maxDisplayedAccounts,
  isAllDisplayedSelected,
  brandColor,
  checkboxUnchecked,
  accentBg,
  onToggleAccount,
  onSelectAll,
}: AccountListPanelProps) => {
  const theme = useTheme();

  const shouldShowLimitMessage = !showAll && filteredAccountsLength > maxDisplayedAccounts;

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary" }}>
          Liste des sites
        </Typography>
        <Button
          variant="text"
          onClick={onSelectAll}
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
          {isAllDisplayedSelected ? "Tout dÃ©sÃ©lectionner" : "Tout sÃ©lectionner"}
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
          Affichage de {maxDisplayedAccounts} sur {filteredAccountsLength} sites. Utilisez la barre de recherche,
          sÃ©lectionnez un patrimoine, ou cochez <strong>"Tout afficher"</strong> pour tout voir.
        </Alert>
      )}
      {showAll && filteredAccountsLength > 500 && (
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
          Affichage de {filteredAccountsLength} sites \u2014 la liste peut Ãªtre lente.
        </Alert>
      )}

      {/* Accounts List with Scroll */}
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
        {displayedAccounts.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <SearchIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Aucun site trouvÃ©
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Ajustez vos filtres ou votre recherche
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
                    index < displayedAccounts.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.08)}` : "none",
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
                      onChange={() => onToggleAccount(item.account)}
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
                      label="Nouveau"
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
  );
};

AccountListPanel.displayName = "AccountListPanel";

export default memo(AccountListPanel);
