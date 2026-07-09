/**
 * Matrice de criticité GAIF — occurrence × impact (4×4).
 * Source : Prescription "Définition de la criticité des actifs IF" Transilien.
 */

export const CRITICITY_AXES = {
  occurrence: [
    { level: 0, label: "Improbable", color: "#DCFCE7" },
    { level: 1, label: "Rare", color: "#FEF3C7" },
    { level: 2, label: "Probable", color: "#FED7AA" },
    { level: 3, label: "Fréquente", color: "#FECACA" },
  ],
  impact: [
    { level: 0, label: "Faible" },
    { level: 1, label: "Moyen" },
    { level: 2, label: "Fort" },
    { level: 3, label: "Elevé" },
  ],
};

/**
 * Couleur de la cellule en fonction du score combiné occurrence × impact.
 * 0-2: vert / 3-4: jaune / 5-6: orange / 7+: rouge
 */
export function getCriticityCellColor(occurrence: number, impact: number, isDark = false): string {
  const score = occurrence + impact;
  if (score <= 2) return isDark ? "#064E3B" : "#D1FAE5";
  if (score <= 4) return isDark ? "#78350F" : "#FEF3C7";
  if (score <= 5) return isDark ? "#7C2D12" : "#FED7AA";
  return isDark ? "#7F1D1D" : "#FECACA";
}

/**
 * Exemples d'actifs à positionner dans la matrice par patrimoine.
 * (Illustratif ; la position réelle est calculée en temps réel depuis les données)
 */
export const CRITICITY_EXAMPLES: Record<string, Array<{ name: string; occurrence: number; impact: number }>> = {
  Ferroviaire: [
    { name: "ADV entrée/sortie faisceau", occurrence: 2, impact: 3 },
    { name: "Poste signalisation N1/N0", occurrence: 1, impact: 3 },
    { name: "Appareils IFTE — point d'alim", occurrence: 2, impact: 3 },
    { name: "Signalisation en campagne", occurrence: 1, impact: 1 },
    { name: "Escabelles & estacades", occurrence: 0, impact: 0 },
    { name: "Caténaire 1500V", occurrence: 1, impact: 2 },
  ],
  Immobilier: [
    { name: "Portes ferroviaires", occurrence: 2, impact: 3 },
    { name: "Structure de bâtiments", occurrence: 0, impact: 3 },
    { name: "Charpente / couverture", occurrence: 1, impact: 3 },
    { name: "Monte-charges", occurrence: 1, impact: 3 },
    { name: "Courant fort / faible", occurrence: 1, impact: 2 },
    { name: "Réseaux humides (AEP)", occurrence: 1, impact: 2 },
    { name: "Équipements incendie", occurrence: 1, impact: 2 },
    { name: "Sol des locaux", occurrence: 0, impact: 1 },
    { name: "Chauffage / CVC", occurrence: 1, impact: 1 },
  ],
  IO: [
    { name: "Tour en fosse", occurrence: 2, impact: 3 },
    { name: "Vérin en fosse", occurrence: 2, impact: 3 },
    { name: "Banc de mesure essieux", occurrence: 1, impact: 3 },
    { name: "Machine à laver", occurrence: 2, impact: 2 },
    { name: "Production d'air", occurrence: 2, impact: 2 },
    { name: "Postes fixe essais frein MR", occurrence: 1, impact: 3 },
    { name: "Ponts roulants", occurrence: 1, impact: 2 },
    { name: "Caténaires escamotables", occurrence: 2, impact: 3 },
    { name: "Outillage de petite taille", occurrence: 0, impact: 0 },
  ],
};
