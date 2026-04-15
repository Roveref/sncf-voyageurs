// Web Worker for Excel file processing
// This worker processes Excel files off the main thread to prevent UI freezing

// Import XLSX library from CDN
importScripts("https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js");

// Helper function to safely parse numeric values
const parseNumeric = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  // Handle string values that might contain commas
  if (typeof value === "string") {
    value = value.replace(",", ".");
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Normalize a percentage value from raw Excel data.
 * With raw: true, Excel percentage-formatted cells return decimals (25% → 0.25).
 * Plain number cells return the number as-is (25 → 25).
 * Heuristic: if |value| <= 1 and value ≠ 0, assume decimal form → multiply by 100.
 */
const normalizePercentage = (value) => {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/%/g, ""));
    return isNaN(parsed) ? undefined : parsed;
  }
  if (typeof value === "number") {
    if (value !== 0 && Math.abs(value) <= 1) {
      return value * 100;
    }
    return value;
  }
  return undefined;
};

/**
 * Process opportunity data from Excel file with all optimizations:
 * - raw: true (no string→number round-trip)
 * - No cellNF (skips number format parsing)
 * - Single-pass: data cleaning + mappings + unique values collection
 */
const processOpportunityData = (fileData, onProgress) => {
  const dataArray = new Uint8Array(fileData);

  onProgress(15, "Parsing Excel file...");

  // Parse workbook with optimized options
  const workbook = XLSX.read(dataArray, {
    type: "array",
    cellDates: true,
    // cellNF intentionally omitted — not used, saves parsing time
  });

  onProgress(45, "Extracting data...");

  // Process first sheet with raw: true (native types, no formatting overhead)
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error("Could not access the worksheet");
  }

  const data = XLSX.utils.sheet_to_json(worksheet, {
    raw: true,
    dateNF: "yyyy-mm-dd",
  });

  if (!data || data.length === 0) {
    throw new Error("No data found in the Excel file");
  }

  onProgress(53, "Validating columns...");

  // Validate required columns
  const requiredColumns = ["Opportunity ID", "Status", "Gross Revenue"];
  const missingColumns = requiredColumns.filter((col) => !data[0].hasOwnProperty(col));
  if (missingColumns.length > 0) {
    throw new Error(`Excel file is missing required columns: ${missingColumns.join(", ")}`);
  }

  onProgress(56, "Processing " + data.length + " rows...");

  // ── Single-pass processing ────────────────────────────────────────
  // Process data + build segment/service mappings + collect unique values
  // all in ONE iteration (replaces 5+ separate loops on the main thread)
  const segmentMapping = {};
  const serviceMapping = {};
  const uniqueAccounts = new Set();
  const uniqueSubSegmentCodes = new Set();
  const uniqueSubSegments = new Set();
  const uniqueServiceLine1 = new Set();
  const uniqueServiceOfferings = new Set();
  const processedData = [];

  // Report progress every ~20% of rows (gives 4-5 updates during the loop)
  const totalRows = data.length;
  const progressStep = Math.max(1, Math.floor(totalRows / 5));
  // Loop progress maps to 56% → 82% (26% range for the main processing loop)
  const LOOP_START = 56;
  const LOOP_END = 82;

  for (let i = 0; i < totalRows; i++) {
    // Report progress at regular intervals
    if (i > 0 && i % progressStep === 0) {
      const loopFraction = i / totalRows;
      const currentProgress = Math.round(LOOP_START + loopFraction * (LOOP_END - LOOP_START));
      onProgress(currentProgress, "Processing rows... " + i + "/" + totalRows);
    }

    const row = data[i];

    // Filter out rows where Account is "-" or empty
    const account = row["Account"];
    if (!account || account === "-" || (typeof account === "string" && account.trim() === "")) {
      continue;
    }

    // ── Type normalization ──────────────────────────────────────────
    // With raw: true, most values are already native types.
    // Handle edge-case strings that may come through.

    // Status
    if (row.Status != null && typeof row.Status === "string") {
      row.Status = parseInt(row.Status, 10);
    }

    // Revenue (already numbers with raw: true, handle string edge case)
    if (typeof row["Gross Revenue"] === "string") {
      row["Gross Revenue"] = parseFloat(row["Gross Revenue"].replace(/,/g, ""));
    }
    if (typeof row["Net Revenue"] === "string") {
      row["Net Revenue"] = parseFloat(row["Net Revenue"].replace(/,/g, ""));
    }

    // Percentage fields — normalize decimals from Excel percentage format
    const cm1 = normalizePercentage(row["CM1%"]);
    if (cm1 !== undefined) row["CM1%"] = cm1;

    const winPct = normalizePercentage(row["Win %"]);
    if (winPct !== undefined) row["Win %"] = winPct;

    const so1 = normalizePercentage(row["Service Offering 1 %"]);
    if (so1 !== undefined) row["Service Offering 1 %"] = so1;

    const so2 = normalizePercentage(row["Service Offering 2 %"]);
    if (so2 !== undefined) row["Service Offering 2 %"] = so2;

    const so3 = normalizePercentage(row["Service Offering 3 %"]);
    if (so3 !== undefined) row["Service Offering 3 %"] = so3;

    // Job Code → ensure string
    if (row["Job Code"] != null) {
      row["Job Code"] = String(row["Job Code"]).trim();
    }

    processedData.push(row);

    // ── Build mappings & collect unique values in the same pass ──────

    const code = row["Sub Segment Code"];
    const subSegment = row["Sub Segment"];

    if (code && subSegment) {
      if (!segmentMapping[code]) segmentMapping[code] = [];
      if (segmentMapping[code].indexOf(subSegment) === -1) {
        segmentMapping[code].push(subSegment);
      }
    }

    if (account) uniqueAccounts.add(typeof account === "string" ? account : String(account));
    if (code) uniqueSubSegmentCodes.add(code);
    if (subSegment) uniqueSubSegments.add(subSegment);

    const sl1 = row["Service Line 1"];
    if (sl1) uniqueServiceLine1.add(sl1);

    // Service line → offering mappings
    const serviceLines = [
      { line: row["Service Line 1"], offering: row["Service Offering 1"] },
      { line: row["Service Line 2"], offering: row["Service Offering 2"] },
      { line: row["Service Line 3"], offering: row["Service Offering 3"] },
    ];

    serviceLines.forEach(({ line, offering }) => {
      if (line && offering && offering !== "-") {
        const trimLine = typeof line === "string" ? line.trim() : String(line);
        const trimOff = typeof offering === "string" ? offering.trim() : String(offering);
        if (trimLine && trimOff) {
          const compositeKey = `${trimLine}::${trimOff}`;
          if (!serviceMapping[trimLine]) serviceMapping[trimLine] = [];
          if (serviceMapping[trimLine].indexOf(compositeKey) === -1) {
            serviceMapping[trimLine].push(compositeKey);
          }
          uniqueServiceOfferings.add(compositeKey);
        }
      }
    });
  }

  onProgress(83, "Processed " + processedData.length + " valid opportunities");

  onProgress(86, "Extracting CRM accounts...");

  // ── Extract CRM accounts from CRM_Accounts sheet ────────────────
  const crmAccounts = extractCRMAccountsFromWorkbook(workbook);

  // Merge CRM account names into unique accounts set
  crmAccounts.forEach((a) => uniqueAccounts.add(a.Account));

  onProgress(90, "Building filter indexes...");

  return {
    processedData,
    crmAccounts,
    segmentMapping,
    serviceMapping,
    filterOptions: {
      subSegmentCodes: Array.from(uniqueSubSegmentCodes),
      subSegments: Array.from(uniqueSubSegments),
      serviceLine1: Array.from(uniqueServiceLine1),
      serviceOfferings: Array.from(uniqueServiceOfferings).sort(),
      accounts: Array.from(uniqueAccounts),
    },
  };
};

