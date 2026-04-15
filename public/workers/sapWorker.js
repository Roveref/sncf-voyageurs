// Web Worker for SAP file processing
// This worker processes SAP Excel/CSV files off the main thread to prevent UI freezing

// Import XLSX library from CDN (same pattern as excelWorker.js)
importScripts('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');

// ─── Constants ───────────────────────────────────────────────────────────────

const JOB_CATEGORIES = {
  VACATION: 'vacation',
  RTT: 'rtt',
  LOA: 'loa',
  ILLNESS: 'illness',
  OTHER_ABSENCE: 'other_absence',
  HOLIDAY: 'holiday',
  CHARGEABLE: 'chargeable',
  GENERAL_OPPTY: 'general_oppty',
  PENDING: 'pending',
  OVERTIME: 'overtime',
  TRAVEL: 'travel',
  TRAINING: 'training',
  RESERVATION: 'reservation',
  MEETING: 'meeting',
  EVENT: 'event',
  ADMIN: 'admin',
  CORPORATE: 'corporate',
  COMMUNITY: 'community',
  BUSINESS_DEV: 'business_dev',
  OTHER: 'other',
  UNKNOWN: 'unknown',
  ABSENCE: 'other_absence',
};

const XLS_CODEPAGE = 1252;

// ─── Column aliases for SAP extract auto-detection ───────────────────────────

const COLUMN_ALIASES = {
  date: ['date', 'datum', 'jour', 'tag'],
  empId: ['personnel number', 'personnel no.', 'numéro personnel', 'pers.no.', 'persno', 'pernr', 'matricule', 'pers. number', 'personnel no'],
  name: ['name of employee or applicant', 'employee name', 'nom'],
  receiverOrder: ['receiver order', 'ordre récepteur', 'rec.order'],
  salesOrder: ['rec. sales order', 'rec.sales order', 'sales order', 'commande', 'rec. sales ord.', 'recsales order', 'rec sales order'],
  salesOrderItem: ['recsales ord. item', 'recsalesord. item', 'rec.sales ord. item', 'sales order item', 'poste commande', 'recsales ord.item', 'rec sales ord. item', 'recsalesord.item'],
  absenceType: ['att./absen type', 'att./absence type', 'att./abs. type', 'attendance/absence type', 'type abs./prés.', 'abs type', 'att./abs.type', 'att/absen type', 'att./absentype', 'a/a type', 'absence type'],
  hours: ['hours', 'heures', 'hrs', 'nombre'],
  text: ['text', 'texte', 'description', 'désignation'],
  shortText: ['short text', 'texte court'],
  costCenter: ['sender cost center', 'cost center', 'centre de coûts'],
  activityType: ['activity type', 'act. type', 'act.type', 'aktivitätsart', 'activity typ', 'activitytype'],
};

const FIELD_PRIORITY = [
  'date', 'empId', 'hours', 'absenceType',
  'name', 'salesOrder', 'text',
  'receiverOrder', 'salesOrderItem', 'shortText', 'costCenter', 'activityType',
];

// ─── SAP categorization (mirrors categoryUtils.ts) ───────────────────────────

const categorizeJob = (jobNo) => {
  if (!jobNo) return JOB_CATEGORIES.UNKNOWN;
  const jobNoStr = jobNo.toString().trim();
  if (!jobNoStr) return JOB_CATEGORIES.UNKNOWN;

  switch (jobNoStr) {
    case '9999999996': return JOB_CATEGORIES.RESERVATION;
    case '9999999980': return JOB_CATEGORIES.TRAINING;
    case '9999999910':
    case '9999999911':
    case 'F016':
    case 'F600':
    case 'F605':
    case 'F613':
    case 'F631': return JOB_CATEGORIES.LOA;
    case '0010':
    case '0015':
    case '9999999999': return JOB_CATEGORIES.VACATION;
    case '7777777777': return JOB_CATEGORIES.PENDING;
    case 'F035':
    case 'F036': return JOB_CATEGORIES.RTT;
    case 'F056':
    case 'F210': return JOB_CATEGORIES.ILLNESS;
    case 'F010':
    case 'F014':
    case 'F015':
    case 'F030':
    case 'F032':
    case 'F033':
    case 'F045': return JOB_CATEGORIES.OTHER_ABSENCE;
    case 'F810': return JOB_CATEGORIES.OVERTIME;
    case 'F816':
    case 'F817': return JOB_CATEGORIES.TRAVEL;
    default: {
      if (jobNoStr.length === 6 && /^\d{6}$/.test(jobNoStr)) return JOB_CATEGORIES.GENERAL_OPPTY;
      if (jobNoStr.length === 7 && /^\d{7}$/.test(jobNoStr)) return JOB_CATEGORIES.CHARGEABLE;
      return JOB_CATEGORIES.UNKNOWN;
    }
  }
};

