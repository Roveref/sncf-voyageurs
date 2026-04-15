import { useCallback } from "react";
import { getIncludedValues, normalizeFilterValue, excludeValue } from "../../utils/filterHelpers";
import type { Filters } from "../../utils/filterHelpers";

interface UseExclusionDropArgs {
  filters: Filters;
  setFilters: (updater: (prev: Filters) => Filters) => void;
  serviceToOfferingMap: Record<string, string[]>;
  segmentToSubSegmentMap: Record<string, string[]>;
}

export function useExclusionDrop({
  filters,
  setFilters,
  serviceToOfferingMap,
  segmentToSubSegmentMap,
}: UseExclusionDropArgs) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      // Check if it's a service line group
      const serviceLineGroup = e.dataTransfer.getData("serviceLineGroup");
      if (serviceLineGroup) {
        try {
          const groupLines = JSON.parse(serviceLineGroup);
          let newServiceLineValue = normalizeFilterValue(filters.serviceLine1);
          let newOfferingsValue = normalizeFilterValue(filters.serviceOfferings);

          groupLines.forEach((line: string) => {
            newServiceLineValue = excludeValue(newServiceLineValue, line);
            const offerings = serviceToOfferingMap[line] || [];
            offerings.forEach((offering: string) => {
              newOfferingsValue = excludeValue(newOfferingsValue, offering);
            });
          });

          setFilters((prev: Filters) => ({
            ...prev,
            serviceLine1: newServiceLineValue,
            serviceOfferings: newOfferingsValue,
          }));
        } catch (err) {
          console.error("Error parsing service line group:", err);
        }
      }

      // Check if it's a single service line
      const serviceLine = e.dataTransfer.getData("serviceLine");
      if (serviceLine) {
        const newServiceLineValue = excludeValue(filters.serviceLine1, serviceLine);
        let newOfferingsValue = normalizeFilterValue(filters.serviceOfferings);

        const offerings = serviceToOfferingMap[serviceLine] || [];
        offerings.forEach((offering: string) => {
          newOfferingsValue = excludeValue(newOfferingsValue, offering);
        });

        setFilters((prev: Filters) => ({
          ...prev,
          serviceLine1: newServiceLineValue,
          serviceOfferings: newOfferingsValue,
        }));
      }

      // Check if it's a service offering
      const serviceOffering = e.dataTransfer.getData("serviceOffering");
      if (serviceOffering) {
        const newValue = excludeValue(filters.serviceOfferings, serviceOffering);
        setFilters((prev: Filters) => ({ ...prev, serviceOfferings: newValue }));
      }

      // Check if it's an account
      const account = e.dataTransfer.getData("account");
      if (account) {
        const newValue = excludeValue(filters.accounts, account);
        setFilters((prev: Filters) => ({ ...prev, accounts: newValue }));
      }

      // Check if it's a technology partner
      const technologyPartner = e.dataTransfer.getData("technologyPartner");
      if (technologyPartner) {
        const newValue = excludeValue(filters.technologyPartners, technologyPartner);
        setFilters((prev: Filters) => ({ ...prev, technologyPartners: newValue }));
      }

      // Check if it's a person
      const person = e.dataTransfer.getData("person");
      if (person) {
        const newValue = excludeValue(filters.people, person);
        setFilters((prev: Filters) => ({ ...prev, people: newValue }));
      }

      // Check if it's a segment code group (from LeftSidebar)
      const segmentCodeGroup = e.dataTransfer.getData("segmentCodeGroup");
      if (segmentCodeGroup) {
        try {
          const groupCodes = JSON.parse(segmentCodeGroup);
          let newSegmentCodesValue = normalizeFilterValue(filters.subSegmentCodes);
          let newSubSegmentsValue = normalizeFilterValue(filters.subSegments);

          groupCodes.forEach((code: string) => {
            newSegmentCodesValue = excludeValue(newSegmentCodesValue, code);
            const subSegments = segmentToSubSegmentMap[code] || [];
            subSegments.forEach((subSegment: string) => {
              newSubSegmentsValue = excludeValue(newSubSegmentsValue, subSegment);
            });
          });

          setFilters((prev: Filters) => ({
            ...prev,
            subSegmentCodes: newSegmentCodesValue,
            subSegments: newSubSegmentsValue,
          }));
        } catch (err) {
          console.error("Error parsing segment code group:", err);
        }
      }

      // Check if it's a single segment code (from LeftSidebar)
      const segmentCode = e.dataTransfer.getData("segmentCode");
      if (segmentCode) {
        const newSegmentCodesValue = excludeValue(filters.subSegmentCodes, segmentCode);
        let newSubSegmentsValue = normalizeFilterValue(filters.subSegments);

        const subSegments = segmentToSubSegmentMap[segmentCode] || [];
        subSegments.forEach((subSegment: string) => {
          newSubSegmentsValue = excludeValue(newSubSegmentsValue, subSegment);
        });

        setFilters((prev: Filters) => ({
          ...prev,
          subSegmentCodes: newSegmentCodesValue,
          subSegments: newSubSegmentsValue,
        }));
      }

      // Check if it's a sub-segment (from LeftSidebar)
      const subSegment = e.dataTransfer.getData("subSegment");
      if (subSegment) {
        const newValue = excludeValue(filters.subSegments, subSegment);
        setFilters((prev: Filters) => ({ ...prev, subSegments: newValue }));
      }

      // Check if it's a macro grade (M+ / M-)
      const macroGrade = e.dataTransfer.getData("macroGrade");
      if (macroGrade) {
        const newValue = excludeValue(filters.macroGrades, macroGrade);
        setFilters((prev: Filters) => ({ ...prev, macroGrades: newValue }));
      }

      // Check if it's a macro category (chargeable / nonChargeable / absence)
      const macroCategory = e.dataTransfer.getData("macroCategory");
      if (macroCategory) {
        const newValue = excludeValue(filters.macroCategories, macroCategory);
        setFilters((prev: Filters) => ({ ...prev, macroCategories: newValue }));
      }
    },
    [filters, setFilters, serviceToOfferingMap, segmentToSubSegmentMap]
  );

  return handleDrop;
}
