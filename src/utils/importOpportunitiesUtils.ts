/**
 * Utility functions for importing manual opportunities from JSON
 * Compatible with StatusOverrideManager export format
 */

import { useUserDataStore } from "../stores/useUserDataStore";
import { STATUS_OPTIONS } from "./statusOptions";
import { formatCurrency } from "./formatters";

const getStatusLabel = (status: string): string => {
  const option = STATUS_OPTIONS.find((s) => String(s.status) === status);
  return option ? option.shortLabel : `Status ${status}`;
};

/**
 * Generate unique Opportunity ID in format M-XXXXXX
 * @param {Array} existingIds - Array of existing IDs to avoid duplicates
 * @returns {string} New unique ID
 */
const generateUniqueId = (existingIds: string[]): string => {
  let id;
  do {
    const random = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    id = `M-${random}`;
  } while (existingIds.includes(id));
  return id;
};

/**
 * Import opportunities from JSON file (opportunities only, no actions/comments)
 * Compatible with StatusOverrideManager export format
 * @param {File} file - The JSON file to import
 * @param {Array} existingData - Existing opportunity data for comparison
 * @param {Function} onSuccess - Callback for success (receives detailed results with comparison data)
 * @param {Function} onError - Callback for error
 */
export const importManualOpportunities = async (
  file: File,
  existingData: any[] = [],
  onSuccess: (result: any) => void,
  onError: (error: string) => void
): Promise<void> => {
  try {
    // Read file content
    const text = await file.text();

    // Parse JSON
    let importData;
    try {
      importData = JSON.parse(text);
    } catch (e) {
      onError("Invalid JSON file. Please select a valid export file.");
      return;
    }

    // Get manual opportunities from the import data
    // Compatible with StatusOverrideManager format
    const manualOpportunities = importData.manualOpportunities || [];

    if (manualOpportunities.length === 0) {
      onError("No manual opportunities found in JSON file");
      return;
    }

    // Get existing opportunities from store
    const existingOpportunities = [...useUserDataStore.getState().manualOpportunities];
    const existingIds = existingOpportunities.map((opp) => opp.opportunityId);

    // Track detailed import results with full comparison data
    const results: { created: any[]; updated: any[]; skipped: any[] } = {
      created: [],
      updated: [],
      skipped: [],
    };

    manualOpportunities.forEach((opp: any) => {
      // Ensure it has the isManual flag
      opp.isManual = true;

      // Generate ID if missing
      if (!opp.opportunityId) {
        opp.opportunityId = generateUniqueId(existingIds);
        existingIds.push(opp.opportunityId);
      }

      const opportunityId = opp.opportunityId;
      const oppName = opp.opportunity || opportunityId;
      const existingIndex = existingOpportunities.findIndex((e) => e.opportunityId === opportunityId);

      // Build imported data summary
      const importedData = {
        name: opp.opportunity || opportunityId,
        account: opp.account || "-",
        status: getStatusLabel(opp.status),
        statusCode: opp.status,
        revenue: formatCurrency(opp.grossRevenue),
        manager: opp.manager || opp.em || "-",
      };

      if (existingIndex !== -1) {
        // Existing opportunity found - compare
        const existingOpp = existingOpportunities[existingIndex];
        const existingStatus = existingOpp.status as number;
        const importStatus = opp.status as number;

        // Build existing data summary
        const existingData = {
          name: existingOpp.opportunity || opportunityId,
          account: existingOpp.account || "-",
          status: getStatusLabel(String(existingStatus)),
          statusCode: existingStatus,
          revenue: formatCurrency(existingOpp.grossRevenue as number),
          manager: existingOpp.manager || existingOpp.em || "-",
        };

        // Skip if existing status is more advanced (higher number or final states 14/15)
        if (existingStatus >= importStatus || existingStatus === 14 || existingStatus === 15) {
          results.skipped.push({
            opportunityId: opportunityId,
            opportunityName: oppName,
            existing: existingData,
            imported: importedData,
            decision: "skipped",
            reason:
              existingStatus === 14
                ? "Existing opportunity is already Booked (final state)"
                : existingStatus === 15
                  ? "Existing opportunity is already Lost (final state)"
                  : `Existing status is more advanced`,
          });
        } else {
          // Update existing opportunity
          existingOpportunities[existingIndex] = opp;
          results.updated.push({
            opportunityId: opportunityId,
            opportunityName: oppName,
            existing: existingData,
            imported: importedData,
            decision: "updated",
            reason: "Imported status is more advanced",
          });
        }
      } else {
        // New opportunity - add to existing opportunities
        existingOpportunities.push(opp);
        results.created.push({
          opportunityId: opportunityId,
          opportunityName: oppName,
          existing: null,
          imported: importedData,
          decision: "created",
          reason: "New opportunity",
        });
      }
    });

    // Save manual opportunities to store
    useUserDataStore.getState().setManualOpportunities(existingOpportunities);

    // Return detailed results (opportunities only)
    onSuccess({
      opportunities: results,
    });
  } catch (error) {
    console.error("Import error:", error);
    onError((error as Error).message || "Failed to import opportunities");
  }
};

/**
 * Export manual opportunities to JSON format
 * Compatible with StatusOverrideManager import format
 * @param {Array} manualOpportunities - Array of manual opportunities to export
 */
export const exportManualOpportunities = (manualOpportunities: any[] = []): Record<string, any> | null => {
  if (manualOpportunities.length === 0) {
    alert("No manual opportunities to export");
    return null;
  }

  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    statusOverrides: [],
    manualOpportunities: manualOpportunities.map((opp) => ({
      ...opp,
      exportedAt: new Date().toISOString(),
    })),
    actionsComments: {
      actions: [],
      comments: [],
    },
  };

  // Create JSON file download
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  const today = new Date().toISOString().split("T")[0];
  link.setAttribute("download", `manual-opportunities-${today}.json`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return exportData;
};
