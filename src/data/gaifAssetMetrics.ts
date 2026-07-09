/**
 * Helpers pour lire les métriques GAIF d'un actif.
 *
 * Depuis la refonte SQL GAIF native, les métriques sont stockées en colonnes
 * dédiées sur `assets` (utilizationPct, incidents12m, consoEau,
 * consoElec, consoGaz, surfaceM2, mtbf, mttr, etatAbe).
 *
 * Cette fonction accepte :
 *   - Un objet opportunity complet (nouveau chemin — lit les colonnes natives)
 *   - OU une string lostComment encodée avec le marker ::META:: (legacy)
 *
 * Le fallback legacy permet de supporter les anciennes démos et les imports
 * externes non migrés.
 */

export interface GaifAssetMetrics {
  utilizationPct: number;
  incidents12m: number;
  consoEau: number; // m³/an (immobilier)
  consoElec: number; // kWh/m²/an (immo) ou kWh/an (IO)
  consoGaz: number; // kWh/an (immobilier)
  surfaceM2: number; // m² (immobilier)
  mtbf: number; // heures (IO / Ferroviaire)
  mttr: number; // heures (IO / Ferroviaire)
  etatAbe: "Satisfaisant" | "Acceptable" | "Moyen" | "Insuffisant" | "Non Visité" | "Non Concerné" | null;
  valeurAchat?: number;
}

const EMPTY_METRICS: GaifAssetMetrics = {
  utilizationPct: 0,
  incidents12m: 0,
  consoEau: 0,
  consoElec: 0,
  consoGaz: 0,
  surfaceM2: 0,
  mtbf: 0,
  mttr: 0,
  etatAbe: null,
};

const META_MARKER = " ::META:: ";

/**
 * Shape d'un objet opportunity partiel qui expose les colonnes natives GAIF.
 * Tous les champs sont optionnels pour supporter les objets legacy.
 */
export interface OpportunityLike {
  lostComment?: string | null;
  utilizationPct?: number | null;
  incidents12m?: number | null;
  consoEau?: number | null;
  consoElec?: number | null;
  consoGaz?: number | null;
  surfaceM2?: number | null;
  mtbf?: number | null;
  mttr?: number | null;
  etatAbe?: string | null;
}

/**
 * Retourne `true` si l'objet contient au moins une colonne GAIF native
 * avec une valeur **significative** (non nulle et non zéro).
 * Important : on ne peut pas juste tester `!= null` car les colonnes ont
 * un DEFAULT 0. Il faut distinguer "seedé avec 0" de "seedé avec vraies valeurs".
 */
function hasNativeMetrics(opp: OpportunityLike): boolean {
  const hasNumeric =
    (opp.utilizationPct ?? 0) > 0 ||
    (opp.incidents12m ?? 0) > 0 ||
    (opp.consoEau ?? 0) > 0 ||
    (opp.consoElec ?? 0) > 0 ||
    (opp.consoGaz ?? 0) > 0 ||
    (opp.surfaceM2 ?? 0) > 0 ||
    (opp.mtbf ?? 0) > 0 ||
    (opp.mttr ?? 0) > 0;
  const hasEtat = typeof opp.etatAbe === "string" && opp.etatAbe.length > 0;
  return hasNumeric || hasEtat;
}

/**
 * Extrait les métriques GAIF d'un actif.
 *
 * Priorité :
 *   1. Colonnes natives présentes sur l'objet opportunity (post-refonte SQL)
 *   2. Marker ::META:: dans lostComment (legacy)
 *   3. Valeurs par défaut (zéros)
 *
 * @param source - Objet opportunity complet OU string lostComment
 */
export function parseAssetMetrics(source: OpportunityLike | string | null | undefined): GaifAssetMetrics {
  if (!source) return { ...EMPTY_METRICS };

  // Legacy path : string lostComment avec marker ::META::
  if (typeof source === "string") {
    if (!source.includes(META_MARKER)) return { ...EMPTY_METRICS };
    const [, metaJson] = source.split(META_MARKER);
    try {
      const parsed = JSON.parse(metaJson);
      return { ...EMPTY_METRICS, ...parsed };
    } catch {
      return { ...EMPTY_METRICS };
    }
  }

  // Nouveau chemin : lecture des colonnes natives
  if (hasNativeMetrics(source)) {
    const etat = source.etatAbe;
    const validEtat =
      etat === "Satisfaisant" ||
      etat === "Acceptable" ||
      etat === "Moyen" ||
      etat === "Insuffisant" ||
      etat === "Non Visité" ||
      etat === "Non Concerné"
        ? etat
        : null;
    return {
      utilizationPct: source.utilizationPct ?? 0,
      incidents12m: source.incidents12m ?? 0,
      consoEau: source.consoEau ?? 0,
      consoElec: source.consoElec ?? 0,
      consoGaz: source.consoGaz ?? 0,
      surfaceM2: source.surfaceM2 ?? 0,
      mtbf: source.mtbf ?? 0,
      mttr: source.mttr ?? 0,
      etatAbe: validEtat,
    };
  }

  // Fallback legacy : lostComment ::META:: sur un objet opportunity
  return parseAssetMetrics(source.lostComment);
}

/** Couleurs associées aux états ABE (SNCF Immobilier). */
export const ETAT_ABE_COLORS: Record<string, string> = {
  Satisfaisant: "#10B981",
  Acceptable: "#22C55E",
  Moyen: "#F59E0B",
  Insuffisant: "#EF4444",
  "Non Visité": "#94A3B8",
  "Non Concerné": "#CBD5E1",
};

/** Extrait le commentaire humain (sans la partie ::META::). */
export function humanComment(lostComment: string | null | undefined): string {
  if (!lostComment) return "";
  const [human] = lostComment.split(META_MARKER);
  return human.trim();
}
