// ── React Query layer — barrel exports ──

export { queryKeys } from "./queryKeys";
export type { CrmFilter } from "./queryKeys";
export { queryFns } from "./queryFns";
export { queryClient } from "./QueryProvider";
export { default as QueryProvider } from "./QueryProvider";

// Query hooks
export { useHealthQuery } from "./useHealthQuery";
export { useReadyQuery } from "./useReadyQuery";
export { useRegionsQuery } from "./useRegionsQuery";
export { useCrmQuery } from "./useCrmQuery";
export { useStaffingQuery } from "./useStaffingQuery";
export { useSapQuery } from "./useSapQuery";
export { useMetadataQuery } from "./useMetadataQuery";
export { useSkillsQuery } from "./useSkillsQuery";
export { useChangesQuery } from "./useChangesQuery";
export { useRecruitmentQuery } from "./useRecruitmentQuery";
export { useSkillsCatalogQuery } from "./useSkillsCatalogQuery";
export { useEmployeesQuery } from "./useEmployeesQuery";
export { useGridQuery } from "./useGridQuery";

// Facade hooks (read from cache, transform data)
export { useCrmData } from "./useCrmData";
export { useStaffingData } from "./useStaffingData";
export { useSapData } from "./useSapData";
export { useSkillsData } from "./useSkillsData";
export { useRecruitmentData } from "./useRecruitmentData";
export { useStaffingStatus } from "./useStaffingStatus";
export { useEmployeeData } from "./useEmployeeData";

// Mutations
export { useSaveChangesMutation } from "./useSaveChangesMutation";
