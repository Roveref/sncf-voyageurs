/**
 * GaifWidgetsProvider — enregistre tous les widgets GAIF (référentiel + KPIs PSGA +
 * pilotage + gouvernance + ISO 55001) dans le widget registry global au démarrage.
 *
 * Composant invisible monté au niveau App.tsx.
 * Applique un layout par défaut si aucun widget GAIF n'est présent.
 * Append les nouveaux widgets de la définition à un layout existant (upgrade safe).
 */

import { memo, useEffect } from "react";
import { useWidgetRegistry } from "../../stores/useWidgetRegistry";
import { useDashboardLayoutStore } from "../../stores/useDashboardLayoutStore";
import PatrimoinesMapWidget from "./widgets/PatrimoinesMapWidget";
import CriticityMatrixWidget from "./widgets/CriticityMatrixWidget";
import RaciMatrixWidget from "./widgets/RaciMatrixWidget";
import ComitologieWidget from "./widgets/ComitologieWidget";
import CatalogueServicesWidget from "./widgets/CatalogueServicesWidget";
import AuditMaturityWidget from "./widgets/AuditMaturityWidget";
import PaysageSIWidget from "./widgets/PaysageSIWidget";
import DoctrinaireDocsWidget from "./widgets/DoctrinaireDocsWidget";
import RisksRegisterWidget from "./widgets/RisksRegisterWidget";
import AuditCalendarWidget from "./widgets/AuditCalendarWidget";
import SchemaDirecteurImmoWidget from "./widgets/SchemaDirecteurImmoWidget";
import {
  DisponibiliteWidget,
  ConformiteWidget,
  CoutGAWidget,
  MarqueurClientsWidget,
  MarqueurAgiliteWidget,
  MarqueurJusteBesoinWidget,
  MarqueurInnovationWidget,
  ChargeParPoleWidget,
  IncidentsWidget,
  ConsommationRSEWidget,
  MtbfMttrWidget,
  CoutTCOWidget,
  CoutM2Widget,
  EtatParcImmoWidget,
} from "./widgets/GaifKpiWidgets";

interface GaifWidgetDef {
  key: string;
  label: string;
  group: string;
  render: () => React.ReactNode;
  defaultPos?: { col: number; row: number; colSpan: number; rowSpan: number };
}