const SAP_VACATION_CODES = new Set(['0010', '0013', '0015']);
const SAP_RTT_CODES = new Set(['F035', 'F036']);
const SAP_LOA_CODES = new Set(['F600', 'F605', 'F613', 'F631', 'F016']);
const SAP_ILLNESS_CODES = new Set(['0200', 'F056', 'F210']);
const SAP_OTHER_ABSENCE_CODES = new Set(['0024', 'F010', 'F014', 'F015', 'F030', 'F032', 'F033', 'F045']);
const SAP_TRAINING_CODES = new Set(['0049']);
const SAP_OVERTIME_CODES = new Set(['F810']);
const SAP_TRAVEL_CODES = new Set(['F816', 'F817']);
const SAP_CHARGEABLE_CODES = new Set(['0800']);
const SAP_MEETING_CODES = new Set(['0061']);
const SAP_EVENT_CODES = new Set(['0062', '0092', '0093']);
const SAP_ADMIN_CODES = new Set(['0077']);
const SAP_CORPORATE_CODES = new Set(['0080']);
const SAP_COMMUNITY_CODES = new Set(['0081']);
const SAP_BUSINESS_DEV_CODES = new Set(['0083']);

const SAP_CODE_MAP = [
  [SAP_VACATION_CODES, JOB_CATEGORIES.VACATION],
  [SAP_RTT_CODES, JOB_CATEGORIES.RTT],
  [SAP_LOA_CODES, JOB_CATEGORIES.LOA],
  [SAP_ILLNESS_CODES, JOB_CATEGORIES.ILLNESS],
  [SAP_OTHER_ABSENCE_CODES, JOB_CATEGORIES.OTHER_ABSENCE],
  [SAP_OVERTIME_CODES, JOB_CATEGORIES.OVERTIME],
  [SAP_TRAVEL_CODES, JOB_CATEGORIES.TRAVEL],
  [SAP_CHARGEABLE_CODES, null],
  [SAP_TRAINING_CODES, JOB_CATEGORIES.TRAINING],
  [SAP_MEETING_CODES, JOB_CATEGORIES.MEETING],
  [SAP_EVENT_CODES, JOB_CATEGORIES.EVENT],
  [SAP_ADMIN_CODES, JOB_CATEGORIES.ADMIN],
  [SAP_CORPORATE_CODES, JOB_CATEGORIES.CORPORATE],
  [SAP_COMMUNITY_CODES, JOB_CATEGORIES.COMMUNITY],
  [SAP_BUSINESS_DEV_CODES, JOB_CATEGORIES.BUSINESS_DEV],
];

const categorizeSapRecord = ({ absenceType, salesOrder }) => {
  const code = (absenceType || '').toString().trim();
  const codeUpper = code.toUpperCase();

  for (const [codeSet, cat] of SAP_CODE_MAP) {
    if (codeSet.has(code) || codeSet.has(codeUpper)) {
      if (cat !== null) return cat;
      return salesOrder ? categorizeJob(salesOrder) : JOB_CATEGORIES.CHARGEABLE;
    }
  }

  if (code === '') return null;
  return JOB_CATEGORIES.UNKNOWN;
};

// ─── Text decoding (mirrors encoding.ts) ─────────────────────────────────────

const decodeText = (arrayBuffer) => {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(arrayBuffer);
  } catch {
    const decoder = new TextDecoder('windows-1252');
    return decoder.decode(arrayBuffer);
  }
};

// ─── Parsing functions (moved from useSapUpload.ts) ──────────────────────────

