/**
 * Agent output validation — Cross-checks numbers in the answer against tool results.
 *
 * Detects when the agent hallucinates or distorts numbers from tool outputs.
 * Returns warnings that can be appended to the answer or logged.
 */

import { log } from "../utils/logger.js";

interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

/**
 * Extract all numbers from a text (integers and decimals, ignoring dates and IDs).
 */
function extractNumbers(text: string): number[] {
  // Remove dates (YYYY-MM-DD), UUIDs, hex strings
  const cleaned = text
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}/gi, "")
    .replace(/\b[A-Z]{2,3}-[A-Z0-9]+\b/g, "");

  const matches = cleaned.match(/\b\d[\d\s,.]*\d\b|\b\d+\b/g) || [];
  return matches
    .map((m) => parseFloat(m.replace(/\s/g, "").replace(/,/g, ".")))
    .filter((n) => !isNaN(n) && n > 0 && n < 1_000_000_000);
}

/**
 * Validate the agent's answer against the tool results it received.
 *
 * Checks that significant numbers in the answer can be traced back to tool outputs.
 */
export function validateAgentOutput(answer: string, toolResults: string[]): ValidationResult {
  const warnings: string[] = [];

  if (!answer || toolResults.length === 0) {
    return { valid: true, warnings };
  }

  // Extract numbers from answer
  const answerNumbers = extractNumbers(answer);
  if (answerNumbers.length === 0) return { valid: true, warnings };

  // Extract numbers from all tool results
  const toolNumbers = new Set<number>();
  for (const result of toolResults) {
    for (const n of extractNumbers(result)) {
      toolNumbers.add(n);
      // Also add common derived values (percentages, ratios)
      toolNumbers.add(Math.round(n));
      toolNumbers.add(Math.round(n * 10) / 10);
      toolNumbers.add(Math.round(n * 100) / 100);
    }
  }

  // Check each significant number in the answer
  const significantNumbers = answerNumbers.filter((n) => n >= 2 && n !== 100); // Skip trivial numbers
  let untraceableCount = 0;

  for (const num of significantNumbers) {
    // Check if this number (or a close approximation) exists in tool results
    const found =
      toolNumbers.has(num) ||
      toolNumbers.has(Math.round(num)) ||
      toolNumbers.has(Math.round(num * 10) / 10) ||
      // Check for close match (within 1%)
      Array.from(toolNumbers).some((tn) => Math.abs(tn - num) / Math.max(tn, 1) < 0.01);

    if (!found) {
      untraceableCount++;
    }
  }

  // Warn if more than 30% of significant numbers are untraceable
  if (significantNumbers.length > 0 && untraceableCount / significantNumbers.length > 0.3) {
    warnings.push(
      `${untraceableCount}/${significantNumbers.length} numbers in the response do not match any tool result. Please verify the data.`
    );
    log("validation", `WARNING: ${untraceableCount}/${significantNumbers.length} untraceable numbers in answer`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
