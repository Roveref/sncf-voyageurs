import { calculateRevenueWithSegmentLogic } from "./dataUtils";
import { STATUS_TEXT, EXCLUDED_PARTNER_VALUES } from "./constants";

// Alias for statusText
const statusText = STATUS_TEXT;

// Function to get technology partner tags from the three columns
const getTechnologyPartnerTags = (opportunity) => {
  const partners = [
    opportunity["Technology Partner 1"],
    opportunity["Technology Partner 2"],
    opportunity["Technology Partner 3"],
  ].filter((partner) => {
    if (!partner) return false;
    const cleanPartner = String(partner).trim();
    return !EXCLUDED_PARTNER_VALUES.includes(cleanPartner);
  });

  // Remove duplicates and return unique partners
  return [...new Set(partners)];
};

// Safe date formatting
const formatDateSafely = (date) => {
  if (!date) return "N/A";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("fr-FR");
  } catch (e) {
    return "N/A";
  }
};

/**
 * Export opportunities to a JSON file (unified format compatible with StatusOverrideManager)
 * Exports ALL opportunities (CRM + manual) with actions and comments
 * @param {Array} data - Array of opportunity objects (filtered data)
 * @param {Array} selectedOpportunities - Array of selected opportunity objects
 * @param {boolean} isFiltered - Whether the data is filtered
 * @param {boolean} showNetRevenue - Whether to show net revenue (true) or gross revenue (false)
 */
export const exportOpportunities = (data, selectedOpportunities = [], isFiltered = false, showNetRevenue = false) => {
  // Determine which data to export: selected opportunities or all filtered data
  const dataToExport = selectedOpportunities.length > 0 ? selectedOpportunities : data;

  // Ensure data is an array
  const opportunitiesData = Array.isArray(dataToExport) ? dataToExport : [];

  // If no data, show an alert and return
  if (opportunitiesData.length === 0) {
    alert("No opportunities to export.");
    return;
  }

  // Separate manual opportunities (for import compatibility)
  const manualOpportunities = opportunitiesData.filter((opp) => opp.isManual === true);

  // Collect actions and comments for these opportunities
  const allActions = [];
  const allComments = [];

  opportunitiesData.forEach((opp) => {
    const oppId = opp["Opportunity ID"];

    // Get actions
    try {
      const actionsKey = `opportunity_actions_${oppId}`;
      const stored = localStorage.getItem(actionsKey);
      if (stored) {
        const actions = JSON.parse(stored);
        actions.forEach((action) => {
          allActions.push({
            opportunityId: action.opportunityId || oppId,
            opportunityName: action.opportunityName || opp["Opportunity"] || "",
            id: action.id,
            owner: action.owner,
            description: action.description,
            dueDate: action.dueDate,
            priority: action.priority,
            status: action.status,
            createdAt: action.createdAt,
          });
        });
      }
    } catch (e) {
      console.error("Error reading actions:", e);
    }

    // Get comments
    try {
      const commentsKey = `opportunity_comments_${oppId}`;
      const stored = localStorage.getItem(commentsKey);
      if (stored) {
        const comments = JSON.parse(stored);
        comments.forEach((comment) => {
          allComments.push({
            opportunityId: oppId,
            opportunityName: opp["Opportunity"] || "",
            id: comment.id,
            author: comment.author,
            text: comment.text,
            commentType: comment.type || "specific",
            createdAt: comment.createdAt,
          });
        });
      }
    } catch (e) {
      console.error("Error reading comments:", e);
    }
  });

  // Create export data in unified format (compatible with StatusOverrideManager)
  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    exportType: selectedOpportunities.length > 0 ? "selected" : isFiltered ? "filtered" : "all",
    // Full opportunities list (for reference/analysis)
    opportunities: opportunitiesData.map((opp) => ({
      ...opp,
      "I&O Revenue": calculateRevenueWithSegmentLogic(opp, showNetRevenue),
    })),
    // StatusOverrideManager compatible fields
    statusOverrides: [],
    manualOpportunities: manualOpportunities.map((opp) => ({
      ...opp,
      exportedAt: new Date().toISOString(),
    })),
    actionsComments: {
      actions: allActions,
      comments: allComments,
    },
  };

  // Download the JSON file
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  const exportType = selectedOpportunities.length > 0 ? "selected" : isFiltered ? "filtered" : "all";
  const today = new Date().toISOString().split("T")[0];
  link.setAttribute("download", `opportunities-export-${exportType}-${today}.json`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return exportData;
};
