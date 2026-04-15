/**
 * OpportunityContacts Component
 * Displays CRM contacts linked to the same account as the opportunity.
 * Primary contact is highlighted. Tab panel within OpportunityExpandedDetails.
 * Contacts are fetched on-demand per account (not bulk-loaded at hydration).
 */

import React, { memo, useMemo, useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import { alpha, useTheme } from "@mui/material/styles";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import StarIcon from "@mui/icons-material/Star";
import BusinessIcon from "@mui/icons-material/Business";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import ContactsIcon from "@mui/icons-material/Contacts";
import { useCrmData } from "../../../queries/useCrmData";
import { API_BASE, apiFetch } from "../../../services/api";
import type { CrmContact } from "../../../types/opportunity";

interface OpportunityContactsProps {
  accountId?: string;
  accountName: string;
  primaryContactId?: string;
}

function getInitials(firstName: string, lastName: string, fullName: string): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : fullName[0]?.toUpperCase() || "?";
  }
  return "?";
}

const OpportunityContacts = memo(({ accountId, accountName, primaryContactId }: OpportunityContactsProps) => {
  const theme = useTheme();
  const { opportunityData } = useCrmData();

  // On-demand fetch of contacts for this account
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (accountId) params.set("accountId", accountId);
    else if (accountName) params.set("account", accountName);
    else {
      setContacts([]);
      setLoading(false);
      return;
    }

    apiFetch(`${API_BASE}/hydrate/contacts?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setContacts(data.contacts || []);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, accountName]);

  // Count how many opportunities each contact is primary on
  const oppCountByContact = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const opp of opportunityData) {
      const cid = opp.primaryContactId;
      if (cid) counts[cid] = (counts[cid] || 0) + 1;
    }
    return counts;
  }, [opportunityData]);

  const accountContacts = useMemo(() => {
    if (contacts.length === 0) return [];

    // Job title seniority: C-level=0 ... generic=6
    const titleRank = (title: string): number => {
      const t = title.toLowerCase();
      if (/^(ceo|cfo|cto|cio|cdo|coo|chief )/.test(t)) return 0;
      if (/^(vp |vice[ -]president)/.test(t)) return 1;
      if (/managing director/.test(t)) return 2;
      if (/director/.test(t)) return 3;
      if (/^head of/.test(t)) return 4;
      if (/lead|manager/.test(t)) return 5;
      return 6;
    };

    // Importance score: lower = more important
    const importanceScore = (c: CrmContact): number => {
      const oppCount = oppCountByContact[c.contactId] || 0;
      const rank = titleRank(c.jobTitle || "");
      return -oppCount * 10 + rank;
    };

    // Sort: primary first, then by importance score, then alphabetical
    const sorted = [...contacts].sort((a, b) => {
      if (a.contactId === primaryContactId) return -1;
      if (b.contactId === primaryContactId) return 1;
      const sa = importanceScore(a);
      const sb = importanceScore(b);
      if (sa !== sb) return sa - sb;
      return a.fullName.localeCompare(b.fullName);
    });

    // Primary + top 4 most important
    const primary = sorted.find((c) => c.contactId === primaryContactId);
    const others = sorted.filter((c) => c.contactId !== primaryContactId).slice(0, 4);
    return primary ? [primary, ...others] : others.slice(0, 5);
  }, [contacts, primaryContactId, oppCountByContact]);

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <CircularProgress size={24} sx={{ color: theme.palette.text.secondary }} />
      </Box>
    );
  }

  if (accountContacts.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <ContactsIcon sx={{ fontSize: 40, color: alpha(theme.palette.text.secondary, 0.3), mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No CRM contacts for this account
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {accountContacts.map((contact) => {
        const isPrimary = contact.contactId === primaryContactId;
        const oppCount = oppCountByContact[contact.contactId] || 0;
        return (
          <Box
            key={contact.contactId}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: isPrimary ? alpha(theme.palette.warning.main, 0.06) : alpha(theme.palette.action.hover, 0.03),
              border: `1px solid ${isPrimary ? alpha(theme.palette.warning.main, 0.2) : theme.palette.divider}`,
            }}
          >
            {/* Avatar */}
            <Avatar
              sx={{
                width: 36,
                height: 36,
                fontSize: "0.75rem",
                fontWeight: 700,
                bgcolor: isPrimary ? alpha(theme.palette.warning.main, 0.15) : alpha(theme.palette.primary.main, 0.1),
                color: isPrimary ? theme.palette.warning.dark : theme.palette.primary.main,
              }}
            >
              {getInitials(contact.firstName, contact.lastName, contact.fullName)}
            </Avatar>

            {/* Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.25 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.78rem", lineHeight: 1.3 }} noWrap>
                  {contact.fullName}
                </Typography>
                {isPrimary && (
                  <Chip
                    icon={<StarIcon sx={{ fontSize: "0.7rem !important" }} />}
                    label="Primary"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      bgcolor: alpha(theme.palette.warning.main, 0.12),
                      color: theme.palette.warning.dark,
                      "& .MuiChip-icon": { color: theme.palette.warning.dark },
                    }}
                  />
                )}
                {oppCount > 0 && (
                  <Chip
                    label={`${oppCount} opp${oppCount > 1 ? "s" : ""}`}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      color: theme.palette.primary.main,
                    }}
                  />
                )}
              </Box>

              {contact.jobTitle && contact.jobTitle !== "-" && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", fontSize: "0.68rem", lineHeight: 1.3, mb: 0.5 }}
                  noWrap
                >
                  {contact.jobTitle}
                </Typography>
              )}

              {/* Details row */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                {contact.department && contact.department !== "-" && (
                  <Chip
                    icon={<BusinessIcon sx={{ fontSize: "0.65rem !important" }} />}
                    label={contact.department}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.6rem", "& .MuiChip-icon": { ml: 0.5 } }}
                  />
                )}
                {contact.city && contact.city !== "-" && (
                  <Chip
                    icon={<LocationOnIcon sx={{ fontSize: "0.65rem !important" }} />}
                    label={`${contact.city}${contact.country && contact.country !== "-" ? `, ${contact.country}` : ""}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.6rem", "& .MuiChip-icon": { ml: 0.5 } }}
                  />
                )}
              </Box>
            </Box>

            {/* Action icons */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, flexShrink: 0 }}>
              {contact.email && contact.email !== "-" && (
                <Tooltip title={contact.email} placement="left">
                  <IconButton
                    size="small"
                    component="a"
                    href={`mailto:${contact.email}`}
                    sx={{ width: 28, height: 28, color: theme.palette.primary.main }}
                  >
                    <EmailIcon sx={{ fontSize: "0.85rem" }} />
                  </IconButton>
                </Tooltip>
              )}
              {contact.phone && contact.phone !== "-" && (
                <Tooltip title={contact.phone} placement="left">
                  <IconButton
                    size="small"
                    component="a"
                    href={`tel:${contact.phone}`}
                    sx={{ width: 28, height: 28, color: theme.palette.text.secondary }}
                  >
                    <PhoneIcon sx={{ fontSize: "0.85rem" }} />
                  </IconButton>
                </Tooltip>
              )}
              {contact.mobile && contact.mobile !== "-" && (
                <Tooltip title={contact.mobile} placement="left">
                  <IconButton
                    size="small"
                    component="a"
                    href={`tel:${contact.mobile}`}
                    sx={{ width: 28, height: 28, color: theme.palette.text.secondary }}
                  >
                    <SmartphoneIcon sx={{ fontSize: "0.85rem" }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
});

OpportunityContacts.displayName = "OpportunityContacts";
export default OpportunityContacts;
