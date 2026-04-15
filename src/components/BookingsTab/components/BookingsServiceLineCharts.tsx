import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import Grid from "@mui/material/Grid2";
import SimpleBarChart from "./SimpleBarChart";
import { DetachableCard } from "../../shared";

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
    // Drill-down state for service line chart
    const [drillDownServiceLine, setDrillDownServiceLine] = useState<string | null>(null);

    // Reset drill-down when parent signals a reset
    const prevResetKey = useRef(drillDownResetKey);
    useEffect(() => {
      if (drillDownResetKey !== prevResetKey.current) {
        prevResetKey.current = drillDownResetKey;
        setDrillDownServiceLine(null);
      }
    }, [drillDownResetKey]);

    // Calculate filtered service line data based on date filter and drill-down state
    // Uses same logic as Pipeline: when allocation is active, group by Allocated Service Line
    const filteredBookingsByServiceLine = useMemo(() => {
      let filteredBooked = chartFilteredData.filter((item) => item.status === 14);
      if (!filteredBooked || filteredBooked.length === 0) return [];

      // If drilling down, filter by the selected service line (using Allocated Service Line if allocated)
      if (drillDownServiceLine) {
        filteredBooked = filteredBooked.filter((opp) => {
          // If allocated, check Allocated Service Line
          if (opp.isAllocated && opp.allocatedServiceLine) {
            const allocatedLines = opp.allocatedServiceLine
              .split(",")
              .map((name: string) => name.trim())
              .filter((name: string) => name !== "" && name !== "-");
            return allocatedLines.includes(drillDownServiceLine);
          }
          // Otherwise check Service Line 1
          return opp.serviceLine1 === drillDownServiceLine;
        });
      }

      const byServiceLine: any[] = [];
      const serviceLinesMap: Record<string, any> = {};

      filteredBooked.forEach((opp) => {
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

        // When drilling down, group by Service Offering 1
        if (drillDownServiceLine) {
          const serviceLine = opp.serviceOffering1;
          if (!serviceLine) return;

          if (!serviceLinesMap[serviceLine]) {
            serviceLinesMap[serviceLine] = {
              name: serviceLine,
              value: 0,
              allocatedValue: 0,
              calculatedValue: 0,
              count: 0,
              isOffering: true,
            };
            byServiceLine.push(serviceLinesMap[serviceLine]);
          }

          serviceLinesMap[serviceLine].value += grossRevenue;
          serviceLinesMap[serviceLine].allocatedValue += allocatedRevenue;
          serviceLinesMap[serviceLine].calculatedValue += calculatedRevenue;
          serviceLinesMap[serviceLine].count += 1;
        } else {
          // When not drilling down, use Allocated Service Line if allocated, otherwise Service Line 1
          if (opp.isAllocated && opp.allocatedServiceLine) {
            // Split allocated service line if it contains multiple names
            const allocatedServiceLines = opp.allocatedServiceLine
              .split(",")
              .map((name: string) => name.trim())
              .filter((name: string) => name !== "" && name !== "-");

            // Divide revenue equally among allocated service lines
            const sharePerAllocated = 1 / allocatedServiceLines.length;

            allocatedServiceLines.forEach((serviceLine: string) => {
              if (!serviceLinesMap[serviceLine]) {
                serviceLinesMap[serviceLine] = {
                  name: serviceLine,
                  value: 0,
                  allocatedValue: 0,
                  calculatedValue: 0,
                  count: 0,
                  isOffering: false,
                };
                byServiceLine.push(serviceLinesMap[serviceLine]);
              }

              serviceLinesMap[serviceLine].value += grossRevenue * sharePerAllocated;
              serviceLinesMap[serviceLine].allocatedValue += allocatedRevenue * sharePerAllocated;
              serviceLinesMap[serviceLine].calculatedValue += calculatedRevenue * sharePerAllocated;
              serviceLinesMap[serviceLine].count += sharePerAllocated;
            });
          } else {
            // Use Service Line 1 for non-allocated opportunities
            const serviceLine = opp.serviceLine1;
            if (!serviceLine) return;

            if (!serviceLinesMap[serviceLine]) {
              serviceLinesMap[serviceLine] = {
                name: serviceLine,
                value: 0,
                allocatedValue: 0,
                calculatedValue: 0,
                count: 0,
                isOffering: false,
              };
              byServiceLine.push(serviceLinesMap[serviceLine]);
            }

            serviceLinesMap[serviceLine].value += grossRevenue;
            serviceLinesMap[serviceLine].allocatedValue += allocatedRevenue;
            serviceLinesMap[serviceLine].calculatedValue += calculatedRevenue;
            serviceLinesMap[serviceLine].count += 1;
          }
        }
      });

      byServiceLine.sort((a, b) => b.value - a.value);
      return byServiceLine;
    }, [chartFilteredData, drillDownServiceLine, showNetRevenue, calculateIORevenue]);

    // Calculate filtered losses by service line (same allocation logic as bookings)
    const filteredLossesByServiceLine = useMemo(() => {
      let filteredLost = chartFilteredData.filter((item) => item.status === 15);
      if (!filteredLost || filteredLost.length === 0) return [];

      // If drilling down, filter by the selected service line (using Allocated Service Line if allocated)
      if (drillDownServiceLine) {
        filteredLost = filteredLost.filter((opp) => {
          // If allocated, check Allocated Service Line
          if (opp.isAllocated && opp.allocatedServiceLine) {
            const allocatedLines = opp.allocatedServiceLine
              .split(",")
              .map((name: string) => name.trim())
              .filter((name: string) => name !== "" && name !== "-");
            return allocatedLines.includes(drillDownServiceLine);
          }
          // Otherwise check Service Line 1
          return opp.serviceLine1 === drillDownServiceLine;
        });
      }

      const byServiceLine: any[] = [];
      const serviceLinesMap: Record<string, any> = {};

      filteredLost.forEach((opp) => {
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

        // When drilling down, group by Service Offering 1
        if (drillDownServiceLine) {
          const serviceLine = opp.serviceOffering1;
          if (!serviceLine) return;

          if (!serviceLinesMap[serviceLine]) {
            serviceLinesMap[serviceLine] = {
              name: serviceLine,
              value: 0,
              allocatedValue: 0,
              calculatedValue: 0,
              count: 0,
              isOffering: true,
            };
            byServiceLine.push(serviceLinesMap[serviceLine]);
          }

          serviceLinesMap[serviceLine].value += grossRevenue;
          serviceLinesMap[serviceLine].allocatedValue += allocatedRevenue;
          serviceLinesMap[serviceLine].calculatedValue += calculatedRevenue;
          serviceLinesMap[serviceLine].count += 1;
        } else {
          // When not drilling down, use Allocated Service Line if allocated, otherwise Service Line 1
          if (opp.isAllocated && opp.allocatedServiceLine) {
            // Split allocated service line if it contains multiple names
            const allocatedServiceLines = opp.allocatedServiceLine
              .split(",")
              .map((name: string) => name.trim())
              .filter((name: string) => name !== "" && name !== "-");

            // Divide revenue equally among allocated service lines
            const sharePerAllocated = 1 / allocatedServiceLines.length;

            allocatedServiceLines.forEach((serviceLine: string) => {
              if (!serviceLinesMap[serviceLine]) {
                serviceLinesMap[serviceLine] = {
                  name: serviceLine,
                  value: 0,
                  allocatedValue: 0,
                  calculatedValue: 0,
                  count: 0,
                  isOffering: false,
                };
                byServiceLine.push(serviceLinesMap[serviceLine]);
              }

              serviceLinesMap[serviceLine].value += grossRevenue * sharePerAllocated;
              serviceLinesMap[serviceLine].allocatedValue += allocatedRevenue * sharePerAllocated;
              serviceLinesMap[serviceLine].calculatedValue += calculatedRevenue * sharePerAllocated;
              serviceLinesMap[serviceLine].count += sharePerAllocated;
            });
          } else {
            // Use Service Line 1 for non-allocated opportunities
            const serviceLine = opp.serviceLine1;
            if (!serviceLine) return;

            if (!serviceLinesMap[serviceLine]) {
              serviceLinesMap[serviceLine] = {
                name: serviceLine,
                value: 0,
                allocatedValue: 0,
                calculatedValue: 0,
                count: 0,
                isOffering: false,
              };
              byServiceLine.push(serviceLinesMap[serviceLine]);
            }

            serviceLinesMap[serviceLine].value += grossRevenue;
            serviceLinesMap[serviceLine].allocatedValue += allocatedRevenue;
            serviceLinesMap[serviceLine].calculatedValue += calculatedRevenue;
            serviceLinesMap[serviceLine].count += 1;
          }
        }
      });

      byServiceLine.sort((a, b) => b.value - a.value);
      return byServiceLine;
    }, [chartFilteredData, drillDownServiceLine, showNetRevenue, calculateIORevenue]);

    // Service line chart click handler for drill-down + filtering
    const handleServiceLineChartClick = useCallback(
      (chartEvent: any) => {
        if (!chartEvent || !chartEvent.activePayload || chartEvent.activePayload.length === 0) return;

        const clickedItem = chartEvent.activePayload[0].payload;

        if (drillDownServiceLine) {
          // Already drilling down — filter by offering
          setChartFilter({ type: "offering", value: clickedItem.name });
        } else {
          // Drill down to service offerings + filter
          setDrillDownServiceLine(clickedItem.name);
          setChartFilter({ type: "serviceLine", value: clickedItem.name });
        }
      },
      [drillDownServiceLine, setChartFilter]
    );

    // Back button handler
    const handleBackFromServiceLineDrillDown = useCallback(() => {
      setDrillDownServiceLine(null);
      setChartFilter(null);
    }, [setChartFilter]);

    return (
      <Grid size={{ xs: 12, lg: 6 }} sx={{ overflow: "visible", minHeight: 450 }}>
        <DetachableCard
          group="Bookings"
          storageKey="pip-bookings-serviceline"
          title="Bookings by Service Line"
          defaultWidth={600}
          defaultHeight={500}
        >
          <SimpleBarChart
            data={showLost ? filteredLossesByServiceLine : filteredBookingsByServiceLine}
            title={
              drillDownServiceLine
                ? `Service Offerings - ${drillDownServiceLine}`
                : showLost
                  ? "Lost by Service Line"
                  : "Bookings by Service Line"
            }
            showIO={showIO}
            onChartClick={handleServiceLineChartClick}
            onBackClick={handleBackFromServiceLineDrillDown}
            isDrillDown={!!drillDownServiceLine}
          />
        </DetachableCard>
      </Grid>
    );
  }
);

BookingsServiceLineCharts.displayName = "BookingsServiceLineCharts";

export default BookingsServiceLineCharts;