/**
 * Extract CRM accounts from the CRM_Accounts sheet of a workbook
 */
const extractCRMAccountsFromWorkbook = (workbook) => {
  try {
    const crmSheetName = workbook.SheetNames.find((name) => name === "CRM_Accounts");
    if (!crmSheetName) return [];

    const worksheet = workbook.Sheets[crmSheetName];
    if (!worksheet) return [];

    // CRM_Accounts is typically small — raw: false is fine here
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      dateNF: "yyyy-mm-dd",
      defval: "",
    });

    if (!data || data.length === 0) return [];

    const firstRow = data[0];
    const columns = Object.keys(firstRow);

    const accountCol = columns.find(
      (col) =>
        col === "Account" ||
        col === "Account Name" ||
        col.toLowerCase() === "account" ||
        col.toLowerCase() === "account name"
    );
    if (!accountCol) return [];

    const segmentCodeCol = columns.find(
      (col) => col === "Sub Segment Code" || col.toLowerCase() === "sub segment code"
    );
    const subSegmentCol = columns.find((col) => col === "Sub Segment" || col.toLowerCase() === "sub segment");
    const countryCol = columns.find((col) => col === "Country" || col.toLowerCase() === "country");
    const parentCol = columns.find(
      (col) =>
        col === "_be_reportingparent" ||
        col.toLowerCase() === "_be_reportingparent" ||
        col === "Parent Account" ||
        col.toLowerCase() === "parent account" ||
        col.toLowerCase().includes("reportingparent") ||
        col.toLowerCase().includes("parent")
    );

    const accountMap = new Map();
    data.forEach((row) => {
      const accountName = row[accountCol];
      if (accountName && accountName.trim() && accountName !== "-") {
        const trimmedName = accountName.trim();
        if (!accountMap.has(trimmedName)) {
          accountMap.set(trimmedName, {
            Account: trimmedName,
            "Sub Segment Code": segmentCodeCol ? (row[segmentCodeCol] || "").trim() : "",
            "Sub Segment": subSegmentCol ? (row[subSegmentCol] || "").trim() : "",
            Country: countryCol ? (row[countryCol] || "").trim() : "",
            "Parent Account": parentCol ? (row[parentCol] || "").trim() : "",
          });
        }
      }
    });

    return Array.from(accountMap.values());
  } catch (error) {
    return [];
  }
};

