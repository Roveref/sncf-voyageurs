import { useMemo, useCallback } from "react";
import { CHARGEABLE_CATS, GO_CATS } from "../constants";
import { buildMdsHolidayDates, computeJobHoursAndDays } from "../utils/liveCellBuilder";

/**
 * Extracted from EmployeeRow.tsx — resolves job labels using pipeline/CRM data.
 *
 * Returns: resolveOppForJob, getJobLabel, getJobLabelParts, mdsHolidayDates, tlStartStr, tlEndStr
 */
export function useLabelResolution({
  assignments,
  timelineStart,
  timelineEnd,
  enabledHolidayDates,
  pipelineJobcodes,
  jobcodeOppsList,
}: {
  assignments: any[];
  timelineStart: Date | string;
  timelineEnd: Date | string;
  enabledHolidayDates: Set<string>;
  pipelineJobcodes: Map<string, any> | null | undefined;
  jobcodeOppsList: Map<string, any[]> | null | undefined;
}) {
  // Memoize MDS holiday dates and timeline bounds for job label computation
  const mdsHolidayDates = useMemo(() => buildMdsHolidayDates(assignments || []), [assignments]);
  const tlStartStr = useMemo(() => new Date(timelineStart).toISOString().slice(0, 10), [timelineStart]);
  const tlEndStr = useMemo(() => {
    const tlEndExcl = new Date(timelineEnd);
    tlEndExcl.setDate(tlEndExcl.getDate() - 1);
    return tlEndExcl.toISOString().slice(0, 10);
  }, [timelineEnd]);

  // Resolve best opportunity for a job using date-based matching (multi-opp aware)
  const resolveOppForJob = useCallback(
    (job: any) => {
      if (!job.jobNo) return null;
      const key = String(job.jobNo).trim();
      // Try multi-opp list first
      const opps = jobcodeOppsList?.get(key);
      if (opps && opps.length > 0) {
        if (opps.length === 1) return opps[0];
        const jobStart = job.periods?.[0]?.startDate || "";
        const jobEnd = job.periods?.[0]?.endDate || "";
        // Find opp whose booking date falls within assignment period
        let best = opps.find((o: any) => o.endDate && o.endDate >= jobStart && o.endDate <= jobEnd);
        if (!best) {
          // Fallback: closest booking date to assignment start
          const startMs = jobStart ? new Date(jobStart).getTime() : Date.now();
          best =
            opps
              .filter((o: any) => o.endDate)
              .sort(
                (a: any, b: any) =>
                  Math.abs(new Date(a.endDate).getTime() - startMs) - Math.abs(new Date(b.endDate).getTime() - startMs)
              )[0] || opps[opps.length - 1];
        }
        return best;
      }
      // Fallback to pipelineJobcodes (single-opp map)
      const single = pipelineJobcodes?.get(key);
      return single ? { oppName: single.opportunityName, account: single.account } : null;
    },
    [jobcodeOppsList, pipelineJobcodes]
  );

  const getJobLabel = useCallback(
    (job: any, periodOverride?: { startDate: string; endDate: string; hoursPerDay: number }) => {
      const resolved = resolveOppForJob(job);
      const isChargeable = CHARGEABLE_CATS.has(job.category);
      const isGo = GO_CATS.has(job.category);
      const shouldTrunc = isChargeable || isGo;
      const MAX_TOOLTIP = 50;
      const trunc = (s: string, max: number) => (shouldTrunc && s && s.length > max ? s.slice(0, max) + "\u2026" : s);
      let namePart: string;
      if (resolved?.account) {
        const acc = resolved.account || "";
        const opp = resolved.oppName || resolved.opportunityName || "";
        const half = Math.floor((MAX_TOOLTIP - 3) / 2);
        namePart = `${trunc(acc, half)} - ${trunc(opp, half)}`;
      } else {
        namePart = trunc(job.jobName, MAX_TOOLTIP);
      }

      const periods = periodOverride ? [periodOverride] : job.periods || [];
      const { hStr, dStr } = computeJobHoursAndDays({
        periods,
        tlStart: tlStartStr,
        tlEnd: tlEndStr,
        enabledHolidayDates,
        mdsHolidayDates,
      });

      return shouldTrunc && job.jobNo
        ? `${namePart} - ${job.jobNo} - ${hStr}h - ${dStr}d`
        : `${namePart} - ${hStr}h - ${dStr}d`;
    },
    [resolveOppForJob, pipelineJobcodes, tlStartStr, tlEndStr, enabledHolidayDates, mdsHolidayDates]
  );

  // Structured label parts for aligned columns
  const getJobLabelParts = useCallback(
    (job: any, periodOverride?: any) => {
      const resolved = resolveOppForJob(job);
      const isChargeable = CHARGEABLE_CATS.has(job.category);
      const isGo = GO_CATS.has(job.category);
      const shouldTrunc = isChargeable || isGo;
      const periods = periodOverride ? [periodOverride] : job.periods || [];
      const { hStr, dStr } = computeJobHoursAndDays({
        periods,
        tlStart: tlStartStr,
        tlEnd: tlEndStr,
        enabledHolidayDates,
        mdsHolidayDates,
      });
      if (resolved?.account) {
        return {
          account: resolved.account,
          oppName: resolved.oppName || resolved.opportunityName || "",
          name: `${resolved.account} - ${resolved.oppName || resolved.opportunityName || ""}`,
          jobNo: shouldTrunc ? job.jobNo || "" : "",
          hours: hStr,
          days: dStr,
        };
      }
      return {
        name: job.jobName,
        jobNo: shouldTrunc ? job.jobNo || "" : "",
        hours: hStr,
        days: dStr,
      };
    },
    [resolveOppForJob, tlStartStr, tlEndStr, enabledHolidayDates, mdsHolidayDates]
  );

  return {
    resolveOppForJob,
    getJobLabel,
    getJobLabelParts,
    mdsHolidayDates,
    tlStartStr,
    tlEndStr,
  };
}
