/**
 * useTimelineData Hook
 * Processes timeline events and manages expanded cards state
 *
 * Performance optimizations:
 * - useMemo for timeline data processing
 * - useCallback for event handlers
 */

import { useState, useMemo, useCallback } from "react";
import { STATUS_TEXT } from "../../../utils/constants";

interface TimelineEvent {
  date: Date;
  type: string;
  title: string;
  opportunity: Record<string, any>;
  id: string;
  status?: number;
}

interface OpportunityStream {
  opportunityId: string;
  opportunityName: string;
  serviceLine: string;
  events: TimelineEvent[];
  firstDate: Date;
  lastDate: Date;
  status: number;
  revenue: number;
}

interface SelectedJobcode {
  opportunities: Record<string, any>[];
  [key: string]: any;
}

/**
 * Custom hook for timeline data processing
 * @param {Object|null} selectedJobcode - Currently selected jobcode object
 * @returns {Object} Timeline data and handlers
 */
const useTimelineData = (selectedJobcode: SelectedJobcode | null) => {
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Process timeline data with useMemo for performance
  const { timelineData, opportunityStreams, timelineYears } = useMemo((): {
    timelineData: TimelineEvent[];
    opportunityStreams: OpportunityStream[];
    timelineYears: number[];
  } => {
    if (!selectedJobcode) {
      return {
        timelineData: [],
        opportunityStreams: [],
        timelineYears: [],
      };
    }

    // Create timeline items for each opportunity
    const allTimelineItems: TimelineEvent[] = [];
    const streams: OpportunityStream[] = [];
    const years = new Set<number>();
    const months = new Set<string>();

    // Process each opportunity separately to create streams
    selectedJobcode.opportunities.forEach((opp: Record<string, any>) => {
      // Create a list of timeline events for this opportunity
      const opportunityEvents: TimelineEvent[] = [];

      // Add opportunity creation
      const creationDate = new Date(opp.creationDate);
      years.add(creationDate.getFullYear());
      months.add(`${creationDate.getFullYear()}-${creationDate.getMonth()}`);

      opportunityEvents.push({
        date: creationDate,
        type: "creation",
        title: `Opportunity Created: ${opp.opportunity}`,
        opportunity: opp,
        id: `${opp.opportunityId}-creation`,
      });

      // Add status changes if available
      if (opp.bookingDate) {
        const statusDate = new Date(opp.bookingDate);
        years.add(statusDate.getFullYear());
        months.add(`${statusDate.getFullYear()}-${statusDate.getMonth()}`);

        opportunityEvents.push({
          date: statusDate,
          type: "status",
          title: `Status Changed to: ${STATUS_TEXT[opp["Status"]] || `Status ${opp["Status"]}`}`,
          status: opp["Status"],
          opportunity: opp,
          id: `${opp.opportunityId}-status-${opp["Status"]}`,
        });
      }

      // Add booking date if available and status is 14 (Booked)
      if (opp["Status"] === 14 && opp["Winning Date"]) {
        const winDate = new Date(opp["Winning Date"]);
        years.add(winDate.getFullYear());
        months.add(`${winDate.getFullYear()}-${winDate.getMonth()}`);

        opportunityEvents.push({
          date: winDate,
          type: "win",
          title: `Opportunity Won: ${opp.opportunity}`,
          opportunity: opp,
          id: `${opp.opportunityId}-win`,
        });
      }

      // Add lost date if available and status is 15 (Lost) — bookingDate is used for both bookings and losses
      const lostDateStr = opp.bookingDate;
      if (opp.status === 15 && lostDateStr) {
        const lostDate = new Date(lostDateStr);
        years.add(lostDate.getFullYear());
        months.add(`${lostDate.getFullYear()}-${lostDate.getMonth()}`);

        opportunityEvents.push({
          date: lostDate,
          type: "loss",
          title: `Opportunity Lost: ${opp.opportunity}`,
          opportunity: opp,
          id: `${opp.opportunityId}-loss`,
        });
      }

      // Sort events by date
      opportunityEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Add all events to the main timeline
      allTimelineItems.push(...opportunityEvents);

      // Only create a stream if there are events
      if (opportunityEvents.length > 0) {
        streams.push({
          opportunityId: opp.opportunityId,
          opportunityName: opp.opportunity,
          serviceLine: opp.serviceLine1 || "Unknown",
          events: opportunityEvents,
          firstDate: opportunityEvents[0].date,
          lastDate: opportunityEvents[opportunityEvents.length - 1].date,
          status: opp["Status"],
          revenue: opp.grossRevenue || 0,
        });
      }
    });

    // Sort all timeline items by date for the main timeline
    allTimelineItems.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Sort streams by first date
    streams.sort((a, b) => a.firstDate.getTime() - b.firstDate.getTime());

    // Convert years to array and sort
    const yearsArray = Array.from(years).sort();

    return {
      timelineData: allTimelineItems,
      opportunityStreams: streams,
      timelineYears: yearsArray,
    };
  }, [selectedJobcode]);

  // Toggle expanded card with useCallback
  const toggleExpanded = useCallback((id: string): void => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  // Reset expanded cards when jobcode changes
  const resetExpandedCards = useCallback((): void => {
    setExpandedCards({});
  }, []);

  return {
    timelineData,
    opportunityStreams,
    timelineYears,
    expandedCards,
    toggleExpanded,
    resetExpandedCards,
  };
};

export default useTimelineData;