const scoreHeaderRow = (row) => {
  const normalizedHeaders = row.map((h) => (h || '').toString().toLowerCase().replace(/\s+/g, ' ').trim());
  const mapping = {};
  let score = 0;
  const claimed = new Set();

  const orderedFields = FIELD_PRIORITY.filter((f) => COLUMN_ALIASES[f]);

  orderedFields.forEach((field) => {
    const aliases = COLUMN_ALIASES[field];
    // Pass 1: exact match
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (claimed.has(i)) continue;
      const hdr = normalizedHeaders[i];
      if (!hdr) continue;
      if (aliases.some((alias) => hdr === alias)) {
        mapping[field] = i;
        claimed.add(i);
        score++;
        return;
      }
    }
    // Pass 2: substring match
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (claimed.has(i)) continue;
      const hdr = normalizedHeaders[i];
      if (!hdr) continue;
      if (aliases.some((alias) => hdr.includes(alias))) {
        mapping[field] = i;
        claimed.add(i);
        score++;
        return;
      }
    }
  });

  return { score, mapping };
};

const findHeaderRow = (rows, maxScan = 15) => {
  let bestScore = 0;
  let bestMapping = {};
  let bestIdx = 0;

  const limit = Math.min(rows.length, maxScan);
  for (let r = 0; r < limit; r++) {
    if (!rows[r] || !Array.isArray(rows[r])) continue;
    const { score, mapping } = scoreHeaderRow(rows[r]);
    if (score > bestScore) {
      bestScore = score;
      bestMapping = mapping;
      bestIdx = r;
    }
  }

  return { headerRowIndex: bestIdx, colMap: bestMapping, score: bestScore };
};

const parseSapDate = (dateVal) => {
  if (!dateVal && dateVal !== 0) return null;

  // Excel serial number (most common with raw: true — unambiguous)
  if (typeof dateVal === 'number' && dateVal > 10000 && dateVal < 100000) {
    const d = new Date((dateVal - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null;
    return `${dateVal.getFullYear()}-${String(dateVal.getMonth() + 1).padStart(2, '0')}-${String(dateVal.getDate()).padStart(2, '0')}`;
  }

  const s = dateVal.toString().trim();
  if (!s) return null;

  // MM/DD/YYYY or MM/DD/YY (American format — slash separator)
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let [, month, day, year] = slashMatch;
    if (year.length === 2) year = '20' + year;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // DD.MM.YYYY (European format — dot separator)
  const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // DD-MM-YYYY (European format — dash separator)
  const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, day, month, year] = dashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // YYYY-MM-DD (ISO format)
  const isoMatch = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Serial number as string
  const num = parseFloat(s);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }

  return null;
};

