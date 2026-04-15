/**
 * Segment Code Groups and Colors
 * Extracted from App.js for better organization
 */

export const SEGMENT_CODE_GROUPS = {
  AMD: {
    name: "AMD",
    color: "#FF3D47", // Bearing Red (R50)
    include: ["LSC", "IEM", "AUTO"],
  },
};

// Individual Segment Code colors - using BearingPoint palette
export const SEGMENT_CODE_COLORS = {
  // AMD group members (LSC, IEM, AUTO) - Red family variations
  LSC: "#FF3D47", // Bearing Red (R50)
  IEM: "#CC2931", // Dark Red (R60)
  AUTO: "#99171D", // Deep Red (R70)
  // Other segments - alternating Red and Grey families
  CRL: "#FF787A", // Light Red (R40)
  TMT: "#806659", // Warm Grey (G60)
  UTL: "#98847A", // Medium Grey (G50)
  AMD: "#FF3D47", // Bearing Red (R50)
  CLR: "#B2A59F", // Light Grey (G40)
  FSI: "#CC2931", // Dark Red (R60)
  INS: "#CCC1BC", // Pale Grey (G30)
  PHS: "#99171D", // Deep Red (R70)
  HSC: "#5C4A3F", // Dark Grey
  ERT: "#FFA3A8", // Soft Red (R30)
};

// Get color for a segment code (with fallback)
export const getSegmentColor = (code) => {
  return SEGMENT_CODE_COLORS[code] || "#CCC1BC"; // Default to Pale Grey
};