// Process staffing data from Excel file
const processStaffingData = (fileData) => {
  try {
    // Ensure we have valid file data
    if (!fileData || !(fileData instanceof ArrayBuffer)) {
      throw new Error("Invalid file data format");
    }

    // Create a Uint8Array from the ArrayBuffer
    const dataArray = new Uint8Array(fileData);

    // Read the Excel file
    const workbook = XLSX.read(dataArray, {
      type: "array",
      cellDates: true,
      // cellNF intentionally omitted
    });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to JSON with raw: false to keep string formatting
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
    });

    // Extract all periods from the first row
    const firstRow = rawData[0];
    const periods = [];

    Object.keys(firstRow).forEach((key) => {
      // Look for period dates in column names (1/4, 16/4, etc.)
      const matches = key.match(/ - (\d+\/\d+)$/);
      if (matches && matches[1]) {
        if (!periods.includes(matches[1])) {
          periods.push(matches[1]);
        }
      }
    });

    // Sort periods chronologically
    periods.sort((a, b) => {
      const [dayA, monthA] = a.split("/").map(Number);
      const [dayB, monthB] = b.split("/").map(Number);

      if (monthA !== monthB) {
        return monthA - monthB;
      }
      return dayA - dayB;
    });

    if (periods.length === 0) {
      throw new Error("No period columns found in Excel file");
    }

    // Process each employee row
    const processedData = rawData.map((row) => {
      // Create a cleaned up employee object
      const employee = {
        team: row["Equipe"],
        role: row["Role"],
        name: row["Nom"],
        arrivalDate: row["Date arrivée"],
        departureDate: row["Date départ"],
        periods: [],
        averageUtilization: 0,
        totalChargeable: 0,
        totalVacation: 0,
        totalLOA: 0,
        totalResNoJC: 0,
        totalResWithJC: 0,
        totalSellOn: 0,
        totalFormation: 0,
        totalAvailable: 0,
      };

      // Process each period
      let totalUtilization = 0;
      let validPeriods = 0;

      periods.forEach((period) => {
        // Extract values with proper key format (e.g., "Ch - 1/4")
        const periodValues = {
          chargeable: parseNumeric(row[`Ch - ${period}`]),
          vacation: parseNumeric(row[`Vac - ${period}`]),
          loa: parseNumeric(row[`LOA - ${period}`]),
          resNoJC: parseNumeric(row[`Res - w/o JC - ${period}`]),
          resWithJC: parseNumeric(row[`Res - w/ JC - ${period}`]),
          sellOn: parseNumeric(row[`Oth - Pending - ${period}`]),
          formation: parseNumeric(row[`Oth - Formation - ${period}`]),
          total: parseNumeric(row[`Total - ${period}`]),
        };

        // Calculate utilization
        const utilization = periodValues.total > 0 ? (periodValues.chargeable / periodValues.total) * 100 : 0;

        // Add to period data
        const periodData = {
          period,
          ...periodValues,
          utilization,
        };

        employee.periods.push(periodData);

        // Update totals if there's available time
        if (periodValues.total > 0) {
          totalUtilization += utilization;
          validPeriods++;

          employee.totalChargeable += periodValues.chargeable;
          employee.totalVacation += periodValues.vacation;
          employee.totalLOA += periodValues.loa;
          employee.totalResNoJC += periodValues.resNoJC;
          employee.totalResWithJC += periodValues.resWithJC;
          employee.totalSellOn += periodValues.sellOn;
          employee.totalFormation += periodValues.formation;
          employee.totalAvailable += periodValues.total;
        }
      });

      // Calculate average utilization
      employee.averageUtilization = validPeriods > 0 ? totalUtilization / validPeriods : 0;

      return employee;
    });

    return processedData;
  } catch (error) {
    throw error;
  }
};

