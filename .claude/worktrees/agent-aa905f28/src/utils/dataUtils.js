import * as XLSX from "xlsx";
import { SPECIAL_SEGMENT_CODES, OPERATIONS_SERVICE_LINE } from "./constants";

/**
 * Parses an Excel file once and returns the workbook object
 * @param {ArrayBuffer} fileData - The Excel file data as ArrayBuffer
 * @returns {Object} XLSX workbook object
 */
export const parseWorkbook = (fileData) => {
  if (!fileData) {
    throw new Error("No file data provided");
  }

  const workbook = XLSX.read(fileData, {
    type: "array",
    cellDates: true,
    // cellNF intentionally omitted — not used by our code, saves parsing time
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Excel file does not contain any sheets");
  }

  return workbook;
};

/**
 * Processes opportunity data from a workbook's first sheet
 * @param {Object} workbook - XLSX workbook object (from parseWorkbook)
 * @returns {Array} Processed data as an array of objects
 */
export const processExcelData = async (workbook) => {
  try {
    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
      throw new Error("Could not access the worksheet");
    }

    // Convert to JSON with headers
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Format numbers
      dateNF: "yyyy-mm-dd", // Date format
    });

    if (!data || data.length === 0) {
      throw new Error("No data found in the Excel file");
    }

    // Check if the file has the expected structure
    const requiredColumns = ["Opportunity ID", "Status", "Gross Revenue"];
    const missingColumns = requiredColumns.filter((col) => !data[0].hasOwnProperty(col));

    if (missingColumns.length > 0) {
      throw new Error(`Excel file is missing required columns: ${missingColumns.join(", ")}`);
    }

    // Process and clean the data
    const processedData = data.map((row) => {
      // Convert status to number for easier filtering
      if (row.Status && typeof row.Status === "string") {
        row.Status = parseInt(row.Status, 10);
      }

      // Convert revenue to numbers
      if (row["Gross Revenue"] && typeof row["Gross Revenue"] === "string") {
        row["Gross Revenue"] = parseFloat(row["Gross Revenue"].replace(/,/g, ""));
      }
      if (row["Net Revenue"] && typeof row["Net Revenue"] === "string") {
        row["Net Revenue"] = parseFloat(row["Net Revenue"].replace(/,/g, ""));
      }

      // Convert CM1% to number if it exists
      if (row["CM1%"] && typeof row["CM1%"] === "string") {
        row["CM1%"] = parseFloat(row["CM1%"].replace(/%/g, ""));
      }

      // Ensure service offering percentages are numbers
      if (row["Service Offering 1 %"] && typeof row["Service Offering 1 %"] === "string") {
        row["Service Offering 1 %"] = parseFloat(row["Service Offering 1 %"]);
      }
      if (row["Service Offering 2 %"] && typeof row["Service Offering 2 %"] === "string") {
        row["Service Offering 2 %"] = parseFloat(row["Service Offering 2 %"]);
      }
      if (row["Service Offering 3 %"] && typeof row["Service Offering 3 %"] === "string") {
        row["Service Offering 3 %"] = parseFloat(row["Service Offering 3 %"]);
      }

      if (row["Win %"] && typeof row["Win %"] === "string") {
        // Supprimer le symbole % s'il existe et convertir en nombre
        row["Win %"] = parseFloat(row["Win %"].replace(/%/g, ""));
      } else if (row["Win %"] && typeof row["Win %"] === "number") {
        // Si c'est déjà un nombre, vérifier s'il est en décimal (0.25) ou en pourcentage (25)
        // Si la valeur est <= 1, on suppose que c'est en décimal et on multiplie par 100
        if (row["Win %"] <= 1) {
          row["Win %"] = row["Win %"] * 100;
        }
      }

      // Ensure Job Code is treated as string and trimmed
      if (row["Job Code"] && typeof row["Job Code"] === "string") {
        row["Job Code"] = row["Job Code"].trim();
      }

      return row;
    });

    // Filter out rows where Account is "-" or empty
    return processedData.filter((row) => {
      const account = row["Account"];
      return account && account !== "-" && account.trim() !== "";
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Extracts CRM account data from the "CRM_Accounts" sheet of a workbook
 * @param {Object} workbook - XLSX workbook object (from parseWorkbook)
 * @returns {Array} Array of CRM account objects with Account, Sub Segment Code, Sub Segment
 */
export const extractCRMAccounts = (workbook) => {
  try {
    if (!workbook) return [];

    // Look for the CRM_Accounts sheet
    const crmSheetName = workbook.SheetNames.find((name) => name === "CRM_Accounts");

    if (!crmSheetName) {
      return [];
    }

    const worksheet = workbook.Sheets[crmSheetName];
    if (!worksheet) return [];

    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      dateNF: "yyyy-mm-dd",
      defval: "",
    });

    if (!data || data.length === 0) return [];

    // Extract account data - look for the account name column
    const firstRow = data[0];
    const columns = Object.keys(firstRow);

    // Find the account name column (try common names)
    const accountCol = columns.find(
      (col) =>
        col === "Account" ||
        col === "Account Name" ||
        col.toLowerCase() === "account" ||
        col.toLowerCase() === "account name"
    );

    if (!accountCol) return [];

    // Find segment-related columns if they exist
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

    // Extract and return unique accounts with their segment info
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
    console.warn("Could not extract CRM accounts:", error.message);
    return [];
  }
};

