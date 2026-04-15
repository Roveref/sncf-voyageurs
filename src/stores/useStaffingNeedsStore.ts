/**
 * @deprecated — skillsCatalog has been moved to useComputedStore.
 * This file re-exports for backward compatibility. Import from useComputedStore instead.
 */

import { useComputedStore } from "./useComputedStore";

/** @deprecated Use useComputedStore directly */
export const useStaffingNeedsStore = Object.assign((selector?: any) => useComputedStore(selector), {
  getState: useComputedStore.getState,
  setState: useComputedStore.setState,
  subscribe: useComputedStore.subscribe,
});