// Listen for messages from the main thread
self.addEventListener("message", (event) => {
  const { type, fileData, fileType, id } = event.data;

  try {
    if (type === "PROCESS_EXCEL") {
      // Send progress update
      self.postMessage({
        type: "PROGRESS",
        progress: 10,
        message: "Reading Excel file...",
        id,
      });

      // Progress reporter — sends updates to the main thread
      const onProgress = (progress, message) => {
        self.postMessage({ type: "PROGRESS", progress, message, id });
      };

      let result;

      if (fileType === "opportunity") {
        result = processOpportunityData(fileData, onProgress);

        onProgress(95, "Finalizing...");
      } else if (fileType === "staffing") {
        // Send progress update
        self.postMessage({
          type: "PROGRESS",
          progress: 30,
          message: "Processing staffing data...",
          id,
        });

        result = { processedData: processStaffingData(fileData) };

        // Send progress update
        self.postMessage({
          type: "PROGRESS",
          progress: 90,
          message: "Finalizing...",
          id,
        });
      } else {
        throw new Error(`Unknown file type: ${fileType}`);
      }

      // Send success message with all processed results
      self.postMessage({
        type: "SUCCESS",
        ...result,
        fileType,
        id,
      });
    }
  } catch (error) {
    // Send error message
    self.postMessage({
      type: "ERROR",
      error: error.message || "Failed to process Excel file",
      id,
    });
  }
});

// Signal that the worker is ready
self.postMessage({
  type: "READY",
});