import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

const DB_JSON_PATH = "_dashboard/changes.json";
const ROOT_RELS_PATH = "_rels/.rels";

// --- CRC-32 lookup table (used by patchZipWithEntry) ---
const _crc32Table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  _crc32Table[i] = c;
}

function computeCRC32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = _crc32Table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Patches a ZIP archive by adding or replacing one or more entries.
 * All other entries are preserved byte-for-byte (no re-compression),
 * which prevents Excel file corruption caused by the unzip/rezip cycle.
 *
 * @param {Uint8Array} zipBytes - Original ZIP archive bytes
 * @param {Object.<string, Uint8Array>} newEntries - Map of { path: data } to add/replace
 * @returns {Uint8Array|null} Patched ZIP bytes, or null if unsupported format (ZIP64)
 */
function patchZipWithEntries(zipBytes, newEntries) {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);

  const patchPaths = new Set(Object.keys(newEntries));

  // --- Locate End of Central Directory (EOCD) ---
  let eocdPos = -1;
  for (let i = zipBytes.length - 22; i >= Math.max(0, zipBytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos === -1) return null;

  const totalEntries = view.getUint16(eocdPos + 10, true);
  const cdOffset = view.getUint32(eocdPos + 16, true);

  // ZIP64 detection – bail out to fflate fallback
  if (cdOffset === 0xffffffff || totalEntries === 0xffff) return null;

  // --- Parse Central Directory entries ---
  const entries = [];
  let pos = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) return null;

    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(zipBytes.subarray(pos + 46, pos + 46 + nameLen));
    const cdEntryLen = 46 + nameLen + extraLen + commentLen;

    entries.push({
      name,
      localOffset,
      cdRaw: zipBytes.slice(pos, pos + cdEntryLen),
      cdLen: cdEntryLen,
    });

    pos += cdEntryLen;
  }

  // --- Sort entries by local-header offset to determine byte ranges ---
  const sorted = entries.slice().sort((a, b) => a.localOffset - b.localOffset);

  for (let i = 0; i < sorted.length; i++) {
    // End of this entry's raw bytes = start of next entry (or start of CD)
    sorted[i].localEnd = i + 1 < sorted.length ? sorted[i + 1].localOffset : cdOffset;
  }

  // --- Build the new ZIP ---
  const parts = [];
  const newCDs = [];
  let writePos = 0;

  // Copy all original entries that are NOT being patched
  for (const entry of sorted) {
    if (patchPaths.has(entry.name)) continue; // will be replaced

    const rawLocal = zipBytes.slice(entry.localOffset, entry.localEnd);
    parts.push(rawLocal);

    // Copy CD entry and patch the local-header offset
    const cdCopy = new Uint8Array(entry.cdRaw);
    new DataView(cdCopy.buffer, cdCopy.byteOffset, cdCopy.byteLength).setUint32(42, writePos, true);
    newCDs.push(cdCopy);

    writePos += rawLocal.length;
  }

  // --- Append each new / replacement entry (STORED, method 0) ---
  for (const [entryPath, entryData] of Object.entries(newEntries)) {
    const pathBytes = new TextEncoder().encode(entryPath);
    const crc = computeCRC32(entryData);

    // Local file header
    const lh = new Uint8Array(30 + pathBytes.length);
    const lhv = new DataView(lh.buffer);
    lhv.setUint32(0, 0x04034b50, true); // signature
    lhv.setUint16(4, 20, true); // version needed (2.0)
    lhv.setUint16(8, 0, true); // compression: STORED
    lhv.setUint32(14, crc, true); // CRC-32
    lhv.setUint32(18, entryData.length, true); // compressed size
    lhv.setUint32(22, entryData.length, true); // uncompressed size
    lhv.setUint16(26, pathBytes.length, true); // name length
    lh.set(pathBytes, 30);

    const newLocalOffset = writePos;
    parts.push(lh);
    parts.push(new Uint8Array(entryData));
    writePos += lh.length + entryData.length;

    // Central-directory entry for this file
    const ce = new Uint8Array(46 + pathBytes.length);
    const cev = new DataView(ce.buffer);
    cev.setUint32(0, 0x02014b50, true); // signature
    cev.setUint16(4, 20, true); // version made by
    cev.setUint16(6, 20, true); // version needed
    cev.setUint16(10, 0, true); // compression: STORED
    cev.setUint32(16, crc, true); // CRC-32
    cev.setUint32(20, entryData.length, true); // compressed size
    cev.setUint32(24, entryData.length, true); // uncompressed size
    cev.setUint16(28, pathBytes.length, true); // name length
    cev.setUint32(42, newLocalOffset, true); // local header offset
    ce.set(pathBytes, 46);
    newCDs.push(ce);
  }

  // --- Central Directory block ---
  const newCDOffset = writePos;
  let newCDSize = 0;
  for (const cd of newCDs) {
    parts.push(cd);
    newCDSize += cd.length;
  }

  // --- End of Central Directory ---
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // signature
  ev.setUint16(8, newCDs.length, true); // entries on this disk
  ev.setUint16(10, newCDs.length, true); // total entries
  ev.setUint32(12, newCDSize, true); // CD size
  ev.setUint32(16, newCDOffset, true); // CD offset
  parts.push(eocd);

  // --- Concatenate all parts ---
  const totalSize = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let off = 0;
  for (const p of parts) {
    result.set(p, off);
    off += p.length;
  }

  return result;
}

