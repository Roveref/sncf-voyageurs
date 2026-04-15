/**
 * JobcodeTimelineTab Module Exports
 * Main entry point for the JobcodeTimelineTab component
 */

import React from "react";
import JobcodeTimelineTabComponent from "./JobcodeTimelineTab";

// OPTIMIZED: Wrap in React.memo to prevent unnecessary re-renders
export default React.memo(JobcodeTimelineTabComponent);

// Re-export hooks for external use
export * from "./hooks";

// Re-export utilities for external use
export * from "./utils";

// Re-export components for external use (if needed)
export * from "./components";
