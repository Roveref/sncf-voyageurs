/**
 * Decode an ArrayBuffer to string, auto-detecting encoding.
 *
 * Strategy: try UTF-8 first (with fatal: true so it throws on invalid
 * sequences), then fall back to Windows-1252 which is the most common
 * encoding for files exported from Excel in Western Europe.
 */
export const decodeText = (arrayBuffer: ArrayBuffer): string => {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return decoder.decode(arrayBuffer);
  } catch {
    // UTF-8 failed → fall back to Windows-1252
    const decoder = new TextDecoder("windows-1252");
    return decoder.decode(arrayBuffer);
  }
};

/**
 * Default codepage for .xls (BIFF) files: 1252 = Windows Western European.
 * This ensures accented characters (È, É, À, etc.) are decoded correctly
 * when the .xls file doesn't explicitly specify a codepage.
 */
export const XLS_CODEPAGE = 1252;
