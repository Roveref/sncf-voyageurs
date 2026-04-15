/**
 * Service Line Groups and Colors
 * Extracted from App.js for better organization
 */

export const SERVICE_LINE_GROUPS = {
  BTU: {
    name: "BTU",
    color: "#FF3D47", // Bearing Red (R50)
    // BTU includes everything EXCEPT: "Arcwide Services", "Be Products", "Enterprise SAP Transformation"
    exclude: ["Arcwide Services", "Be Products", "Enterprise SAP Transformation"],
  },
  ETU: {
    name: "ETU",
    color: "#806659", // Warm Grey (G60)
    // ETU includes only "Enterprise SAP Transformation"
    include: ["Enterprise SAP Transformation"],
  },
  Products: {
    name: "Products",
    color: "#CC2931", // Dark Red (R60)
    // Products includes only "Be Products"
    include: ["Be Products"],
  },
  Arcwide: {
    name: "Arcwide",
    color: "#98847A", // Light Grey (G50)
    // Arcwide includes only "Arcwide Services"
    include: ["Arcwide Services"],
  },
};
