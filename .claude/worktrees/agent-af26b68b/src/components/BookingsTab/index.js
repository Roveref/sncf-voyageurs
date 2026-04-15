/**
 * BookingsTab Module
 * Main entry point for the BookingsTab component
 * Exports the main component and maintains backward compatibility
 */

import React from "react";
import BookingsTabComponent from "./BookingsTab";

// OPTIMIZED: Wrap in React.memo to prevent unnecessary re-renders
export default React.memo(BookingsTabComponent);

// Re-export sub-components for advanced usage (optional)
export * from "./components";

// Re-export hooks for reusability (optional)
export * from "./hooks";
