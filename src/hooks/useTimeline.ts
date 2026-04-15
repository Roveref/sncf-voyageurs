/**
 * Shared Gantt timeline hook.
 *
 * Re-exports the implementation that currently lives in the StaffingTab
 * so multiple tabs (StaffingTab, JobcodeTimelineTab, …) can import from
 * a single stable path without cross-tab imports.
 *
 * The body itself has not moved yet — this shim just gives consumers a
 * shared path to depend on. If the body is ever relocated, only this
 * file changes; its consumers are unaffected.
 */
export { useTimeline } from "../components/StaffingTab/hooks/useTimeline";
