import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFilterStore } from "../stores/useFilterStore";
import { serializeFiltersToURL, deserializeFiltersFromURL } from "../utils/filterHelpers";

const TAB_ROUTES = ["/pipeline", "/bookings", "/staffing", "/projet", "/recrutement", "/my-dashboard"] as const;
const DEFAULT_TAB = 0;

/**
 * Hook that syncs the active tab index with URL routes.
 * Drop-in replacement for useState(0) — provides [activeTab, setActiveTab]
 * with the added benefit of deep-linking and browser back/forward support.
 *
 * Also encodes sidebar filter state as URL search params so that filters
 * survive page reloads and can be shared via URL.
 */
export function useTabRouting(): [number, (newTab: number) => void] {
  const navigate = useNavigate();
  const location = useLocation();
  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);

  // Track whether we've already applied the initial URL params to the store.
  const initializedRef = useRef(false);

  const activeTab = useMemo(() => {
    const idx = (TAB_ROUTES as readonly string[]).indexOf(location.pathname);
    return idx >= 0 ? idx : DEFAULT_TAB;
  }, [location.pathname]);

  // On mount: read filter params from the URL and apply them to the store.
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const deserialized = deserializeFiltersFromURL(location.search);
    if (deserialized) {
      setFilters((prev) => ({ ...prev, ...deserialized }));
    }
    // Only run once on mount — location.search intentionally not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever filters change, reflect them in the URL search params.
  // Uses replaceState to avoid polluting browser history.
  useEffect(() => {
    if (!initializedRef.current) return;
    const serialized = serializeFiltersToURL(filters);
    const nextSearch = serialized ? `?${serialized}` : "";
    const currentSearch = location.search;
    // Only update if the search string actually changed to avoid infinite loops.
    if (nextSearch !== currentSearch) {
      window.history.replaceState(null, "", location.pathname + nextSearch);
    }
  }, [filters, location.pathname, location.search]);

  const setActiveTab = useCallback(
    (newTab: number) => {
      const route = TAB_ROUTES[newTab] || TAB_ROUTES[DEFAULT_TAB];
      // Preserve current search params when switching tabs.
      const serialized = serializeFiltersToURL(filters);
      const search = serialized ? `?${serialized}` : "";
      navigate(route + search, { replace: false });
    },
    [navigate, filters]
  );

  return [activeTab, setActiveTab];
}
