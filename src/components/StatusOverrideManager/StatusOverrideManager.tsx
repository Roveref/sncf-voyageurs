/**
 * StatusOverrideManager Component
 * Orchestrator shell — manages shared state, delegates rendering to sub-components.
 */

import React, { memo, useState, useMemo, useEffect, useCallback } from "react";
import { useUserDataStore } from "../../stores/useUserDataStore";
import { useMergedEmployeeData } from "../../hooks/useMergedEmployeeData";
import useScenarioStore from "../../stores/useScenarioStore";
import { deleteScenarioWithCleanup } from "../../stores/helpers";
import { useAppStore } from "../../stores/useAppStore";
import { useUndoStore } from "../../stores/useUndoStore";
import { useImportExport } from "./useImportExport";
import HeaderToggles from "./HeaderToggles";
import ManagementDialog from "./ManagementDialog";
import ResultDialog from "./ResultDialog";
import GroupSettingsDialog from "./GroupSettingsDialog";
import OpportunityPopup from "./OpportunityPopup";

const StatusOverrideManager = memo(
  ({
    opportunityData = [],
    onDeleteManualOpportunity,
    onManualOpportunityUpdated,
    onAddManualOpportunity,
    manualAccounts = [],
    onDeleteManualAccount,
    onClearAllManualOpportunities,
    onClearAllManualAccounts,
    onAddManualAccount,
    showNetRevenue = false,
    showIO = true,
    setEditOpportunity,
    modificationsEnabled = "all",
    onToggleModifications,
  }: any) => {
    // --- Dialog open states ---
    const [open, setOpen] = useState(false);
    const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
    const [resultDialog, setResultDialog] = useState<{ title: string; message: string; severity: string } | null>(null);

    // --- Shared state ---
    const [activeTab, setActiveTab] = useState(0);
    const [confirmClearAll, setConfirmClearAll] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
    const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
    const [popupInitialActionsTab, setPopupInitialActionsTab] = useState<any>(undefined);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [actionsRefreshKey, setActionsRefreshKey] = useState(0);
    const [searchText, setSearchText] = useState("");
    const [collapsedGroups, setCollapsedGroups] = useState(new Set<string>());
    const [allCollapsedMap, setAllCollapsedMap] = useState<Record<string, boolean>>({});
    const allCollapsed = allCollapsedMap[activeTab] || false;
    const [groupBy, setGroupBy] = useState("none");

    // --- Store subscriptions ---
    const statusOverridesMap = useUserDataStore((s) => s.statusOverrides);
    const removeStatusOverride = useUserDataStore((s) => s.removeStatusOverride);
    const clearAllOverrides = useUserDataStore((s) => s.clearAllStatusOverrides);
    const setStatusOverride = useUserDataStore((s) => s.setStatusOverride);
    const storeActions = useUserDataStore((s) => s.opportunityActions);
    const storeNeeds = useUserDataStore((s) => s.staffingNeeds);
    const { mergedMetadata: storeEmployeeMetadata, manualEmployees: storeManualEmployees } = useMergedEmployeeData();
    const storeScenarios = useScenarioStore((s) => s.scenarios);
    // --- Derived data ---
    const getAllOverrides = useMemo(
      () =>
        Object.entries(statusOverridesMap)
          .filter(([, data]) => !data._reverted)
          .map(([id, data]) => ({ opportunityId: id, ...data })),
      [statusOverridesMap]
    );

    const overrideCount = getAllOverrides.length;

    const manualOpportunities = useMemo(() => opportunityData.filter((opp: any) => opp.isManual), [opportunityData]);
    const manualCount = manualOpportunities.length;
    const accountCount = manualAccounts.length;

    const actionsCount = useMemo(() => {
      let count = 0;
      Object.values(storeActions).forEach((items) => {
        count += items.length;
      });
      return count;
    }, [storeActions]);

    const globalFilteredOppIds = useAppStore((s) => s.filteredOppIds);
    const staffingNeedsCount = useMemo(() => {
      let count = 0;
      for (const [opportunityId, items] of Object.entries(storeNeeds)) {
        if (globalFilteredOppIds.size > 0 && !globalFilteredOppIds.has(opportunityId)) continue;
        count += items.length;
      }
      return count;
    }, [storeNeeds, globalFilteredOppIds]);

    const employeesCount = useMemo(() => {
      const metaIds = new Set(Object.keys(storeEmployeeMetadata));
      storeManualEmployees.forEach((e) => metaIds.add(e.empId));
      return metaIds.size;
    }, [storeEmployeeMetadata, storeManualEmployees]);

    const scenariosCount = useMemo(() => storeScenarios.length, [storeScenarios]);

    const empNameMap = useMemo(() => {
      const map = new Map<string, string>();
      Object.entries(storeEmployeeMetadata).forEach(([empId, meta]) => {
        if (meta.name) map.set(empId, meta.name);
      });
      storeManualEmployees.forEach((e) => {
        if (!map.has(e.empId) && e.name) map.set(e.empId, e.name);
      });
      return map;
    }, [storeEmployeeMetadata, storeManualEmployees]);

    const totalCount =
      overrideCount + manualCount + accountCount + actionsCount + staffingNeedsCount + employeesCount + scenariosCount;

    const opportunityMap = useMemo(() => {
      const map: Record<string, any> = {};
      opportunityData.forEach((opp: any) => {
        map[opp.opportunityId] = opp;
      });
      return map;
    }, [opportunityData]);

    // --- Handlers ---
    const handleOpen = useCallback(() => setOpen(true), []);
    const handleClose = useCallback(() => {
      setOpen(false);
      setConfirmClearAll(false);
      setDeleteConfirm(null);
    }, []);

    const handleOpenOpportunityPopup = useCallback((opportunity: any, initialActionsTab?: any) => {
      setSelectedOpportunity(opportunity);
      setPopupInitialActionsTab(initialActionsTab);
    }, []);

    const handleCloseOpportunityPopup = useCallback(() => {
      setSelectedOpportunity(null);
      setPopupInitialActionsTab(undefined);
    }, []);

    const handleClearAll = useCallback(() => {
      // Snapshot current state for undo before clearing
      const ds = useUserDataStore.getState();
      const snapshot = {
        overrides: { ...ds.statusOverrides },
        opportunities: [...ds.manualOpportunities],
        actions: { ...ds.opportunityActions },
        needs: { ...ds.staffingNeeds },
      };

      if (activeTab === 0) {
        useUndoStore.getState().push("Clear all status overrides", () => {
          useUserDataStore.getState().setStatusOverrides(snapshot.overrides);
        });
        clearAllOverrides();
      } else if (activeTab === 1 && onClearAllManualOpportunities) {
        useUndoStore.getState().push("Clear all manual opportunities", () => {
          useUserDataStore.getState().setManualOpportunities(snapshot.opportunities);
        });
        onClearAllManualOpportunities();
      } else if (activeTab === 2 && onClearAllManualAccounts) {
        onClearAllManualAccounts();
      } else if (activeTab === 3) {
        useUndoStore.getState().push("Clear all actions & staffing needs", () => {
          useUserDataStore.getState().setAllOpportunityActions(snapshot.actions);
          useUserDataStore.getState().setAllStaffingNeeds(snapshot.needs);
        });
        ds.setAllOpportunityActions({});
        ds.setAllStaffingNeeds({});
      }
      setConfirmClearAll(false);
      setSelectedItems(new Set());
    }, [activeTab, clearAllOverrides, onClearAllManualOpportunities, onClearAllManualAccounts]);

    const toggleSelect = useCallback((id: string) => {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }, []);

    const toggleSelectAll = useCallback((ids: string[]) => {
      setSelectedItems((prev) => {
        const allSelected = ids.every((id: string) => prev.has(id));
        if (allSelected) return new Set();
        return new Set(ids);
      });
    }, []);

    const isGroupCollapsed = useCallback(
      (groupKey: string) => {
        return allCollapsed ? !collapsedGroups.has(groupKey) : collapsedGroups.has(groupKey);
      },
      [allCollapsed, collapsedGroups]
    );

    const toggleGroupCollapse = useCallback((groupKey: string) => {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(groupKey)) next.delete(groupKey);
        else next.add(groupKey);
        return next;
      });
    }, []);

    // Reset search when tab changes
    useEffect(() => {
      setSearchText("");
    }, [activeTab]);

    const handleDeleteSelected = useCallback(() => {
      if (activeTab === 0) {
        selectedItems.forEach((id) => removeStatusOverride(id as string));
      } else if (activeTab === 1) {
        selectedItems.forEach((id) => onDeleteManualOpportunity && onDeleteManualOpportunity(id as string));
      } else if (activeTab === 2) {
        selectedItems.forEach((id) => onDeleteManualAccount && onDeleteManualAccount(id as string));
      } else if (activeTab === 3) {
        const idsToDelete = new Set(selectedItems);
        const ds = useUserDataStore.getState();
        Object.entries(ds.opportunityActions).forEach(([opportunityId, items]: [string, any[]]) => {
          const filtered = items.filter((item: any) => !idsToDelete.has(item.id));
          if (filtered.length !== items.length) ds.setOpportunityActions(opportunityId, filtered);
        });
      } else if (activeTab === 4) {
        const idsToDelete = new Set(selectedItems);
        const ds = useUserDataStore.getState();
        Object.entries(ds.staffingNeeds).forEach(([opportunityId, items]: [string, any[]]) => {
          const filtered = items.filter((item: any) => !idsToDelete.has(item.id));
          if (filtered.length !== items.length) ds.setStaffingNeeds(opportunityId, filtered);
        });
      } else if (activeTab === 5) {
        const empDs = useUserDataStore.getState();
        selectedItems.forEach((empId) => {
          empDs.deleteOverride(empId as string);
          empDs.removeManualEmployee(empId as string);
        });
      } else if (activeTab === 6) {
        selectedItems.forEach((id) => deleteScenarioWithCleanup(id as string));
      }
      setSelectedItems(new Set());
    }, [activeTab, selectedItems, removeStatusOverride, onDeleteManualOpportunity, onDeleteManualAccount]);

    // Group by change handler
    const handleGroupByChange = useCallback((value: string) => {
      setGroupBy(value);
      setCollapsedGroups(new Set());
      setAllCollapsedMap({ 0: false, 1: false, 2: false, 3: false, 4: false });
    }, []);

    // --- Import/Export ---
    const {
      importResult,
      setImportResult,
      isImporting,
      copied,
      fileInputRef,
      handleCopyReport,
      handleDownloadReport,
      handleExportJSON,
      handleImportFile,
    } = useImportExport({
      getAllOverrides,
      manualOpportunities,
      manualAccounts,
      opportunityMap,
      overrideCount,
      manualCount,
      accountCount,
      totalCount,
      setStatusOverride,
      onManualOpportunityUpdated,
      onAddManualOpportunity,
      onAddManualAccount,
    });

    return (
      <>
        {/* Header toggles (rendered in the toolbar) */}
        <HeaderToggles
          modificationsEnabled={modificationsEnabled}
          onToggleModifications={onToggleModifications}
          onOpenDialog={handleOpen}
        />

        {/* Result Dialog (user_notifications) */}
        <ResultDialog result={resultDialog} onClose={() => setResultDialog(null)} />

        {/* Main Management Dialog */}
        <ManagementDialog
          open={open}
          onClose={handleClose}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          totalCount={totalCount}
          overrideCount={overrideCount}
          manualCount={manualCount}
          accountCount={accountCount}
          actionsCount={actionsCount}
          staffingNeedsCount={staffingNeedsCount}
          employeesCount={employeesCount}
          scenariosCount={scenariosCount}
          searchText={searchText}
          setSearchText={setSearchText}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          handleDeleteSelected={handleDeleteSelected}
          groupBy={groupBy}
          setGroupBy={handleGroupByChange}
          isGroupCollapsed={isGroupCollapsed}
          toggleGroupCollapse={toggleGroupCollapse}
          allCollapsed={allCollapsed}
          allCollapsedMap={allCollapsedMap}
          setAllCollapsedMap={setAllCollapsedMap}
          collapsedGroups={collapsedGroups}
          setCollapsedGroups={setCollapsedGroups}
          groupSettingsOpen={groupSettingsOpen}
          setGroupSettingsOpen={setGroupSettingsOpen}
          manualOpportunities={manualOpportunities}
          manualAccounts={manualAccounts}
          opportunityMap={opportunityMap}
          opportunityData={opportunityData}
          empNameMap={empNameMap}
          handleOpenOpportunityPopup={handleOpenOpportunityPopup}
          handleClearAll={handleClearAll}
          confirmClearAll={confirmClearAll}
          setConfirmClearAll={setConfirmClearAll}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
          onDeleteManualOpportunity={onDeleteManualOpportunity}
          onDeleteManualAccount={onDeleteManualAccount}
          setEditOpportunity={setEditOpportunity}
          setOpen={setOpen}
          importResult={importResult}
          copied={copied}
          fileInputRef={fileInputRef}
          handleCopyReport={handleCopyReport}
          handleDownloadReport={handleDownloadReport}
          handleExportJSON={handleExportJSON}
          handleImportFile={handleImportFile}
          isImporting={isImporting}
        />

        {/* Group Settings Dialog */}
        <GroupSettingsDialog
          open={groupSettingsOpen}
          onClose={() => setGroupSettingsOpen(false)}
          groupBy={groupBy}
          onGroupByChange={handleGroupByChange}
        />

        {/* Opportunity Popup */}
        <OpportunityPopup
          selectedOpportunity={selectedOpportunity}
          onClose={handleCloseOpportunityPopup}
          showNetRevenue={showNetRevenue}
          showIO={showIO}
          onEditFromPopup={(opp) => {
            handleCloseOpportunityPopup();
            setOpen(false);
            if (setEditOpportunity) setEditOpportunity(opp);
          }}
          onManualOpportunityUpdated={onManualOpportunityUpdated}
          initialActionsTab={popupInitialActionsTab}
        />
      </>
    );
  }
);

StatusOverrideManager.displayName = "StatusOverrideManager";

export default StatusOverrideManager;
