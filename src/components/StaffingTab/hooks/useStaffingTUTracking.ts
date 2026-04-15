import { useCallback, useRef } from "react";

interface UseStaffingTUTrackingArgs {
  activeScenario: any;
  currentTU: number;
}

/**
 * Tracks the "real" (non-scenario) TU value for the ScenarioBanner delta,
 * and provides the variance-hours callback for the AggregateHeatmapStrip.
 */
export function useStaffingTUTracking({ activeScenario, currentTU }: UseStaffingTUTrackingArgs) {
  const realTURef = useRef(currentTU || 0);
  const aggVarianceRef = useRef<number>(0);

  // Only update realTURef when outside a scenario (so the delta is meaningful)
  if (!activeScenario) realTURef.current = currentTU || 0;

  const handleAggVarianceComputed = useCallback((v: number) => {
    aggVarianceRef.current = v;
  }, []);

  return { realTURef, aggVarianceRef, handleAggVarianceComputed };
}
