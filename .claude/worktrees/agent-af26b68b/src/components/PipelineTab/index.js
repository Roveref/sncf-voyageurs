/**
 * PipelineTab module entry point
 * Exports main component and utilities for external use
 */

import React from "react";
import PipelineTabComponent from "./PipelineTab";

// OPTIMIZED: Wrap in React.memo to prevent unnecessary re-renders
export default React.memo(PipelineTabComponent);

// Export utilities for potential reuse
export * from "./utils";
export * from "./hooks";
export * from "./components";
