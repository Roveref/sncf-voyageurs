/**
 * Export and Import utilities for Actions and Comments
 * Handles JSON export/import for actions and comments data
 * Compatible with StatusOverrideManager export format
 */

/**
 * Export actions and comments to JSON format
 * @param {Array} selectedOpportunities - Array of selected opportunities
 * @param {boolean} exportAll - If true, exports all actions/comments regardless of selection
 * @returns {Object} Export data object
 */
export const exportActionsComments = (selectedOpportunities = [], exportAll = false) => {
  const allActions = [];
  const allComments = [];

  // Fetch all actions and comments from localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    // Get actions
    if (key && key.startsWith("opportunity_actions_")) {
      try {
        const opportunityId = key.replace("opportunity_actions_", "");
        const actions = JSON.parse(localStorage.getItem(key));

        // Filter by selected opportunities if not exporting all
        if (
          exportAll ||
          selectedOpportunities.length === 0 ||
          selectedOpportunities.some((opp) => opp["Opportunity ID"] === opportunityId)
        ) {
          actions.forEach((action) => {
            allActions.push({
              opportunityId: action.opportunityId || opportunityId,
              opportunityName: action.opportunityName || "",
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
        console.error("Error parsing actions:", e);
      }
    }

    // Get comments
    if (key && key.startsWith("opportunity_comments_")) {
      try {
        const opportunityId = key.replace("opportunity_comments_", "");
        const comments = JSON.parse(localStorage.getItem(key));

        // Filter by selected opportunities if not exporting all
        if (
          exportAll ||
          selectedOpportunities.length === 0 ||
          selectedOpportunities.some((opp) => opp["Opportunity ID"] === opportunityId)
        ) {
          comments.forEach((comment) => {
            // Get opportunity name from selected opportunities if available
            const opportunity = selectedOpportunities.find((opp) => opp["Opportunity ID"] === opportunityId);

            allComments.push({
              opportunityId: opportunityId,
              opportunityName: opportunity ? opportunity["Opportunity"] : "",
              id: comment.id,
              author: comment.author,
              text: comment.text,
              commentType: comment.type || "specific",
              createdAt: comment.createdAt,
            });
          });
        }
      } catch (e) {
        console.error("Error parsing comments:", e);
      }
    }
  }

  if (allActions.length === 0 && allComments.length === 0) {
    alert("No actions or comments to export");
    return null;
  }

  // Create export data in unified format (compatible with StatusOverrideManager)
  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    // These fields are for StatusOverrideManager compatibility
    statusOverrides: [],
    manualOpportunities: [],
    // Actions and comments data
    actionsComments: {
      actions: allActions,
      comments: allComments,
    },
  };

  // Create JSON file download
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  const filename =
    selectedOpportunities.length > 0 && !exportAll
      ? `actions_comments_selected_${new Date().toISOString().split("T")[0]}.json`
      : `actions_comments_all_${new Date().toISOString().split("T")[0]}.json`;
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return exportData;
};

/**
 * Import actions and comments from JSON file
 * Returns detailed comparison data for each item
 * @param {File} file - The JSON file to import
 * @returns {Promise} - Resolves with detailed import results
 */
export const importActionsComments = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);

        const results = {
          actions: {
            created: [],
            updated: [],
            skipped: [],
          },
          comments: {
            created: [],
            updated: [],
            skipped: [],
          },
        };

        // Format date for display
        const formatDate = (dateStr) => {
          if (!dateStr) return "-";
          return new Date(dateStr).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
        };

        // Process actions from actionsComments field
        const actions = importData.actionsComments?.actions || [];
        actions.forEach((action) => {
          try {
            const storageKey = `opportunity_actions_${action.opportunityId}`;
            let existingActions = [];
            try {
              const stored = localStorage.getItem(storageKey);
              if (stored) {
                existingActions = JSON.parse(stored);
              }
            } catch (e) {
              console.error("Error reading existing actions:", e);
            }

            const existingIndex = existingActions.findIndex((a) => a.id === action.id);

            // Build imported data summary
            const importedData = {
              description: action.description || "-",
              owner: action.owner || "-",
              status: action.status || "-",
              priority: action.priority || "-",
              dueDate: formatDate(action.dueDate),
            };

            if (existingIndex >= 0) {
              const existingAction = existingActions[existingIndex];

              // Build existing data summary
              const existingData = {
                description: existingAction.description || "-",
                owner: existingAction.owner || "-",
                status: existingAction.status || "-",
                priority: existingAction.priority || "-",
                dueDate: formatDate(existingAction.dueDate),
              };

              // Check what changed
              const changes = [];
              if (existingAction.description !== action.description) changes.push("description");
              if (existingAction.owner !== action.owner) changes.push("owner");
              if (existingAction.status !== action.status) changes.push("status");
              if (existingAction.priority !== action.priority) changes.push("priority");
              if (existingAction.dueDate !== action.dueDate) changes.push("dueDate");

              if (changes.length > 0) {
                // Update existing action
                existingActions[existingIndex] = action;
                localStorage.setItem(storageKey, JSON.stringify(existingActions));

                results.actions.updated.push({
                  id: action.id,
                  opportunityId: action.opportunityId,
                  opportunityName: action.opportunityName || action.opportunityId,
                  existing: existingData,
                  imported: importedData,
                  decision: "updated",
                  reason: `Updated: ${changes.join(", ")}`,
                  changes: changes,
                });
              } else {
                // No changes, skip
                results.actions.skipped.push({
                  id: action.id,
                  opportunityId: action.opportunityId,
                  opportunityName: action.opportunityName || action.opportunityId,
                  existing: existingData,
                  imported: importedData,
                  decision: "skipped",
                  reason: "No changes detected",
                  changes: [],
                });
              }
            } else {
              // New action
              existingActions.push(action);
              localStorage.setItem(storageKey, JSON.stringify(existingActions));

              results.actions.created.push({
                id: action.id,
                opportunityId: action.opportunityId,
                opportunityName: action.opportunityName || action.opportunityId,
                existing: null,
                imported: importedData,
                decision: "created",
                reason: "New action",
                changes: [],
              });
            }
          } catch (e) {
            console.error("Error importing action:", e);
          }
        });

        // Process comments from actionsComments field
        const comments = importData.actionsComments?.comments || [];
        comments.forEach((comment) => {
          try {
            const storageKey = `opportunity_comments_${comment.opportunityId}`;
            let existingComments = [];
            try {
              const stored = localStorage.getItem(storageKey);
              if (stored) {
                existingComments = JSON.parse(stored);
              }
            } catch (e) {
              console.error("Error reading existing comments:", e);
            }

            const existingIndex = existingComments.findIndex((c) => c.id === comment.id);

            // Build imported data summary
            const importedData = {
              text: comment.text || "-",
              author: comment.author || "-",
              type: comment.commentType || "specific",
              createdAt: formatDate(comment.createdAt),
            };

            const newCommentObj = {
              id: comment.id,
              text: comment.text,
              author: comment.author,
              type: comment.commentType || "specific",
              createdAt: comment.createdAt,
            };

            if (existingIndex >= 0) {
              const existingComment = existingComments[existingIndex];

              // Build existing data summary
              const existingData = {
                text: existingComment.text || "-",
                author: existingComment.author || "-",
                type: existingComment.type || "specific",
                createdAt: formatDate(existingComment.createdAt),
              };

              // Check what changed
              const changes = [];
              if (existingComment.text !== comment.text) changes.push("text");
              if (existingComment.author !== comment.author) changes.push("author");

              if (changes.length > 0) {
                // Update existing comment
                existingComments[existingIndex] = newCommentObj;
                localStorage.setItem(storageKey, JSON.stringify(existingComments));

                results.comments.updated.push({
                  id: comment.id,
                  opportunityId: comment.opportunityId,
                  opportunityName: comment.opportunityName || comment.opportunityId,
                  existing: existingData,
                  imported: importedData,
                  decision: "updated",
                  reason: `Updated: ${changes.join(", ")}`,
                  changes: changes,
                });
              } else {
                // No changes, skip
                results.comments.skipped.push({
                  id: comment.id,
                  opportunityId: comment.opportunityId,
                  opportunityName: comment.opportunityName || comment.opportunityId,
                  existing: existingData,
                  imported: importedData,
                  decision: "skipped",
                  reason: "No changes detected",
                  changes: [],
                });
              }
            } else {
              // New comment
              existingComments.push(newCommentObj);
              localStorage.setItem(storageKey, JSON.stringify(existingComments));

              results.comments.created.push({
                id: comment.id,
                opportunityId: comment.opportunityId,
                opportunityName: comment.opportunityName || comment.opportunityId,
                existing: null,
                imported: importedData,
                decision: "created",
                reason: "New comment",
                changes: [],
              });
            }
          } catch (e) {
            console.error("Error importing comment:", e);
          }
        });

        resolve(results);
      } catch (e) {
        reject(new Error("Invalid JSON file. Please select a valid export file."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };

    reader.readAsText(file);
  });
};
