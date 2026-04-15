/**
 * Maps CRM/VAR country names to TopoJSON (world-atlas) geography names.
 * Built from the VAR sheet in Extract_CRM and the world-atlas@2 countries-110m.json.
 *
 * Key: CRM country name (lowercase) → Value: TopoJSON geo.properties.name
 * Only entries where names differ need to be listed.
 */

// Mapping CRM/VAR name → TopoJSON name (only where names differ)
// null = territory too small for the 110m map, skip it
const CRM_TO_TOPO: Record<string, string | null> = {
  // Name differences
  usa: "United States of America",
  "united states": "United States of America",
  "united states of america": "United States of America",
  uk: "United Kingdom",
  "czech republic": "Czechia",
  czechia: "Czechia",
  "ivory coast": "Côte d'Ivoire",
  "côte d'ivoire": "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  "congo, democratic republic of the": "Dem. Rep. Congo",
  "democratic republic of the congo": "Dem. Rep. Congo",
  "dr congo": "Dem. Rep. Congo",
  "congo, republic of the": "Congo",
  "republic of the congo": "Congo",
  "tanzania, united republic of": "Tanzania",
  "united republic of tanzania": "Tanzania",
  "gambia, the": "Gambia",
  "the gambia": "Gambia",
  "central african republic": "Central African Rep.",
  "equatorial guinea": "Eq. Guinea",
  "western sahara": "W. Sahara",
  swaziland: "eSwatini",
  eswatini: "eSwatini",
  "bosnia and herzegovina": "Bosnia and Herz.",
  "bosnia & herzegovina": "Bosnia and Herz.",
  "north macedonia": "Macedonia",
  macedonia: "Macedonia",
  "korea, south": "South Korea",
  "south korea": "South Korea",
  "korea, north": "North Korea",
  "north korea": "North Korea",
  "east timor": "Timor-Leste",
  "timor-leste": "Timor-Leste",
  myanmar: "Myanmar",
  burma: "Myanmar",
  "russian federation": "Russia",
  russia: "Russia",
  "syrian arab republic": "Syria",
  syria: "Syria",
  iran: "Iran",
  palestine: "Palestine",
  "palestinian territories": "Palestine",
  "solomon islands": "Solomon Is.",
  "falkland islands (islas malvinas)": "Falkland Is.",
  "falkland islands": "Falkland Is.",
  "south sudan": "S. Sudan",
  "s. sudan": "S. Sudan",
  "dominican republic": "Dominican Rep.",
  "republic of moldova": "Moldova",
  "moldova, republic of": "Moldova",
  moldova: "Moldova",
  "viet nam": "Vietnam",
  vietnam: "Vietnam",
  "hong kong": "China",
  macau: "China",
  taiwan: "Taiwan",
  "new caledonia": "New Caledonia",

  // Territories too small for 110m map — skip (no false highlight)
  singapore: null,
  liechtenstein: null,
  gibraltar: null,
  bermuda: null,
  "san marino": null,
  monaco: null,
  "cape verde": null,
  comoros: null,
  maldives: null,
  seychelles: null,
  mauritius: null,
  reunion: null,
  mayotte: null,
  "french guiana": null,
  guadeloupe: null,
  martinique: null,
  "french polynesia": null,
  "saint pierre and miquelon": null,
  "sao tome and principe": null,
  "british indian ocean territory": null,
};

/**
 * Convert a CRM/VAR country name to a TopoJSON geography name.
 * Returns null if the territory is too small to appear on the 110m map.
 */
export function crmNameToTopoName(crmName: string): string | null {
  const key = crmName.toLowerCase().trim();
  if (key in CRM_TO_TOPO) return CRM_TO_TOPO[key];
  // Default: return as-is (works for exact matches like France, Germany, etc.)
  return crmName;
}

/**
 * Build a Set of TopoJSON-compatible country names from a list of CRM country names.
 * Skips territories that are null (too small for the map).
 */
export function crmCountriesToTopoNames(crmCountries: string[]): Set<string> {
  const topoNames = new Set<string>();
  for (const country of crmCountries) {
    const topo = crmNameToTopoName(country);
    if (topo) topoNames.add(topo);
  }
  return topoNames;
}

/**
 * Check if a TopoJSON geography name matches any of the highlighted country names.
 */
export function isGeoHighlighted(geoName: string, highlightedNames: Set<string>): boolean {
  return highlightedNames.has(geoName);
}
