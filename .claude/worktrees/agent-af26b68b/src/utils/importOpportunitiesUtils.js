/**
 * Utility functions for importing manual opportunities from JSON
 * Compatible with StatusOverrideManager export format
 */

import { STATUS_OPTIONS } from "../contexts/StatusOverrideContext";

const getStatusLabel = (status) => {
  const option = STATUS_OPTIONS.find((s) => s.status === status);
  return option ? option.shortLabel : `Status ${status}`;
};

/**
 * Generate unique Opportunity ID in format M-XXXXXX
 * @param {Array} existingIds - Array of existing IDs to avoid duplicates
 * @returns {string} New unique ID
 */
const generateUniqueId = (existingIds) => {
  let id;
  do {
    const random = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    id = `M-${random}`;
  } while (existingIds.includes(id));
  return id;
};

/**
 * Format currency value
 */
const formatCurrency = (value) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
};

/**
 * Import opportunities from JSON file (opportunities only, no actions/comments)
 * Compatible with StatusOverrideManager export format
 * @param {File} file - The JSON file to import
 * @param {Array} existingData - Existing opportunity data for comparison
 * @param {Function} onSuccess - Callback for success (receives detailed results with comparison data)
 * @param {Function} onError - Callback for error
 */
export const importManualOpportunities = async (file, existingData = [], onSuccess, onError) => {
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

    // Get existing opportunities from localStorage
    const existingOpportunities = JSON.parse(localStorage.getItem("manual_opportunities") || "[]");
    const existingIds = existingOpportunities.map((opp) => opp["Opportunity ID"]);

    // Track detailed import results with full comparison data
    const results = {
      created: [],
      updated: [],
      skipped: [],
    };

    manualOpportunities.forEach((opp) => {
      // Ensure it has the isManual flag
      opp.isManual = true;

      // Generate ID if missing
      if (!opp["Opportunity ID"]) {
        opp["Opportunity ID"] = generateUniqueId(existingIds);
        existingIds.push(opp["Opportunity ID"]);
      }

      const oppId = opp["Opportunity ID"];
      const oppName = opp["Opportunity"] || oppId;
      const existingIndex = existingOpportunities.findIndex((e) => e["Opportunity ID"] === oppId);

      // Build imported data summary
      const importedData = {
        name: opp["Opportunity"] || oppId,
        account: opp["Account"] || "-",
        status: getStatusLabel(opp["Status"]),
        statusCode: opp["Status"],
        revenue: formatCurrency(opp["Gross Revenue"]),
        manager: opp["Manager"] || opp["EM"] || "-",
      };

      if (existingIndex !== -1) {
        // Existing opportunity found - compare
        const existingOpp = existingOpportunities[existingIndex];
        const existingStatus = existingOpp["Status"];
        const importStatus = opp["Status"];

        // Build existing data summary
        const existingData = {
          name: existingOpp["Opportunity"] || oppId,
          account: existingOpp["Account"] || "-",
          status: getStatusLabel(existingStatus),
          statusCode: existingStatus,
          revenue: formatCurrency(existingOpp["Gross Revenue"]),
          manager: existingOpp["Manager"] || existingOpp["EM"] || "-",
        };

        // Skip if existing status is more advanced (higher number or final states 14/15)
        if (existingStatus >= importStatus || existingStatus === 14 || existingStatus === 15) {
          results.skipped.push({
            opportunityId: oppId,
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
            opportunityId: oppId,
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
          opportunityId: oppId,
          opportunityName: oppName,
          existing: null,
          imported: importedData,
          decision: "created",
          reason: "New opportunity",
        });
      }
    });

    // Save manual opportunities to localStorage
    localStorage.setItem("manual_opportunities", JSON.stringify(existingOpportunities));

    // Return detailed results (opportunities only)
    onSuccess({
      opportunities: results,
    });
  } catch (error) {
    console.error("Import error:", error);
    onError(error.message || "Failed to import opportunities");
  }
};

/**
 * Export manual opportunities to JSON format
 * Compatible with StatusOverrideManager import format
 * @param {Array} manualOpportunities - Array of manual opportunities to export
 */
export const exportManualOpportunities = (manualOpportunities = []) => {
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