const CONTENT_TYPES_PATH = "[Content_Types].xml";

/**
 * Ensures [Content_Types].xml declares the "json" extension so Excel
 * does not flag _dashboard/changes.json as unexpected content.
 * Returns the (possibly modified) XML string.
 */
function ensureJsonContentType(contentTypesXml) {
  // Already registered – nothing to do
  if (/Extension=["']json["']/i.test(contentTypesXml)) {
    return contentTypesXml;
  }
  const defaultTag = '<Default Extension="json" ContentType="application/json"/>';
  return contentTypesXml.replace("</Types>", defaultTag + "</Types>");
}

/**
 * Ensures _rels/.rels declares a relationship to _dashboard/changes.json
 * so that Excel preserves the entry when the user edits & saves the file.
 * Without a relationship, Excel strips unrecognised ZIP entries on save.
 */
function ensureDashboardRelationship(relsXml) {
  if (relsXml.includes("_dashboard/changes.json")) return relsXml;
  const rel =
    '<Relationship Id="rId_dashboard" Type="http://schemas.custom/dashboard-changes" Target="_dashboard/changes.json"/>';
  return relsXml.replace("</Relationships>", rel + "</Relationships>");
}

/**
 * Reads dashboard changes from a JSON file embedded inside the XLSX ZIP.
 * Called with raw file bytes (ArrayBuffer), NOT a parsed workbook.
 * @param {ArrayBuffer} fileData - The raw Excel file bytes
 * @returns {Object|null} Parsed changes or null if not found
 */
export const readDashboardChangesFromZip = (fileData) => {
  try {
    // Only decompress the dashboard entry, not the entire XLSX
    const zip = unzipSync(new Uint8Array(fileData), {
      filter: (f) => f.name === DB_JSON_PATH,
    });
    if (!zip[DB_JSON_PATH]) return null;
    const jsonStr = strFromU8(zip[DB_JSON_PATH]);
    const changes = JSON.parse(jsonStr);
    // Restore isManual flags
    if (changes.manualAccounts) {
      changes.manualAccounts = changes.manualAccounts.map((a) => ({ ...a, isManual: true }));
    }
    if (changes.manualOpportunities) {
      changes.manualOpportunities = changes.manualOpportunities.map((o) => ({ ...o, isManual: true }));
    }
    // Ensure staffingNeeds array exists (backward compat with older files)
    if (!changes.staffingNeeds) {
      changes.staffingNeeds = [];
    }
    return changes;
  } catch (error) {
    console.warn("Could not read dashboard changes from ZIP:", error.message);
    return null;
  }
};

/**
 * 3-way merge for dashboard changes.
 * Compares base (snapshot at import), local (current app state), and remote (current file state)
 * to produce a merged result without losing anyone's work.
 *
 * @param {Object} base - State at import time (excelSavedSnapshot parsed)
 * @param {Object} local - Current local changes
 * @param {Object} remote - Current state read from the file
 * @returns {Object} { merged, conflicts, remoteInfo }
 */
export const mergeChanges = (base, local, remote) => {
  const conflicts = [];
  const remoteInfo = { added: [], modified: [], removed: [] };

  // Helper: merge a keyed collection (overrides, opps, accounts)
  const mergeKeyed = (basArr, locArr, remArr, keyFn, label) => {
    const baseMap = new Map((basArr || []).map((i) => [keyFn(i), JSON.stringify(i)]));
    const locMap = new Map((locArr || []).map((i) => [keyFn(i), i]));
    const remMap = new Map((remArr || []).map((i) => [keyFn(i), i]));
    const locStrMap = new Map((locArr || []).map((i) => [keyFn(i), JSON.stringify(i)]));
    const remStrMap = new Map((remArr || []).map((i) => [keyFn(i), JSON.stringify(i)]));

    const allKeys = new Set([...locMap.keys(), ...remMap.keys()]);
    const result = [];

    allKeys.forEach((key) => {
      const inBase = baseMap.has(key);
      const inLoc = locMap.has(key);
      const inRem = remMap.has(key);
      const baseStr = baseMap.get(key);
      const locStr = locStrMap.get(key);
      const remStr = remStrMap.get(key);

      const locChanged = locStr !== baseStr;
      const remChanged = remStr !== baseStr;

      if (inLoc && inRem) {
        if (locStr === remStr) {
          // Both same → keep either
          result.push(locMap.get(key));
        } else if (locChanged && !remChanged) {
          // Only local changed → keep local
          result.push(locMap.get(key));
        } else if (!locChanged && remChanged) {
          // Only remote changed → keep remote
          remoteInfo.modified.push({ type: label, key, item: remMap.get(key) });
          result.push(remMap.get(key));
        } else {
          // Both changed differently → conflict, keep local, report
          conflicts.push({ type: label, key, local: locMap.get(key), remote: remMap.get(key) });
          result.push(locMap.get(key));
        }
      } else if (inLoc && !inRem) {
        if (inBase) {
          // Was in base, still in local, but remote removed it → inform user, don't include
          remoteInfo.removed.push({ type: label, key, item: locMap.get(key) });
        } else {
          // Local added, remote never had it → keep local
          result.push(locMap.get(key));
        }
      } else if (!inLoc && inRem) {
        if (inBase) {
          // Was in base, local removed it, remote still has it → local deletion wins
        } else {
          // Remote added, local never had it → keep remote
          remoteInfo.added.push({ type: label, key, item: remMap.get(key) });
          result.push(remMap.get(key));
        }
      }
    });

    return result;
  };

  // Merge status overrides (keyed by opportunityId)
  const mergedOverrides = mergeKeyed(
    base.statusOverrides,
    local.statusOverrides,
    remote.statusOverrides,
    (o) => o.opportunityId,
    "override"
  );

  // Merge manual opportunities (keyed by Opportunity ID)
  const mergedOpps = mergeKeyed(
    base.manualOpportunities,
    local.manualOpportunities,
    remote.manualOpportunities,
    (o) => o["Opportunity ID"],
    "opportunity"
  );

  // Merge manual accounts (keyed by Account)
  const mergedAccounts = mergeKeyed(
    base.manualAccounts,
    local.manualAccounts,
    remote.manualAccounts,
    (a) => a.Account,
    "account"
  );

  // Merge actions & comments (append-only, deduplicate by timestamp+opportunityId)
  const mergeAppendOnly = (basArr, locArr, remArr) => {
    const makeKey = (item) => `${item.opportunityId}|${item.timestamp}|${item.text || ""}`;
    const seen = new Map();
    [...(locArr || []), ...(remArr || [])].forEach((item) => {
      const k = makeKey(item);
      if (!seen.has(k)) seen.set(k, item);
    });
    return [...seen.values()];
  };

  const mergedActions = mergeAppendOnly(base.actions, local.actions, remote.actions);
  const mergedComments = mergeAppendOnly(base.comments, local.comments, remote.comments);

  // Merge staffing needs (keyed by id, editable items)
  const mergedStaffingNeeds = mergeKeyed(
    base.staffingNeeds,
    local.staffingNeeds,
    remote.staffingNeeds,
    (n) => n.id,
    "staffingNeed"
  );

  const hasRemoteChanges =
    remoteInfo.added.length > 0 || remoteInfo.modified.length > 0 || remoteInfo.removed.length > 0;

  return {
    merged: {
      statusOverrides: mergedOverrides,
      manualOpportunities: mergedOpps,
      manualAccounts: mergedAccounts,
      actions: mergedActions,
      comments: mergedComments,
      staffingNeeds: mergedStaffingNeeds,
    },
    conflicts,
    remoteInfo,
    hasRemoteChanges,
  };
};

/**
 * Reads the remote (saved) dashboard changes from the Excel file without writing.
 * Used for pre-flight conflict detection before saving.
 * @param {FileSystemFileHandle} fileHandle
 * @returns {Object|null} The parsed dashboard changes, or null if none found
 */
export const readRemoteChanges = async (fileHandle) => {
  const file = await fileHandle.getFile();
  const arrayBuffer = await file.arrayBuffer();
  const zipBytes = new Uint8Array(arrayBuffer);
  try {
    const filtered = unzipSync(zipBytes, { filter: (f) => f.name === DB_JSON_PATH });
    if (filtered[DB_JSON_PATH]) {
      return JSON.parse(strFromU8(filtered[DB_JSON_PATH]));
    }
  } catch {
    /* no remote data */
  }
  return null;
};

/**
 * Saves dashboard changes by injecting a JSON file into the XLSX ZIP.
 * Performs 3-way merge to preserve remote changes from other users.
 * Does NOT parse or re-serialize any Excel sheet data - zero OOM risk.
 * @param {FileSystemFileHandle} fileHandle
 * @param {Object} changes - { statusOverrides, manualOpportunities, manualAccounts, actions, comments }
 * @param {string|null} baseSnapshot - JSON string of the state at import time (for merge)
 * @param {Object|null} preResolvedChanges - If provided, skip merge and write these changes directly
 * @returns {Object} { mergeResult, finalChanges }
 */
export const saveChangesToExcel = async (fileHandle, changes, baseSnapshot = null, preResolvedChanges = null) => {
  // IMPORTANT: Acquire writable handle FIRST while user activation is still valid.
  // The File System Access API requires a recent user gesture for createWritable().
  const writable = await fileHandle.createWritable();

  try {
    // Read original file bytes
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    const zipBytes = new Uint8Array(arrayBuffer);

    // Read remote state from the file for merge (only decompress the dashboard entry)
    let mergeResult = null;
    let finalChanges = preResolvedChanges || changes;

    if (!preResolvedChanges && baseSnapshot) {
      let remote = null;
      try {
        const filtered = unzipSync(zipBytes, {
          filter: (f) => f.name === DB_JSON_PATH,
        });
        if (filtered[DB_JSON_PATH]) {
          remote = JSON.parse(strFromU8(filtered[DB_JSON_PATH]));
        }
      } catch {
        /* no remote data */
      }

      if (remote) {
        const base = JSON.parse(baseSnapshot);
        mergeResult = mergeChanges(base, changes, remote);
        finalChanges = mergeResult.merged;
      }
    }

    // Serialize the changes to inject
    const jsonStr = JSON.stringify(finalChanges);
    const jsonBytes = strToU8(jsonStr);

    // Read [Content_Types].xml and ensure the "json" extension is registered,
    // otherwise Excel flags _dashboard/changes.json as unexpected content.
    const entriesToPatch = { [DB_JSON_PATH]: jsonBytes };
    try {
      const ctZip = unzipSync(zipBytes, {
        filter: (f) => f.name === CONTENT_TYPES_PATH,
      });
      if (ctZip[CONTENT_TYPES_PATH]) {
        const original = strFromU8(ctZip[CONTENT_TYPES_PATH]);
        const patched = ensureJsonContentType(original);
        if (patched !== original) {
          entriesToPatch[CONTENT_TYPES_PATH] = strToU8(patched);
        }
      }
    } catch {
      /* keep going – dashboard data is more important */
    }

    // Ensure _rels/.rels declares a relationship to our JSON entry so that
    // Excel preserves it when the user edits & saves the file externally.
    try {
      const relsZip = unzipSync(zipBytes, {
        filter: (f) => f.name === ROOT_RELS_PATH,
      });
      if (relsZip[ROOT_RELS_PATH]) {
        const original = strFromU8(relsZip[ROOT_RELS_PATH]);
        const patched = ensureDashboardRelationship(original);
        if (patched !== original) {
          entriesToPatch[ROOT_RELS_PATH] = strToU8(patched);
        }
      }
    } catch {
      /* keep going – dashboard data is more important */
    }

    // Patch the ZIP at binary level – preserves ALL original entries byte-for-byte,
    // preventing the corruption caused by the old unzipSync/zipSync round-trip.
    let output = patchZipWithEntries(zipBytes, entriesToPatch);

    if (!output) {
      // Fallback for ZIP64 or unrecognised format: use fflate round-trip
      console.warn("patchZipWithEntries failed, falling back to fflate round-trip");
      const zip = unzipSync(zipBytes);
      zip[DB_JSON_PATH] = jsonBytes;
      output = zipSync(zip);
    }

    // Write back to file
    await writable.write(output);
    await writable.close();

    return { mergeResult, finalChanges };
  } catch (error) {
    await writable.abort();
    throw error;
  }
};

/**
 * Gets unique values from a specified column in the data
 * @param {Array} data - The data array
 * @param {string} column - The column name to extract unique values from
 * @returns {Array} Array of unique values
 */
export const getUniqueValues = (data, column) => {
  const values = data
    .map((item) => item[column])
    .filter((value) => value !== undefined && value !== null && value !== "");
  return [...new Set(values)];
};

/**
 * Groups data by a specified column
 * @param {Array} data - The data array
 * @param {string} groupByColumn - The column to group by
 * @returns {Object} Object with groups as keys and arrays as values
 */
export const groupDataBy = (data, groupByColumn) => {
  return data.reduce((acc, item) => {
    const key = item[groupByColumn];
    if (!key) return acc;

    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});
};

/**
 * Calculates sum of a numeric column in data
 * @param {Array} data - The data array
 * @param {string} column - The column to sum
 * @returns {number} Sum of the column values
 */
export const sumBy = (data, column) => {
  return data.reduce((sum, item) => {
    const value = item[column];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
};

/**
 * Calculates revenue with segment and service line logic
 * @param {Object} item - The opportunity item
 * @param {boolean} useNetRevenue - Whether to use net revenue instead of gross
 * @returns {number} Calculated revenue
 */
export const calculateRevenueWithSegmentLogic = (item, showNetRevenue = false) => {
  // Check if segment code is AUTO, CLR, or IEM
  const isSpecialSegmentCode = SPECIAL_SEGMENT_CODES.includes(item["Sub Segment Code"]);

  // If special segment code, return full revenue based on toggle
  if (isSpecialSegmentCode) {
    return showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0;
  }

  // Check each service line (1, 2, and 3)
  // Support both uploaded data (Service Offering X %) and manual opportunities (Allocation X)
  const serviceLines = [
    {
      line: item["Service Line 1"],
      percentage: item["Service Offering 1 %"] || item["Allocation 1"] || 0,
    },
    {
      line: item["Service Line 2"],
      percentage: item["Service Offering 2 %"] || item["Allocation 2"] || 0,
    },
    {
      line: item["Service Line 3"],
      percentage: item["Service Offering 3 %"] || item["Allocation 3"] || 0,
    },
  ];

  // Get the base revenue value based on toggle
  const baseRevenue = showNetRevenue ? item["Net Revenue"] || 0 : item["Gross Revenue"] || 0;

  // Calculate total allocated revenue for Operations
  const operationsAllocation = serviceLines.reduce((total, service) => {
    if (service.line === OPERATIONS_SERVICE_LINE) {
      return total + baseRevenue * (service.percentage / 100);
    }
    return total;
  }, 0);

  // If any Operations allocation is found, return that
  if (operationsAllocation > 0) {
    return operationsAllocation;
  }

  // If no specific Operations allocation, return full revenue
  return 0;
};

/**
 * Groups data by month and year and calculates sum for a specified column
 * @param {Array} data - The data array
 * @param {string} dateColumn - The column containing dates
 * @param {string} valueColumn - The column to sum
 * @returns {Array} Array of { month, year, value } objects
 */
export const getMonthlyYearlyTotals = (data, dateColumn, valueColumn) => {
  const monthlyYearlyData = {};
  const useNetRevenue = valueColumn === "Net Revenue";

  data.forEach((item) => {
    if (!item[dateColumn]) return;

    const date = new Date(item[dateColumn]);
    const month = date.getMonth();
    const year = date.getFullYear();
    const monthYear = `${month}-${year}`;

    if (!monthlyYearlyData[monthYear]) {
      monthlyYearlyData[monthYear] = {
        month,
        year,
        monthName: new Date(year, month, 1).toLocaleString("default", {
          month: "short",
        }),
        total: 0,
        count: 0,
        opportunities: [],
      };
    }

    // Determine the actual value based on valueColumn
    let actualValue;
    if (valueColumn === "Calculated I&O") {
      // Use the revenue calculation method with appropriate parameter
      actualValue = calculateRevenueWithSegmentLogic(item, useNetRevenue);
    } else {
      // Use the direct column value
      actualValue = item[valueColumn] || 0;
    }

    monthlyYearlyData[monthYear].total += actualValue;
    monthlyYearlyData[monthYear].count += 1;
    monthlyYearlyData[monthYear].opportunities.push(item);
  });

  // Convert to array
  return Object.values(monthlyYearlyData);
};
/**
 * Formats monthly yearly data for year-over-year comparison charts
 * @param {Array} monthlyYearlyData - Data from getMonthlyYearlyTotals
 * @returns {Array} Formatted data for YoY chart
 */
export const formatYearOverYearData = (monthlyYearlyData) => {
  // Définir tous les mois de l'année (0-11 car JavaScript commence à 0)
  const allMonths = [];
  for (let i = 0; i < 12; i++) {
    allMonths.push({
      month: i,
      monthName: new Date(2024, i, 1).toLocaleString("default", { month: "short" }),
    });
  }

  // Obtenir toutes les années uniques des données
  const years = [...new Set(monthlyYearlyData.map((item) => item.year))].sort();

  // Créer la structure de base avec tous les mois
  const result = allMonths.map((monthInfo) => {
    const monthData = {
      month: monthInfo.month,
      monthName: monthInfo.monthName,
    };

    // Pour chaque année, initialiser les valeurs à 0
    years.forEach((year) => {
      monthData[`${year}`] = 0;
      monthData[`${year}Count`] = 0;
      monthData[`${year}Opps`] = [];
    });

    return monthData;
  });

  // Remplir avec les données existantes
  monthlyYearlyData.forEach((item) => {
    const monthIndex = item.month; // item.month est déjà 0-11

    if (monthIndex >= 0 && monthIndex < 12) {
      const monthData = result[monthIndex];
      monthData[`${item.year}`] = item.total;
      monthData[`${item.year}Count`] = item.count;
      monthData[`${item.year}Opps`] = item.opportunities || [];
    }
  });

  return result;
};

/**
 * Finds new opportunities based on creation date
 * @param {Array} data - The data array
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Array} Filtered opportunities
 */
export const getNewOpportunities = (data, startDate, endDate) => {
  return data.filter((item) => {
    if (!item["Creation Date"]) return false;

    const creationDate = new Date(item["Creation Date"]);
    return creationDate >= startDate && creationDate <= endDate;
  });
};

/**
 * Finds new wins based on winning date
 * @param {Array} data - The data array
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Array} Filtered opportunities
 */
export const getNewWins = (data, startDate, endDate) => {
  return data.filter((item) => {
    if (!item["Winning Date"] || item["Winning Date"] === "-") return false;

    const winDate = new Date(item["Winning Date"]);
    return winDate >= startDate && winDate <= endDate;
  });
};

/**
 * Finds new losses based on lost date
 * @param {Array} data - The data array
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Array} Filtered opportunities
 */
export const getNewLosses = (data, startDate, endDate) => {
  const lostOpportunities = data.filter((item) => {
    // Check if the opportunity is lost (status 15)
    if (item["Status"] !== 15) {
      return false;
    }

    // Check if lost date exists and is a valid date
    if (!item["Lost Date"] || item["Lost Date"] === "-") {
      return false;
    }

    const lostDate = new Date(item["Lost Date"]);

    // Check if lost date is within the specified range
    return lostDate >= startDate && lostDate <= endDate;
  });

  return lostOpportunities;
};
