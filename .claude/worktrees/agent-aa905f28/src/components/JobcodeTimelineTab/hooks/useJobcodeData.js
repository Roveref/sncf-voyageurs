/**
 * useJobcodeData Hook
 * Manages jobcode data processing, grouping, and selection
 *
 * Performance optimizations:
 * - useMemo for jobcode grouping computation
 * - useCallback for event handlers
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { JOBCODE_FIELD_NAMES } from "../../../utils/constants";

/**
 * Custom hook for jobcode data management
 * @param {Array} data - Raw opportunities data
 * @param {boolean} loading - Loading state
 * @returns {Object} Jobcode data and handlers
 */
const useJobcodeData = (data, loading) => {
  const [selectedJobcode, setSelectedJobcode] = useState(null);

  // Group opportunities by jobcode with useMemo for performance
  const jobcodes = useMemo(() => {
    if (!data || loading) return [];

    // Detect the jobcode field - try multiple possible field names
    let jobcodeField = null;

    for (const field of JOBCODE_FIELD_NAMES) {
      if (data.some((item) => item[field] !== undefined)) {
        jobcodeField = field;
        break;
      }
    }

    // If no jobcode field is found, try to create one from opportunity ID
    if (!jobcodeField) {
      jobcodeField = "Opportunity ID";
    }

    // Group opportunities by the detected jobcode field
    const jobcodeMap = {};

    data.forEach((opp) => {
      let jobcode;

      if (jobcodeField === "Opportunity ID" && opp[jobcodeField]) {
        // Extract prefix from opportunity ID (e.g., "PRJ-123" from "PRJ-123-456")
        const idParts = String(opp[jobcodeField]).split("-");
        if (idParts.length > 1) {
          jobcode = `${idParts[0]}-${idParts[1]}`;
        } else {
          jobcode = String(opp[jobcodeField]);
        }
      } else {
        // Use the detected jobcode field
        jobcode = opp[jobcodeField];
      }

      // Provide a default and clean up the value
      jobcode = String(jobcode || "Unknown").trim();

      if (!jobcodeMap[jobcode]) {
        jobcodeMap[jobcode] = [];
      }

      jobcodeMap[jobcode].push(opp);
    });

    // Convert to array and sort by most recent opportunity
    const jobcodeArray = Object.entries(jobcodeMap).map(([code, opportunities]) => {
      // Sort opportunities by creation date
      opportunities.sort((a, b) => new Date(a["Creation Date"]) - new Date(b["Creation Date"]));

      // Get the most recent opportunity
      const latestOpp = opportunities[opportunities.length - 1];

      return {
        jobcode: code,
        opportunities: opportunities,
        account: opportunities[0]["Account"] || "Unknown",
        totalRevenue: opportunities.reduce((sum, opp) => sum + (opp["Gross Revenue"] || 0), 0),
        opportunityCount: opportunities.length,
        firstDate: new Date(opportunities[0]["Creation Date"]),
        latestDate: new Date(latestOpp["Creation Date"]),
        status: latestOpp["Status"],
      };
    });

    // Remove the "Unknown" jobcode if it's just one item and there are others
    if (jobcodeArray.length > 1) {
      const filteredArray = jobcodeArray.filter((item) => item.jobcode !== "Unknown");
      if (filteredArray.length > 0) {
        return filteredArray;
      }
    }

    return jobcodeArray;
  }, [data, loading]);

  // Reset selection when data changes
  useEffect(() => {
    setSelectedJobcode(null);
  }, [data, loading]);

  // Handle jobcode selection with useCallback
  const handleJobcodeSelection = useCallback((jobcode) => {
    setSelectedJobcode(jobcode);
  }, []);

  return {
    jobcodes,
    selectedJobcode,
    handleJobcodeSelection,
  };
};

export default useJobcodeData;
