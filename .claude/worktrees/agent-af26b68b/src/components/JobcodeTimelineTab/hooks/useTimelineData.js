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

/**
 * Custom hook for timeline data processing
 * @param {Object|null} selectedJobcode - Currently selected jobcode object
 * @returns {Object} Timeline data and handlers
 */
const useTimelineData = (selectedJobcode) => {
  const [expandedCards, setExpandedCards] = useState({});

  // Process timeline data with useMemo for performance
  const { timelineData, opportunityStreams, timelineYears } = useMemo(() => {
    if (!selectedJobcode) {
      return {
        timelineData: [],
        opportunityStreams: [],
        timelineYears: [],
      };
    }

    // Create timeline items for each opportunity
    const allTimelineItems = [];
    const streams = [];
    const years = new Set();
    const months = new Set();

    // Process each opportunity separately to create streams
    selectedJobcode.opportunities.forEach((opp) => {
      // Create a list of timeline events for this opportunity
      const opportunityEvents = [];

      // Add opportunity creation
      const creationDate = new Date(opp["Creation Date"]);
      years.add(creationDate.getFullYear());
      months.add(`${creationDate.getFullYear()}-${creationDate.getMonth()}`);

      opportunityEvents.push({
        date: creationDate,
        type: "creation",
        title: `Opportunity Created: ${opp["Opportunity"]}`,
        opportunity: opp,
        id: `${opp["Opportunity ID"]}-creation`,
      });

      // Add status changes if available
      if (opp["Booking/Lost Date"]) {
        const statusDate = new Date(opp["Booking/Lost Date"]);
        years.add(statusDate.getFullYear());
        months.add(`${statusDate.getFullYear()}-${statusDate.getMonth()}`);

        opportunityEvents.push({
          date: statusDate,
          type: "status",
          title: `Status Changed to: ${STATUS_TEXT[opp["Status"]] || `Status ${opp["Status"]}`}`,
          status: opp["Status"],
          opportunity: opp,
          id: `${opp["Opportunity ID"]}-status-${opp["Status"]}`,
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
          title: `Opportunity Won: ${opp["Opportunity"]}`,
          opportunity: opp,
          id: `${opp["Opportunity ID"]}-win`,
        });
      }

      // Add lost date if available and status is 15 (Lost)
      if (opp["Status"] === 15 && opp["Lost Date"]) {
        const lostDate = new Date(opp["Lost Date"]);
        years.add(lostDate.getFullYear());
        months.add(`${lostDate.getFullYear()}-${lostDate.getMonth()}`);

        opportunityEvents.push({
          date: lostDate,
          type: "loss",
          title: `Opportunity Lost: ${opp["Opportunity"]}`,
          opportunity: opp,
          id: `${opp["Opportunity ID"]}-loss`,
        });
      }

      // Sort events by date
      opportunityEvents.sort((a, b) => a.date - b.date);

      // Add all events to the main timeline
      allTimelineItems.push(...opportunityEvents);

      // Only create a stream if there are events
      if (opportunityEvents.length > 0) {
        streams.push({
          opportunityId: opp["Opportunity ID"],
          opportunityName: opp["Opportunity"],
          serviceLine: opp["Service Line 1"] || "Unknown",
          events: opportunityEvents,
          firstDate: opportunityEvents[0].date,
          lastDate: opportunityEvents[opportunityEvents.length - 1].date,
          status: opp["Status"],
          revenue: opp["Gross Revenue"] || 0,
        });
      }
    });

    // Sort all timeline items by date for the main timeline
    allTimelineItems.sort((a, b) => a.date - b.date);

    // Sort streams by first date
    streams.sort((a, b) => a.firstDate - b.firstDate);

    // Convert years to array and sort
    const yearsArray = Array.from(years).sort();

    return {
      timelineData: allTimelineItems,
      opportunityStreams: streams,
      timelineYears: yearsArray,
    };
  }, [selectedJobcode]);

  // Toggle expanded card with useCallback
  const toggleExpanded = useCallback((id) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  // Reset expanded cards when jobcode changes
  const resetExpandedCards = useCallback(() => {
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
