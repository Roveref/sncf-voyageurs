/**
 * Column signatures for auto-detecting file types.
 * Each entry maps a file type to an array of known column header keywords (lowercased).
 * The more keywords match, the higher the score.
 */

type FileType = "opportunity" | "sap" | "skills" | "staffing";

interface FileDetectionResult {
  type: FileType;
  confidence: number;
  scores: Partial<Record<FileType, number>>;
}

const FILE_SIGNATURES: Record<FileType, string[]> = {
  opportunity: [
    "opportunity id",
    "gross revenue",
    "net revenue",
    "account",
    "service line",
    "win %",
    "cm1%",
    "service offering",
    "opportunity",
    "job code",
    "sub segment",
    "segment code",
  ],
  sap: [
    "personnel number",
    "personnel no.",
    "pers.no.",
    "persno",
    "pernr",
    "att./absen",
    "att./abs",
    "attendance/absence",
    "rec. sales order",
    "rec.sales order",
    "sales order",
    "sender cost center",
    "cost center",
    "receiver order",
  ],
  skills: [
    "compétence",
    "competence",
    "skill",
    "id client",
    "idclient",
    "id_client",
    "catégorie",
    "categorie",
    "appétence",
    "appetence",
    "niveau",
  ],
  staffing: [
    "empid",
    "lastname",
    "firstname",
    "jobno",
    "jobname",
    "startdate",
    "enddate",
    "utilization",
    "emp id",
    "employee id",
    "last name",
    "first name",
    "job no",
    "job name",
    "job number",
    "start date",
    "end date",
    "working days",
    "hours per day",
    "matricule",
    "prénom",
    "prenom",
    "nom",
  ],
};

/**
 * SAP-specific keywords that should NOT count as generic matches for other types.
 */
const SAP_BONUS_KEYWORDS = ["date", "datum", "jour", "tag", "hours", "heures", "hrs"];

/**
 * Score how well a set of headers matches a file type signature.
 */
const scoreFileType = (normalizedHeaders: string[], fileType: FileType): number => {
  const keywords = FILE_SIGNATURES[fileType];
  let score = 0;

  for (const keyword of keywords) {
    for (const header of normalizedHeaders) {
      if (!header) continue;
      if (header === keyword) {
        score += 2;
        break;
      }
      if (header.includes(keyword) || keyword.includes(header)) {
        score += 1;
        break;
      }
    }
  }

  if (fileType === "sap" && score > 0) {
    for (const keyword of SAP_BONUS_KEYWORDS) {
      for (const header of normalizedHeaders) {
        if (!header) continue;
        if (header === keyword || header.includes(keyword)) {
          score += 1;
          break;
        }
      }
    }
  }

  return score;
};

/**
 * Extract header rows from a file buffer (Excel or CSV).
 */
const extractRows = async (fileName: string, arrayBuffer: ArrayBuffer): Promise<string[][]> => {
  const name = fileName.toLowerCase();

  if (name.endsWith(".csv")) {
    const decoder = new TextDecoder("utf-8");
    let text: string;
    try {
      text = decoder.decode(arrayBuffer);
    } catch {
      text = new TextDecoder("windows-1252").decode(arrayBuffer);
    }
    const lines = text.split("\n").filter((l) => l.trim());

    const firstLine = lines[0] || "";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const delimiter = tabCount > commaCount && tabCount > semiCount ? "\t" : semiCount > commaCount ? ";" : ",";

    return lines.slice(0, 15).map((line) => line.split(delimiter).map((h) => h.trim().replace(/^"(.*)"$/, "$1")));
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(arrayBuffer, { type: "array", sheetRows: 15 });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) return [];

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as string[][];
};

/**
 * Detect the file type based on column headers.
 */
export const detectFileType = async (fileName: string, arrayBuffer: ArrayBuffer): Promise<FileDetectionResult> => {
  try {
    const rows = await extractRows(fileName, arrayBuffer);
    if (rows.length === 0) return filenameFallback(fileName);

    const bestScores: Record<FileType, number> = { opportunity: 0, sap: 0, skills: 0, staffing: 0 };

    const limit = Math.min(rows.length, 15);
    for (let i = 0; i < limit; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const normalizedHeaders = row.map((h) => (h || "").toString().toLowerCase().trim());

      for (const fileType of Object.keys(FILE_SIGNATURES) as FileType[]) {
        const score = scoreFileType(normalizedHeaders, fileType);
        if (score > bestScores[fileType]) {
          bestScores[fileType] = score;
        }
      }
    }

    let bestType: FileType = "staffing";
    let bestScore = 0;

    for (const [type, score] of Object.entries(bestScores) as [FileType, number][]) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    if (bestScore < 2) {
      return filenameFallback(fileName);
    }

    return { type: bestType, confidence: bestScore, scores: bestScores };
  } catch {
    return filenameFallback(fileName);
  }
};

/**
 * Fallback detection based on filename patterns.
 */
const filenameFallback = (fileName: string): FileDetectionResult => {
  const nameLower = fileName.toLowerCase();
  if (nameLower.includes("sap") || nameLower.includes("cat2")) return { type: "sap", confidence: 1, scores: {} };
  if (
    nameLower.includes("skill") ||
    nameLower.includes("compétence") ||
    nameLower.includes("competence") ||
    nameLower.includes("yourskills")
  )
    return { type: "skills", confidence: 1, scores: {} };
  if (nameLower.includes("pipeline") || nameLower.includes("opportunity") || nameLower.includes("opportunit"))
    return { type: "opportunity", confidence: 1, scores: {} };
  return { type: "staffing", confidence: 0, scores: {} };
};
