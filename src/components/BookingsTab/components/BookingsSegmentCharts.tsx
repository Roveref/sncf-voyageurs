import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import Grid from "@mui/material/Grid2";
import SimpleBarChart from "./SimpleBarChart";
import { DetachableCard } from "../../shared";

interface ChartFilter {
  type: string;
  value: string;
}

interface BookingsSegmentChartsProps {
  chartFilteredData: any[];
  showNetRevenue: boolean;
  showIO: boolean;
  showLost: boolean;
  calculateIORevenue: (opp: any) => number;
  chartFilter: ChartFilter | null;
  setChartFilter: React.Dispatch<React.SetStateAction<ChartFilter | null>>;
  drillDownResetKey: number;
}

const BookingsSegmentCharts = memo(
  ({
    chartFilteredData,
    showNetRevenue,
    showIO,
    showLost,
    calculateIORevenue,
    chartFilter,
    setChartFilter,
    drillDownResetKey,
  }: BookingsSegmentChartsProps) => {
    // Drill-down state for segment chart
    const [drillDownSegment, setDrillDownSegment] = useState<string | null>(null);
    // Toggle between Segment and Account view
    const [showAccountMode, setShowAccountMode] = useState(false);

    // Reset drill-down when parent signals a reset
    const prevResetKey = useRef(drillDownResetKey);
    useEffect(() => {
      if (drillDownResetKey !== prevResetKey.current) {
        prevResetKey.current = drillDownResetKey;
        setDrillDownSegment(null);
      }
    }, [drillDownResetKey]);

    // Calculate filtered segment data based on date filter and drill-down state
    const filteredBookingsBySegment = useMemo(() => {
      let filteredBooked = chartFilteredData.filter((item) => item.status === 14);
      if (!filteredBooked || filteredBooked.length === 0) return [];

      // If drilling down, filter by the selected segment
      if (drillDownSegment) {
        filteredBooked = filteredBooked.filter((opp) => opp.subSegmentCode === drillDownSegment);
      }

      const bySegment: any[] = [];
      const segmentsMap: Record<string, any> = {};
      // Use Sub Segment when drilling down, otherwise Sub Segment Code
      const groupKey = drillDownSegment ? "subSegment" : "subSegmentCode";

      filteredBooked.forEach((opp) => {
        const segment = opp[groupKey];
        if (!segment) return;

        const grossRevenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
        const isAllocated =
          opp.isAllocated &&
          (showNetRevenue ? opp.allocatedNetRevenue || opp.allocatedGrossRevenue : opp.allocatedGrossRevenue);
        const allocatedRevenue = isAllocated
          ? showNetRevenue
            ? opp.allocatedNetRevenue || opp.allocatedGrossRevenue || 0
            : opp.allocatedGrossRevenue || 0
          : grossRevenue;
        const calculatedRevenue = calculateIORevenue(opp);

        if (!segmentsMap[segment]) {
          segmentsMap[segment] = {
            name: segment,
            value: 0,
            allocatedValue: 0,
            calculatedValue: 0,
            count: 0,
            isSubSegment: !!drillDownSegment,
          };
          bySegment.push(segmentsMap[segment]);
        }

        segmentsMap[segment].value += grossRevenue;
        segmentsMap[segment].allocatedValue += allocatedRevenue;
        segmentsMap[segment].calculatedValue += calculatedRevenue;
        segmentsMap[segment].count += 1;
      });

      bySegment.sort((a, b) => b.value - a.value);
      return bySegment;
    }, [chartFilteredData, drillDownSegment, showNetRevenue, calculateIORevenue]);

    const filteredLossesBySegment = useMemo(() => {
      let filteredLost = chartFilteredData.filter((item) => item.status === 15);
      if (!filteredLost || filteredLost.length === 0) return [];

      // If drilling down, filter by the selected segment
      if (drillDownSegment) {
        filteredLost = filteredLost.filter((opp) => opp.subSegmentCode === drillDownSegment);
      }

      const bySegment: any[] = [];
      const segmentsMap: Record<string, any> = {};
      const groupKey = drillDownSegment ? "subSegment" : "subSegmentCode";

      filteredLost.forEach((opp) => {
        const segment = opp[groupKey];
        if (!segment) return;

        const grossRevenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;
        const isAllocated =
          opp.isAllocated &&
          (showNetRevenue ? opp.allocatedNetRevenue || opp.allocatedGrossRevenue : opp.allocatedGrossRevenue);
        const allocatedRevenue = isAllocated
          ? showNetRevenue
            ? opp.allocatedNetRevenue || opp.allocatedGrossRevenue || 0
            : opp.allocatedGrossRevenue || 0
          : grossRevenue;
        const calculatedRevenue = calculateIORevenue(opp);

        if (!segmentsMap[segment]) {
          segmentsMap[segment] = {
            name: segment,
            value: 0,
            allocatedValue: 0,
            calculatedValue: 0,
            count: 0,
            isSubSegment: !!drillDownSegment,
          };
          bySegment.push(segmentsMap[segment]);
        }

        segmentsMap[segment].value += grossRevenue;
        segmentsMap[segment].allocatedValue += allocatedRevenue;
        segmentsMap[segment].calculatedValue += calculatedRevenue;
        segmentsMap[segment].count += 1;
      });

      bySegment.sort((a, b) => b.value - a.value);
      return bySegment;
    }, [chartFilteredData, drillDownSegment, showNetRevenue, calculateIORevenue]);

    // Calculate filtered bookings by Account (for Account mode toggle)
    const filteredBookingsByAccount = useMemo(() => {
      const filteredBooked = chartFilteredData.filter((item) => item.status === 14);
      if (!filteredBooked || filteredBooked.length === 0) return [];

      const byAccount: any[] = [];
      const accountsMap: Record<string, any> = {};

      filteredBooked.forEach((opp) => {
        const account = opp.account;
        if (!account) return;

        const revenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;

        if (!accountsMap[account]) {
          accountsMap[account] = { name: account, value: 0, count: 0 };
          byAccount.push(accountsMap[account]);
        }

        accountsMap[account].value += revenue;
        accountsMap[account].count += 1;
      });

      byAccount.sort((a, b) => b.value - a.value);
      return byAccount;
    }, [chartFilteredData, showNetRevenue]);

    const filteredLossesByAccount = useMemo(() => {
      const filteredLost = chartFilteredData.filter((item) => item.status === 15);
      if (!filteredLost || filteredLost.length === 0) return [];

      const byAccount: any[] = [];
      const accountsMap: Record<string, any> = {};

      filteredLost.forEach((opp) => {
        const account = opp.account;
        if (!account) return;

        const revenue = showNetRevenue ? opp.netRevenue || 0 : opp.grossRevenue || 0;

        if (!accountsMap[account]) {
          accountsMap[account] = { name: account, value: 0, count: 0 };
          byAccount.push(accountsMap[account]);
        }

        accountsMap[account].value += revenue;
        accountsMap[account].count += 1;
      });

      byAccount.sort((a, b) => b.value - a.value);
      return byAccount;
    }, [chartFilteredData, showNetRevenue]);

    // Segment chart click handler for drill-down + filtering
    const handleSegmentChartClick = useCallback(
      (chartEvent: any) => {
        if (!chartEvent || !chartEvent.activePayload || chartEvent.activePayload.length === 0) return;

        const clickedItem = chartEvent.activePayload[0].payload;

        if (drillDownSegment) {
          // Already drilling down — filter by sub-segment
          setChartFilter({ type: "subSegment", value: clickedItem.name });
        } else {
          // Drill down to sub-segments + filter
          setDrillDownSegment(clickedItem.name);
          setChartFilter({ type: "segment", value: clickedItem.name });
        }
      },
      [drillDownSegment, setChartFilter]
    );

    // Back button handler
    const handleBackFromSegmentDrillDown = useCallback(() => {
      setDrillDownSegment(null);
      setChartFilter(null);
    }, [setChartFilter]);

    // Toggle Account/Segment mode
    const handleToggleAccountMode = useCallback(() => {
      setShowAccountMode((prev) => !prev);
      setDrillDownSegment(null);
      setChartFilter(null); // Reset filter when switching modes
    }, [setChartFilter]);

    return (
      <Grid size={{ xs: 12, lg: 6 }} sx={{ overflow: "visible", minHeight: 450 }}>
        <DetachableCard
          group="Bookings"
          storageKey="pip-bookings-segment"
          title="Bookings by Segment"
          defaultWidth={600}
          defaultHeight={500}
        >
          <SimpleBarChart
            data={
              showAccountMode
                ? showLost
                  ? filteredLossesByAccount
                  : filteredBookingsByAccount
                : showLost
                  ? filteredLossesBySegment
                  : filteredBookingsBySegment
            }
            title={
              showAccountMode
                ? showLost
                  ? "Lost by Account"
                  : "Bookings by Account"
                : drillDownSegment
                  ? `Sub-Segments - ${drillDownSegment}`
                  : showLost
                    ? "Lost by Segment"
                    : "Bookings by Segment"
            }
            showIO={showIO}
            onChartClick={showAccountMode ? undefined : handleSegmentChartClick}
            onBackClick={handleBackFromSegmentDrillDown}
            isDrillDown={!!drillDownSegment && !showAccountMode}
            showToggle={!drillDownSegment}
            onToggleMode={handleToggleAccountMode}
            toggleTooltip={showAccountMode ? "Show by Segment" : "Show by Account"}
          />
        </DetachableCard>
      </Grid>
    );
  }
);

BookingsSegmentCharts.displayName = "BookingsSegmentCharts";

export default BookingsSegmentCharts;
