/**
 * Service Line Groups and Colors
 * Extracted from App.js for better organization
 */

import { serviceLineColors } from "../../config/brandConfig";

export const SERVICE_LINE_GROUPS: Record<
  string,
  { name: string; color: string; include?: string[]; exclude?: string[] }
> = {
  BTU: {
    name: "BTU",
    color: serviceLineColors.BTU, // Bearing Red (R50)
    // BTU includes everything EXCEPT: "Arcwide Services", "Be Products", "Enterprise SAP Transformation"
    exclude: ["Arcwide Services", "Be Products", "Enterprise SAP Transformation"],
  },
  ETU: {
    name: "ETU",
    color: serviceLineColors.ETU, // Warm Grey (G60)
    // ETU includes only "Enterprise SAP Transformation"
    include: ["Enterprise SAP Transformation"],
  },
  Products: {
    name: "Products",
    color: serviceLineColors.Products, // Dark Red (R60)
    // Products includes only "Be Products"
    include: ["Be Products"],
  },
  Arcwide: {
    name: "Arcwide",
    color: serviceLineColors.Arcwide, // Light Grey (G50)
    // Arcwide includes only "Arcwide Services"
    include: ["Arcwide Services"],
  },
};
