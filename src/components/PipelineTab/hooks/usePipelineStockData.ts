import { useMemo } from "react";
import { computePipelineStock } from "../utils/pipelineStockCalculations";

export function usePipelineStockData(
  allOpportunityData: any[],
  loading: boolean,
  showNetRevenue: boolean,
  sinceYear?: number | null
) {
  const result = useMemo(() => {
    if (loading || !allOpportunityData || allOpportunityData.length === 0) {
      return { years: [] as number[], monthlyData: [] as Record<string, any>[] };
    }
    return computePipelineStock(allOpportunityData, showNetRevenue, sinceYear);
  }, [allOpportunityData, loading, showNetRevenue, sinceYear]);

  return result;
}
