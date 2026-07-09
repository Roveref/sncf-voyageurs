/**
 * BU Groups (sidebar « Unit ») : 3 grandes entités de SNCF Voyageurs.
 * Chaque BU englobe ses sites (technicentres, SMR, SMGL).
 * Le match se fait par sous-chaîne dans le nom du site (serviceLine1).
 *   - TER : sites contenant "Technicentre TER"
 *   - IC  : sites contenant "Technicentre IC"
 *   - Transilien : tout le reste (exclude TER et IC)
 */

import { brand } from "../../config/brandConfig";

export const SERVICE_LINE_GROUPS: Record<
  string,
  { name: string; color: string; include?: string[]; exclude?: string[] }
> = {
  Transilien: {
    name: "Transilien",
    color: brand.primary,
    // Exclude TER and IC sites — everything else belongs to Transilien
    exclude: ["Technicentre TER", "Technicentre IC"],
  },
  TER: {
    name: "TER",
    color: "#0EA5E9",
    include: ["Technicentre TER"],
  },
  Intercites: {
    name: "Intercités",
    color: "#F59E0B",
    include: ["Technicentre IC"],
  },
};
