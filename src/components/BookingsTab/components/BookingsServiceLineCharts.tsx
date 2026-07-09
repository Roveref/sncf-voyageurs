import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import Grid from "@mui/material/Grid2";
import SimpleBarChart from "./SimpleBarChart";
import { DetachableCard } from "../../shared";
import { useCrmData } from "../../../queries/useCrmData";

interface ChartFilter {
  type: string;
  value: string;
}

interface BookingsServiceLineChartsProps {
  chartFilteredData: any[];
  showNetRevenue: boolean;
  showIO: boolean;
  showLost: boolean;
  calculateIORevenue: (opp: any) => number;
  chartFilter: ChartFilter | null;
  setChartFilter: React.Dispatch<React.SetStateAction<ChartFilter | null>>;
  drillDownResetKey: number;
}

// ── BU mapping — aligné avec src/data/gaifSites.ts ──
const BU_LABEL: Record<string, string> = {
  TN: "Transilien",
  TER: "TER",
  IC: "Intercités",
};
const BU_CODE_FROM_LABEL: Record<string, string> = {
  Transilien: "TN",
  TER: "TER",
  Intercités: "IC",
};

const resolveBU = (opp: any, accountByName: Map<string, string>, accountById: Map<string, string>): string | null => {
  // 1) Lookup via crmAccounts (source de vérité : colonne parentAccount = TN/TER/IC).
  if (opp.accountId) {
    const byId = accountById.get(String(opp.accountId));
    if (byId && BU_LABEL[byId]) return byId;
  }
  if (opp.account) {
    const byName = accountByName.get(String(opp.account));
    if (byName && BU_LABEL[byName]) return byName;
  }
  return null;
};

const BookingsServiceLineCharts = memo(
  ({
    chartFilteredData,
    showNetRevenue,
    showIO,
    showLost,
    calculateIORevenue,
    chartFilter,
    setChartFilter,
    drillDownResetKey,
  }: BookingsServiceLineChartsProps) => {
    // Niveau 1 : BU (Transilien / TER / Intercités) → drill sur un site du BU
    const [drillDownBU, setDrillDownBU] = useState<string | null>(null);

    // Maps accountId/accountName → BU (TN/TER/IC) depuis les sites hydratés.
    const { crmAccounts } = useCrmData();
    const { accountByName, accountById } = useMemo(() => {
      const byName = new Map<string, string>();
      const byId = new Map<string, string>();
      crmAccounts.forEach((a: any) => {
        if (a.parentAccount) {
          if (a.account) byName.set(a.account, a.parentAccount);
          if (a.accountId) byId.set(a.accountId, a.parentAccount);
        }
      });
      return { accountByName: byName, accountById: byId };
    }, [crmAccounts]);

    // Reset drill-down when parent signals a reset
    const prevResetKey = useRef(drillDownResetKey);
    useEffect(() => {
      if (drillDownResetKey !== prevResetKey.current) {
        prevResetKey.current = drillDownResetKey;
        setDrillDownBU(null);
      }
    }, [drillDownResetKey]);

    const buildGroups = useCallback(
      (base: any[]) => {
        if (base.length === 0) return [] as any[];
        const map: Record<string, any> = {};
        base.forEach((opp) => {
          const revenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
          const allocatedRevenue = opp.isAllocated
            ? showNetRevenue
              ? opp.allocatedNetRevenue || opp.allocatedGrossRevenue || 0
              : opp.allocatedGrossRevenue || 0
            : revenue;
          const calculatedRevenue = calculateIORevenue(opp);

          // Clef de groupe : BU (racine) ou site (drill-down).
          let key: string | null = null;
          if (drillDownBU) {
            key = String(opp.serviceLine1 || opp.account || "");
          } else {
            const bu = resolveBU(opp, accountByName, accountById);
            key = bu ? BU_LABEL[bu] : null;
          }
          if (!key) return;

          if (!map[key]) {
            map[key] = {
              name: key,
              value: 0,
              allocatedValue: 0,
              calculatedValue: 0,
              count: 0,
              isOffering: false,
            };
          }
          map[key].value += revenue;
          map[key].allocatedValue += allocatedRevenue;
          map[key].calculatedValue += calculatedRevenue;
          map[key].count += 1;
        });
        return Object.values(map).sort((a: any, b: any) => b.value - a.value);
      },
      [showNetRevenue, calculateIORevenue, drillDownBU, accountByName, accountById]
    );

    const filteredBookingsByEntity = useMemo(() => {
      const base = chartFilteredData.filter((item) => {
        if (!(item.isManual === true && item.status !== 15)) return false;
        if (drillDownBU && resolveBU(item, accountByName, accountById) !== drillDownBU) return false;
        return true;
      });
      return buildGroups(base);
    }, [chartFilteredData, drillDownBU, buildGroups, accountByName, accountById]);

    const filteredLossesByEntity = useMemo(() => {
      const base = chartFilteredData.filter((item) => {
        if (!(item.isManual === true && item.status === 15)) return false;
        if (drillDownBU && resolveBU(item, accountByName, accountById) !== drillDownBU) return false;
        return true;
      });
      return buildGroups(base);
    }, [chartFilteredData, drillDownBU, buildGroups, accountByName, accountById]);

    const handleChartClick = useCallback(
      (chartEvent: any) => {
        if (!chartEvent || !chartEvent.activePayload || chartEvent.activePayload.length === 0) return;
        const clickedItem = chartEvent.activePayload[0].payload;
        const label = String(clickedItem?.name || "");
        if (drillDownBU) {
          // Niveau site → filtre global sur l'actif/site cliqué.
          setChartFilter({ type: "account", value: label });
        } else {
          const code = BU_CODE_FROM_LABEL[label];
          if (code) setDrillDownBU(code);
        }
      },
      [drillDownBU, setChartFilter]
    );

    const handleBack = useCallback(() => {
      setDrillDownBU(null);
      setChartFilter(null);
    }, [setChartFilter]);

    const title = drillDownBU
      ? `${BU_LABEL[drillDownBU]} — détail par site`
      : showLost
        ? "Déclassés par entité"
        : "Maintenance par entité";

    return (
      <Grid size={{ xs: 12, lg: 6 }} sx={{ overflow: "visible", minHeight: 450 }}>
        <DetachableCard
          group="Maintenance"
          storageKey="pip-bookings-serviceline"
          title={title}
          defaultWidth={600}
          defaultHeight={500}
        >
          <SimpleBarChart
            data={showLost ? filteredLossesByEntity : filteredBookingsByEntity}
            title={title}
            showIO={showIO}
            onChartClick={handleChartClick}
            onBackClick={handleBack}
            isDrillDown={!!drillDownBU}
          />
        </DetachableCard>
      </Grid>
    );
  }
);

BookingsServiceLineCharts.displayName = "BookingsServiceLineCharts";

export default BookingsServiceLineCharts;