const parseHours = (val) => {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  const s = val.toString().trim().replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const createSapRecord = (row, colMap) => {
  const get = (field) => {
    const idx = colMap[field];
    return idx != null ? (row[idx] != null ? row[idx].toString().trim() : '') : '';
  };

  const dateRaw = colMap.date != null ? row[colMap.date] : null;
  const date = parseSapDate(dateRaw);
  if (!date) return null;

  const empIdRaw = get('empId');
  const empId = empIdRaw.replace(/^0+(?=\d)/, '');
  if (!empId) return null;

  const hours = parseHours(colMap.hours != null ? row[colMap.hours] : null);
  const absenceType = get('absenceType');
  const salesOrder = get('salesOrder');
  const text = get('text') || get('shortText');

  const activityType = get('activityType') || undefined;
  const category = categorizeSapRecord({ absenceType, salesOrder });
  if (!category && !activityType) return null;

  return {
    date,
    empId,
    name: get('name').replace(/^(?:Mme|Mds|Mrs|Mr|Ms|Mlle|M)\.?\s+/i, '').trim(),
    salesOrder,
    salesOrderItem: get('salesOrderItem'),
    absenceType,
    hours,
    text,
    category,
    activityType,
    source: 'sap',
  };
};

const buildSapLookup = (records) => {
  const lookup = {};
  let minDate = null;
  let maxDate = null;

  records.forEach((r) => {
    if (!lookup[r.empId]) lookup[r.empId] = {};
    if (!lookup[r.empId][r.date]) {
      lookup[r.empId][r.date] = { records: [], totalHours: 0, categories: {} };
    }
    const day = lookup[r.empId][r.date];
    day.records.push(r);
    day.totalHours += r.hours;
    if (r.category) day.categories[r.category] = (day.categories[r.category] || 0) + r.hours;

    if (!minDate || r.date < minDate) minDate = r.date;
    if (!maxDate || r.date > maxDate) maxDate = r.date;
  });

  return { lookup, minDate, maxDate };
};

// ─── Main message handler ────────────────────────────────────────────────────

self.onmessage = function (e) {
  const { type, arrayBuffer, fileName } = e.data;
  if (type !== 'processSap') return;

  try {
    self.postMessage({ type: 'progress', percent: 5, message: 'Reading file...' });

    let rows;

    if (fileName.toLowerCase().endsWith('.csv')) {
      const text = decodeText(arrayBuffer);
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length > 0) {
        const commaCount = (lines[0].match(/,/g) || []).length;
        const semiCount = (lines[0].match(/;/g) || []).length;
        const tabCount = (lines[0].match(/\t/g) || []).length;
        const delimiter = tabCount > commaCount && tabCount > semiCount ? '\t' :
          semiCount > commaCount ? ';' : ',';
        rows = lines.map((line) => line.split(delimiter).map((v) => v.trim().replace(/^"(.*)"$/, '$1')));
      } else {
        rows = [];
      }
    } else {
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
        type: 'array',
        codepage: XLS_CODEPAGE,
        cellStyles: true,
        cellDates: false,
        cellNF: true,
        sheetStubs: true,
        raw: true,
      });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: true,
        defval: '',
      });
    }

    self.postMessage({ type: 'progress', percent: 20, message: 'Parsing sheets...' });

    if (rows.length < 2) {
      throw new Error('SAP file appears empty or does not contain enough data');
    }

    const { headerRowIndex, colMap, score } = findHeaderRow(rows);

    if (score < 2) {
      const firstRow = rows[0] || [];
      const preview = firstRow.slice(0, 10).map((v, i) => `[${i}]="${v}"`).join(', ');
      throw new Error(
        `Unable to detect SAP columns (score ${score}/11). ` +
        `Verify the file contains headers: Date, Personnel Number, Hours. ` +
        `First row: ${preview}`
      );
    }

    const requiredFields = ['date', 'empId', 'hours'];
    const missing = requiredFields.filter((f) => colMap[f] == null);
    if (missing.length > 0) {
      const detected = Object.entries(colMap).map(([k, v]) => `${k}→col${v}`).join(', ');
      throw new Error(
        `Missing columns: ${missing.join(', ')}. ` +
        `Headers detected on row ${headerRowIndex + 1}: ${detected}. ` +
        `Check column names.`
      );
    }

    self.postMessage({ type: 'progress', percent: 50, message: 'Processing records...' });

    const dataRows = rows.slice(headerRowIndex + 1);
    let parseFailures = 0;
    const records = [];

    dataRows.forEach((row) => {
      if (!row || !Array.isArray(row)) return;
      const hasData = row.some((v) => v != null && v.toString().trim() !== '');
      if (!hasData) return;

      const rec = createSapRecord(row, colMap);
      if (rec) {
        records.push(rec);
      } else {
        parseFailures++;
      }
    });

    if (records.length === 0) {
      const sampleRow = dataRows.find((r) => r && r.some((v) => v));
      const sampleVals = sampleRow
        ? Object.entries(colMap).map(([k, v]) => `${k}="${sampleRow[v]}"`).join(', ')
        : 'no rows';
      throw new Error(
        `No valid SAP data found (${parseFailures} rows skipped). ` +
        `Header detected on row ${headerRowIndex + 1}. ` +
        `Sample values: ${sampleVals}`
      );
    }

    self.postMessage({ type: 'progress', percent: 80, message: 'Building lookup...' });

    const { lookup, minDate, maxDate } = buildSapLookup(records);

    const empIds = [...new Set(records.map((r) => r.empId))];
    const dates = new Set(records.map((r) => r.date));

    self.postMessage({ type: 'progress', percent: 100, message: 'Done' });

    self.postMessage({
      type: 'result',
      sapData: {
        records,
        lookup,
        minDate,
        maxDate,
        totalRecords: records.length,
        totalEmployees: empIds.length,
        totalDays: dates.size,
        employeeIds: empIds,
        parseFailures,
      },
      fileName,
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