const GAIF_WIDGETS: GaifWidgetDef[] = [
  // Row 0 — 2 KPIs PSGA (widths équivalentes)
  {
    key: "gaif-disponibilite",
    label: "Disponibilité résiduelle",
    group: "KPIs PSGA",
    render: () => <DisponibiliteWidget />,
    defaultPos: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
  },
  {
    key: "gaif-conformite",
    label: "Conformité",
    group: "KPIs PSGA",
    render: () => <ConformiteWidget />,
    defaultPos: { col: 2, row: 0, colSpan: 2, rowSpan: 1 },
  },

  // Row 1 — 4 marqueurs d'industrialisation
  {
    key: "gaif-marq-clients",
    label: "Marqueur Clients",
    group: "4 Marqueurs",
    render: () => <MarqueurClientsWidget />,
    defaultPos: { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
  },
  {
    key: "gaif-marq-agilite",
    label: "Marqueur Agilité",
    group: "4 Marqueurs",
    render: () => <MarqueurAgiliteWidget />,
    defaultPos: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
  },
  {
    key: "gaif-marq-juste",
    label: "Marqueur Juste Besoin",
    group: "4 Marqueurs",
    render: () => <MarqueurJusteBesoinWidget />,
    defaultPos: { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
  },
  {
    key: "gaif-marq-innov",
    label: "Marqueur Innovation",
    group: "4 Marqueurs",
    render: () => <MarqueurInnovationWidget />,
    defaultPos: { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
  },

  // Row 2-3 — Patrimoines + Matrice criticité
  {
    key: "gaif-patrimoines",
    label: "Carte des 6 patrimoines",
    group: "Référentiel GAIF",
    render: () => <PatrimoinesMapWidget />,
    defaultPos: { col: 0, row: 2, colSpan: 2, rowSpan: 2 },
  },
  {
    key: "gaif-criticity",
    label: "Matrice de criticité",
    group: "Référentiel GAIF",
    render: () => <CriticityMatrixWidget />,
    defaultPos: { col: 2, row: 2, colSpan: 2, rowSpan: 2 },
  },

  // Row 4-5 — RACI + Coût GA + Charge pôle + Incidents + Conso RSE
  {
    key: "gaif-raci",
    label: "RACI des processus",
    group: "Référentiel GAIF",
    render: () => <RaciMatrixWidget />,
    defaultPos: { col: 0, row: 4, colSpan: 2, rowSpan: 2 },
  },
  {
    key: "gaif-cout-ga",
    label: "Coût GA / rame",
    group: "KPIs PSGA",
    render: () => <CoutGAWidget />,
    defaultPos: { col: 2, row: 4, colSpan: 1, rowSpan: 1 },
  },
  {
    key: "gaif-charge-pole",
    label: "Charge par pôle",
    group: "KPIs PSGA",
    render: () => <ChargeParPoleWidget />,
    defaultPos: { col: 3, row: 4, colSpan: 1, rowSpan: 1 },
  },
  {
    key: "gaif-incidents",
    label: "Incidents / AT 12 mois",
    group: "KPIs pilotage",
    render: () => <IncidentsWidget />,
    defaultPos: { col: 2, row: 5, colSpan: 1, rowSpan: 1 },
  },
  {
    key: "gaif-conso-rse",
    label: "Consommation RSE",
    group: "KPIs pilotage",
    render: () => <ConsommationRSEWidget />,
    defaultPos: { col: 3, row: 5, colSpan: 1, rowSpan: 1 },
  },

  // Row 6 — MTBF/MTTR + TCO + État ABE (col 3)
  {
    key: "gaif-mtbf-mttr",
    label: "MTBF / MTTR (IO)",
    group: "KPIs pilotage",
    render: () => <MtbfMttrWidget />,
    defaultPos: { col: 0, row: 6, colSpan: 2, rowSpan: 1 },
  },
  {
    key: "gaif-cout-tco",
    label: "Coût de possession (TCO)",
    group: "KPIs financiers",
    render: () => <CoutTCOWidget />,
    defaultPos: { col: 2, row: 6, colSpan: 2, rowSpan: 1 },
  },

  // Row 7 — Coût m² + État ABE
  {
    key: "gaif-cout-m2",
    label: "Coût exploitation € / m²",
    group: "KPIs financiers",
    render: () => <CoutM2Widget />,
    defaultPos: { col: 0, row: 7, colSpan: 2, rowSpan: 1 },
  },
  {
    key: "gaif-etat-abe",
    label: "État parc immobilier (ABE)",
    group: "KPIs pilotage",
    render: () => <EtatParcImmoWidget />,
    defaultPos: { col: 2, row: 7, colSpan: 2, rowSpan: 1 },
  },

  // Row 8-9 — Gouvernance opérationnelle (comitologie + catalogue)
  {
    key: "gaif-comitologie",
    label: "Comitologie GAIF",
    group: "Gouvernance",
    render: () => <ComitologieWidget />,
    defaultPos: { col: 0, row: 8, colSpan: 2, rowSpan: 2 },
  },
  {
    key: "gaif-catalogue",
    label: "Catalogue de services",
    group: "Gouvernance",
    render: () => <CatalogueServicesWidget />,
    defaultPos: { col: 2, row: 8, colSpan: 2, rowSpan: 2 },
  },

  // Row 10-11 — ISO 55001 (maturité + risques)
  {
    key: "gaif-audit-maturity",
    label: "Maturité ISO 55001",
    group: "ISO 55001",
    render: () => <AuditMaturityWidget />,
    defaultPos: { col: 0, row: 10, colSpan: 2, rowSpan: 2 },
  },
  {
    key: "gaif-risks",
    label: "Registre risques & opportunités",
    group: "ISO 55001",
    render: () => <RisksRegisterWidget />,
    defaultPos: { col: 2, row: 10, colSpan: 2, rowSpan: 2 },
  },

  // Row 12-13 — Calendrier audits + Paysage SI
  {
    key: "gaif-audit-cal",
    label: "Calendrier audits ISO 55001",
    group: "ISO 55001",
    render: () => <AuditCalendarWidget />,
    defaultPos: { col: 0, row: 12, colSpan: 2, rowSpan: 2 },
  },
  {
    key: "gaif-paysage-si",
    label: "Paysage SI GAIF",
    group: "Référentiel GAIF",
    render: () => <PaysageSIWidget />,
    defaultPos: { col: 2, row: 12, colSpan: 2, rowSpan: 2 },
  },

  // Row 14-15 — Documents + Schéma directeur
  {
    key: "gaif-docs",
    label: "Référentiel doctrinaire",
    group: "Référentiel GAIF",
    render: () => <DoctrinaireDocsWidget />,
    defaultPos: { col: 0, row: 14, colSpan: 2, rowSpan: 2 },
  },
  {
    key: "gaif-schema-immo",
    label: "Schéma directeur immobilier",
    group: "KPIs pilotage",
    render: () => <SchemaDirecteurImmoWidget />,
    defaultPos: { col: 2, row: 14, colSpan: 2, rowSpan: 2 },
  },
];

// Keys removed from the dashboard — cleared from any cached layout on load.
const REMOVED_WIDGET_KEYS = new Set([
  "gaif-stakeholders",
  "gaif-utilisation",
  "gaif-skills-gap",
  "gaif-capex",
  "gaif-organisation",
]);

// Bump this when the default layout changes and you want existing users
// to pick up the new positions (clears cached GAIF layout once).
const LAYOUT_VERSION = "2026-04-21-remove-5-widgets";
const LAYOUT_VERSION_LS_KEY = "gaif_dashboard_layout_version";

const GaifWidgetsProvider = memo(() => {
  const register = useWidgetRegistry((s) => s.register);
  const setWidgets = useDashboardLayoutStore((s) => s.setWidgets);
  const currentWidgets = useDashboardLayoutStore((s) => s.widgets);

  // Register all GAIF widgets in the registry
  useEffect(() => {
    for (const w of GAIF_WIDGETS) {
      register(w.key, w.label, w.group, w.render);
    }
  }, [register]);

  // Apply GAIF default layout if no GAIF widgets are present, the layout version
  // changed, or append any widget newly defined in GAIF_WIDGETS.
  useEffect(() => {
    const currentKeys = new Set(currentWidgets.map((w) => w.widgetKey));
    const hasAnyGaif = currentWidgets.some((w) => w.widgetKey.startsWith("gaif-"));
    const storedVersion = (() => {
      try {
        return localStorage.getItem(LAYOUT_VERSION_LS_KEY);
      } catch {
        return null;
      }
    })();
    const versionMismatch = storedVersion !== LAYOUT_VERSION;

    if (!hasAnyGaif || versionMismatch) {
      // No GAIF widgets or new layout version → apply full default layout
      const defaultLayout = GAIF_WIDGETS.filter((w) => w.defaultPos).map((w, idx) => ({
        id: `gaif-default-${idx}`,
        widgetKey: w.key,
        col: w.defaultPos!.col,
        row: w.defaultPos!.row,
        colSpan: w.defaultPos!.colSpan,
        rowSpan: w.defaultPos!.rowSpan,
      }));
      setWidgets(defaultLayout);
      try {
        localStorage.setItem(LAYOUT_VERSION_LS_KEY, LAYOUT_VERSION);
      } catch {
        /* ignore */
      }
      return;
    }

    // Corrective patch: remove deprecated widgets from any cached layout and
    // normalise Disponibilité / Conformité widths on row 0.
    const filtered = currentWidgets.filter((w) => !REMOVED_WIDGET_KEYS.has(w.widgetKey));
    let didPatch = filtered.length !== currentWidgets.length;
    const patched = filtered.map((w) => {
      if (w.widgetKey === "gaif-disponibilite" && w.row === 0 && (w.col !== 0 || w.colSpan !== 2)) {
        didPatch = true;
        return { ...w, col: 0, row: 0, colSpan: 2, rowSpan: 1 };
      }
      if (w.widgetKey === "gaif-conformite" && w.row === 0 && (w.col !== 2 || w.colSpan !== 2)) {
        didPatch = true;
        return { ...w, col: 2, row: 0, colSpan: 2, rowSpan: 1 };
      }
      return w;
    });
    if (didPatch) {
      setWidgets(patched);
      return;
    }

    // Existing GAIF layout → append only widgets that are newly defined (e.g. after an upgrade)
    const missing = GAIF_WIDGETS.filter((w) => w.defaultPos && !currentKeys.has(w.key));
    if (missing.length === 0) return;
    const appended = missing.map((w, idx) => ({
      id: `gaif-append-${Date.now()}-${idx}`,
      widgetKey: w.key,
      col: w.defaultPos!.col,
      row: w.defaultPos!.row,
      colSpan: w.defaultPos!.colSpan,
      rowSpan: w.defaultPos!.rowSpan,
    }));
    setWidgets([...currentWidgets, ...appended]);
  }, [currentWidgets, setWidgets]);

  return null;
});

GaifWidgetsProvider.displayName = "GaifWidgetsProvider";
export default GaifWidgetsProvider;
