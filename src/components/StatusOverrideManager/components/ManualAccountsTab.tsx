/**
 * ManualAccountsTab — Tab 2: New Accounts
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import { alpha, useTheme } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import { formatDateShort } from "./tabUtils";
import { useManagementDialog } from "../ManagementDialogContext";

const ManualAccountsTab = memo(
  ({ manualAccounts, manualOpportunities, deleteConfirm, setDeleteConfirm, onDeleteManualAccount }: any) => {
    const { searchText, selectedItems, toggleSelect, toggleSelectAll, handleDeleteSelected } = useManagementDialog();
    const theme = useTheme();

    const accountCount = manualAccounts.length;

    const lowerSearch = searchText.toLowerCase();
    const filtered = manualAccounts.filter((acc: any) => {
      if (!lowerSearch) return true;
      const name = (acc.account || "").toLowerCase();
      const parent = (acc.parentAccount || "").toLowerCase();
      const country = (acc.country || "").toLowerCase();
      return name.includes(lowerSearch) || parent.includes(lowerSearch) || country.includes(lowerSearch);
    });
    const allIds = filtered.map((a: any) => a.account);
    const selCount = allIds.filter((id: string) => selectedItems.has(id)).length;

    return (
      <>
        {filtered.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {accountCount === 0 ? "No accounts to create" : "No results matching your search"}
            </Typography>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 2,
                py: 0.5,
                borderBottom: `1px solid ${theme.palette.divider}`,
                bgcolor: selCount > 0 ? alpha(theme.palette.error.main, 0.04) : "transparent",
              }}
            >
              <Checkbox
                size="small"
                checked={allIds.length > 0 && selCount === allIds.length}
                indeterminate={selCount > 0 && selCount < allIds.length}
                onChange={() => toggleSelectAll(allIds)}
              />
              {selCount > 0 ? (
                <>
                  <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>
                    {selCount} selected
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteIcon />}
                    onClick={handleDeleteSelected}
                    sx={{ ml: "auto" }}
                  >
                    Delete Selected
                  </Button>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                  {filtered.length} item{filtered.length !== 1 ? "s" : ""}
                </Typography>
              )}
            </Box>
            <List sx={{ py: 0 }}>
              {filtered.map((acc: any, index: number) => {
                const isDeleting = deleteConfirm === `account_${acc.account}`;

                return (
                  <React.Fragment key={acc.account}>
                    {index > 0 && <Divider />}
                    <ListItem
                      sx={{
                        py: 2,
                        bgcolor: isDeleting
                          ? alpha(theme.palette.error.main, 0.08)
                          : selectedItems.has(acc.account)
                            ? alpha(theme.palette.primary.main, 0.06)
                            : "transparent",
                        "&:hover": {
                          bgcolor: isDeleting
                            ? alpha(theme.palette.error.main, 0.12)
                            : alpha(theme.palette.primary.main, 0.08),
                        },
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={selectedItems.has(acc.account)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(acc.account)}
                        sx={{ mr: 1 }}
                      />
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <AddBusinessIcon
                              sx={{
                                fontSize: 16,
                                color: theme.palette.success.main,
                              }}
                            />
                            <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ maxWidth: 250 }}>
                              {acc.account}
                            </Typography>
                            <Chip
                              label="New"
                              size="small"
                              color="success"
                              sx={{
                                height: 18,
                                fontSize: "0.6rem",
                                fontWeight: 700,
                              }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 2,
                                mb: 0.5,
                                flexWrap: "wrap",
                              }}
                            >
                              {acc.parentAccount && (
                                <Typography variant="caption" color="text.secondary">
                                  <strong>Parent:</strong> {acc.parentAccount}
                                </Typography>
                              )}
                              {acc.subSegmentCode && (
                                <Chip
                                  label={acc.subSegmentCode}
                                  size="small"
                                  sx={{ fontSize: "0.65rem", height: 18 }}
                                />
                              )}
                              {acc.subSegment && (
                                <Typography variant="caption" color="text.secondary">
                                  {acc.subSegment}
                                </Typography>
                              )}
                            </Box>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 2,
                              }}
                            >
                              {acc.country && (
                                <Typography variant="caption" color="text.secondary">
                                  <strong>Country:</strong> {acc.country}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.disabled">
                                Created on {formatDateShort(acc.createdAt)}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        {isDeleting ? (
                          (() => {
                            const associatedOpps = manualOpportunities.filter(
                              (opp: any) => opp.account === acc.account
                            );
                            const oppCount = associatedOpps.length;
                            return (
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                {oppCount > 0 && (
                                  <Typography
                                    variant="caption"
                                    color="error.main"
                                    fontWeight={600}
                                    sx={{ maxWidth: 180 }}
                                  >
                                    {oppCount} opportunit
                                    {oppCount > 1 ? "ies" : "y"} will also be deleted
                                  </Typography>
                                )}
                                <Button
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirm(null);
                                  }}
                                  sx={{ minWidth: "auto", px: 1 }}
                                >
                                  No
                                </Button>
                                <Button
                                  size="small"
                                  color="error"
                                  variant="contained"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onDeleteManualAccount) {
                                      onDeleteManualAccount(acc.account);
                                    }
                                    setDeleteConfirm(null);
                                  }}
                                  sx={{ minWidth: "auto", px: 1 }}
                                >
                                  Yes
                                </Button>
                              </Box>
                            );
                          })()
                        ) : (
                          <Tooltip title="Delete this account">
                            <IconButton
                              edge="end"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(`account_${acc.account}`);
                              }}
                              color="error"
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </ListItemSecondaryAction>
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          </>
        )}
      </>
    );
  }
);

ManualAccountsTab.displayName = "ManualAccountsTab";

export default ManualAccountsTab;
