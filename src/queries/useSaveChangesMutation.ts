import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveChanges } from "../services/api";
import { queryKeys } from "./queryKeys";

/**
 * Mutation for persisting user changes to the backend.
 * On success, invalidates the changes query so cross-tab sync picks it up.
 * Retry: 3 attempts with exponential backoff (1s → 2s → 4s).
 */
export function useSaveChangesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dirty: Record<string, unknown>) => saveChanges(dirty),
    // No query invalidation on success — the saving tab already has the data.
    // Invalidating `changes` here caused an infinite loop:
    // save → onSuccess → invalidate → refetch → restoreUserChanges → dirty → save
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 8000),
  });
}
