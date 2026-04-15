/**
 * StatusOptions — Standalone module (no Zustand dependency).
 *
 * Single source of truth for the status option list.
 * Labels are updated at hydration time from CRM OptionSets (same pattern as STATUS_TEXT, MAGR_TO_GRADE).
 * Consumers import the array directly or the helper to look up a label.
 */

// ── Types ──

export interface StatusOption {
  status: number;
  label: string;
  shortLabel: string;
}

// ── Default status options (overridden at hydration time) ──

export const STATUS_OPTIONS: StatusOption[] = [
  { status: 1, label: "Lead Identified", shortLabel: "Lead" },
  { status: 4, label: "Go Approved", shortLabel: "Go" },
  { status: 6, label: "Proposal Submitted", shortLabel: "Proposal" },
  { status: 11, label: "Client Won", shortLabel: "Won" },
  { status: 13, label: "AEL", shortLabel: "AEL" },
  { status: 14, label: "Booked", shortLabel: "Booked" },
  { status: 15, label: "Lost", shortLabel: "Lost" },
];

/**
 * Update status option labels from CRM OptionSet data.
 * Called once during hydration (same pattern as `STATUS_TEXT` in constants.ts).
 */
export function updateStatusOptionsFromOptionSet(optionset: Record<number, string>): void {
  for (const opt of STATUS_OPTIONS) {
    const label = optionset[opt.status];
    if (label) opt.label = label;
  }
}

/**
 * Look up a status option by its numeric code.
 * Returns undefined if not found.
 */
export function findStatusOption(status: number): StatusOption | undefined {
  return STATUS_OPTIONS.find((o) => o.status === status);
}

/**
 * Get the short label for a status code.
 * Falls back to "Status {code}" if not found.
 */
export function getStatusLabel(status: number): string {
  const option = STATUS_OPTIONS.find((s) => s.status === status);
  return option ? option.shortLabel : `Status ${status}`;
}
