/**
 * useServerEventsV2 — React Query replacement for useServerEvents.
 *
 * Same EventSource setup, but SSE events trigger queryClient.invalidateQueries()
 * instead of imperative store updates. The bridge effects in useHydration.ts
 * re-run when refetched data arrives.
 *
 * Exception: crm-updated does a delta merge directly on the React Query cache
 * via queryClient.setQueryData() — no Zustand store involved.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../services/api";
import { queryKeys } from "../queries/queryKeys";
import { useAppStore } from "../stores/useAppStore";
import { useLoadingStore } from "../stores/useLoadingStore";
import { useUserDataStore } from "../stores/useUserDataStore";
import { fLog, fWarn } from "../utils/logger";
import { TAB_ID } from "../utils/tabId";
import type { Opportunity, CrmAccount, CrmContact } from "../types";

// ── Map snake_case Python records to frontend format ──

function mapAccountToFrontend(row: Record<string, unknown>): CrmAccount {
  return {
    accountId: String(row.account_id || ""),
    account: String(row.account || ""),
    subSegmentCode: String(row.sub_segment_code || ""),
    subSegment: String(row.sub_segment || ""),
    country: String(row.country || ""),
    region: String(row.region || ""),
    parentAccount: String(row.parent_account || ""),
  };
}

function mapContactToFrontend(row: Record<string, unknown>): CrmContact {
  return {
    contactId: String(row.contact_id || ""),
    fullName: String(row.fullname || row.full_name || ""),
    firstName: String(row.firstname || row.first_name || ""),
    lastName: String(row.lastname || row.last_name || ""),
    email: String(row.email || ""),
    phone: String(row.phone || ""),
    mobile: String(row.mobile || ""),
    jobTitle: String(row.job_title || ""),
    department: String(row.department || ""),
    city: String(row.city || ""),
    country: String(row.country || ""),
    accountId: String(row.account_id || ""),
    account: String(row.account || ""),
    owner: String(row.owner || ""),
    createdOn: String(row.created_on || ""),
  };
}

// ── Merge helpers ──

function mergeBy<T>(existing: T[], changed: T[], keyFn: (item: T) => string): T[] {
  const map = new Map(existing.map((item) => [keyFn(item), item]));
  for (const item of changed) map.set(keyFn(item), item);
  return Array.from(map.values());
}

const mergeOpps = (existing: Opportunity[], changed: Opportunity[]) =>
  mergeBy(existing, changed, (o) => o.opportunityId);

const mergeAccounts = (existing: CrmAccount[], changed: CrmAccount[]) =>
  mergeBy(existing, changed, (a) => a.accountId || a.account);

const mergeContacts = (existing: CrmContact[], changed: CrmContact[]) => mergeBy(existing, changed, (c) => c.contactId);

// ── Hook ──

export function useServerEventsV2() {
  const queryClient = useQueryClient();
  const connectedRef = useRef(false);

  useEffect(() => {
    if (connectedRef.current) return;
    connectedRef.current = true;

    const token = localStorage.getItem("jwt");
    const url = token ? `${API_BASE}/events?token=${encodeURIComponent(token)}` : `${API_BASE}/events`;
    const es = new EventSource(url);

    // ── crm-updated: delta merge directly into React Query cache ──
    es.addEventListener("crm-updated", (e) => {
      try {
        const data = JSON.parse(e.data);
        let changedOpps = (data.opportunities || []) as Opportunity[];
        let changedAccounts = (data.accounts || []).map(mapAccountToFrontend);
        const changedContacts = (data.contacts || []).map(mapContactToFrontend);

        // Apply hydration filter
        const filter = useAppStore.getState().hydrationFilter;
        if (filter) {
          if (filter.country) {
            changedOpps = changedOpps.filter((o: Record<string, any>) => o.country === filter.country);
            changedAccounts = changedAccounts.filter((a: Record<string, any>) => a.country === filter.country);
          } else if (filter.region) {
            changedOpps = changedOpps.filter((o: Record<string, any>) => o.region === filter.region);
            changedAccounts = changedAccounts.filter((a: Record<string, any>) => a.region === filter.region);
          }
        }

        const total = changedOpps.length + changedAccounts.length + changedContacts.length;
        if (total === 0) return;

        // Patch the CRM query cache in-place (no refetch, no Zustand store)
        // Find the current CRM query key (includes the filter)
        const crmQueryKey = queryKeys.crm(filter ?? {});

        // Read existing cached data to compute revenue delta
        const cachedCrmData = queryClient.getQueryData<any>(crmQueryKey);
        const existingOpps: Opportunity[] = cachedCrmData?.opportunities || [];

        if (changedOpps.length > 0) {
          // Revenue delta
          const existingMap = new Map(existingOpps.map((o) => [o.opportunityId, o]));
          let revDelta = 0;
          for (const opp of changedOpps) {
            const prev = existingMap.get(opp.opportunityId);
            revDelta += (Number(opp.grossRevenue) || 0) - (prev ? Number(prev.grossRevenue) || 0 : 0);
          }

          useAppStore.getState().addLiveChanges(
            changedOpps.map((o: Record<string, any>) => o.opportunityId),
            revDelta
          );

          // Conflict warning for active status overrides
          const overrides = useUserDataStore.getState().statusOverrides;
          const conflicting = changedOpps
            .map((o: Record<string, any>) => o.opportunityId)
            .filter((id: string) => overrides[id] && !overrides[id]._reverted);
          if (conflicting.length > 0) {
            useLoadingStore
              .getState()
              .notify(
                `CRM updated ${conflicting.length} opp(s) with active status override — check for conflicts`,
                "warning"
              );
          }
        }

        // Patch cached CRM query data in-place
        if (cachedCrmData) {
          queryClient.setQueryData(crmQueryKey, (old: any) => {
            if (!old) return old;
            return {
              ...old,
              opportunities:
                changedOpps.length > 0 ? mergeOpps(old.opportunities || [], changedOpps) : old.opportunities,
              crmAccounts:
                changedAccounts.length > 0 ? mergeAccounts(old.crmAccounts || [], changedAccounts) : old.crmAccounts,
              crmContacts:
                changedContacts.length > 0 ? mergeContacts(old.crmContacts || [], changedContacts) : old.crmContacts,
            };
          });
        }

        const parts: string[] = [];
        if (changedOpps.length) parts.push(`${changedOpps.length} opp${changedOpps.length > 1 ? "s" : ""}`);
        if (changedAccounts.length)
          parts.push(`${changedAccounts.length} account${changedAccounts.length > 1 ? "s" : ""}`);
        if (changedContacts.length)
          parts.push(`${changedContacts.length} contact${changedContacts.length > 1 ? "s" : ""}`);
        if (parts.length) fLog("sse", `CRM Δ ${parts.join(", ")}`);
      } catch (err) {
        fWarn("sse", "Failed to parse crm-updated event:", err);
      }
    });

    // ── files-imported: invalidate all staffing-related queries ──
    es.addEventListener("files-imported", () => {
      fLog("sse", "Files imported — invalidating staffing queries...");
      queryClient.invalidateQueries({ queryKey: queryKeys.staffing });
      queryClient.invalidateQueries({ queryKey: queryKeys.sap });
      queryClient.invalidateQueries({ queryKey: queryKeys.metadata });
      queryClient.invalidateQueries({ queryKey: queryKeys.skills });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees });
      queryClient.invalidateQueries({ queryKey: queryKeys.grid });
    });

    // ── user-data-saved: cross-tab/user sync via query invalidation ──
    es.addEventListener("user-data-saved", (e) => {
      let user: string | undefined;
      let changes: string[] = [];
      let affectedOppIds: string[] = [];
      let revenueDelta = 0;
      try {
        const data = JSON.parse(e.data);
        // Skip self-echo: ignore events from this tab
        if (data.tabId && data.tabId === TAB_ID) return;
        user = data.user;
        changes = data.changes || [];
        affectedOppIds = data.affectedOppIds || [];
        revenueDelta = data.revenueDelta || 0;
      } catch {
        // If parsing fails, still process the event
      }
      fLog("sse", "Another tab/user saved data — invalidating changes query...");
      queryClient.invalidateQueries({ queryKey: queryKeys.changes });

      // Feed the live changes counter (CrmDeltaIndicator in AppBar)
      if (affectedOppIds.length > 0) {
        useAppStore.getState().addLiveChanges(affectedOppIds, revenueDelta);
      }

      const who = user && user !== "anonymous" ? user : "Someone";
      const detail = changes.length > 0 ? changes.join(" · ") : "data updated";
      useLoadingStore.getState().notify(`${who}: ${detail}`, "info");
    });

    // ── notification ──
    es.addEventListener("notification", () => {
      useAppStore.getState().bumpSseNotification();
    });

    // ── agent-data-changed: debounced invalidation by scope ──
    let agentHydrateTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingAgentScopes = new Set<string>();

    es.addEventListener("agent-data-changed", (e) => {
      try {
        const data = JSON.parse(e.data);
        pendingAgentScopes.add(data.scope || "changes");

        if (agentHydrateTimer) clearTimeout(agentHydrateTimer);
        agentHydrateTimer = setTimeout(() => {
          const scopes = pendingAgentScopes;
          pendingAgentScopes = new Set();
          fLog("sse", `Agent data changed (debounced, scopes: ${[...scopes].join(", ")})`);

          if (scopes.has("crm")) {
            queryClient.invalidateQueries({ queryKey: ["hydrate", "crm"] });
          }
          if (scopes.has("staffing")) {
            queryClient.invalidateQueries({ queryKey: queryKeys.staffing });
            queryClient.invalidateQueries({ queryKey: queryKeys.sap });
            queryClient.invalidateQueries({ queryKey: queryKeys.employees });
            queryClient.invalidateQueries({ queryKey: queryKeys.grid });
          }
          // Always invalidate changes
          queryClient.invalidateQueries({ queryKey: queryKeys.changes });
        }, 500);
      } catch (err) {
        fWarn("sse", "Failed to parse agent-data-changed event:", err);
      }
    });

    // ── Reconnection: invalidate everything to catch up ──
    let wasDisconnected = false;
    es.onerror = () => {
      fWarn("sse", "Connection lost — will auto-reconnect");
      wasDisconnected = true;
    };
    es.onopen = () => {
      if (wasDisconnected) {
        fLog("sse", "Reconnected — invalidating all queries to catch up...");
        wasDisconnected = false;
        queryClient.invalidateQueries({ queryKey: ["hydrate"] });
      }
    };

    return () => {
      connectedRef.current = false;
      if (agentHydrateTimer) clearTimeout(agentHydrateTimer);
      es.close();
    };
  }, [queryClient]);
}
