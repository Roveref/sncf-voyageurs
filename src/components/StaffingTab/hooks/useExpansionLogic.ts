import { useState, useMemo, useCallback, useRef } from "react";

/**
 * Manages expand/collapse state for grouped rows (by depth level) and per-employee Gantt detail.
 * Returns toggle handlers and the current progressive expansion level.
 */
export function useExpansionLogic(displayedEmployees: any[], groupedEmployees: any) {
  const [employeeLevel, setEmployeeLevel] = useState<Map<string, number>>(new Map());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Collect all group keys by depth for progressive expand/collapse
  const groupKeysByDepth = useMemo(() => {
    if (!groupedEmployees) return { byDepth: new Map(), allKeys: [], maxDepth: -1 };
    const byDepth = new Map();
    const allKeys: string[] = [];
    const collect = (groups: any[], parentKey = "", depth = 0) => {
      groups.forEach((g: any) => {
        if (g._renderFlat) return;
        const key = parentKey ? `${parentKey}::${g.name}` : g.name;
        allKeys.push(key);
        if (!byDepth.has(depth)) byDepth.set(depth, []);
        byDepth.get(depth).push(key);
        if (g._dmSubGroups) collect(g._dmSubGroups, key, depth + 1);
        if (g.subGroups) collect(g.subGroups, key, depth + 1);
      });
    };
    collect(groupedEmployees);
    return { byDepth, allKeys, maxDepth: byDepth.size - 1 };
  }, [groupedEmployees]);

  // Current progressive expansion level
  const currentExpansionLevel = useMemo(() => {
    const { byDepth, maxDepth } = groupKeysByDepth;
    if (maxDepth < 0) return 0;
    let level = 0;
    for (let d = 0; d <= maxDepth; d++) {
      const keys = byDepth.get(d) || [];
      if (keys.length > 0 && keys.every((k: string) => !collapsedGroups.has(k))) {
        level = d + 1;
      } else break;
    }
    if (
      level > maxDepth &&
      displayedEmployees.length > 0 &&
      displayedEmployees.every((e: any) => (employeeLevel.get(e.empId) || 0) >= 2)
    ) {
      level = maxDepth + 2;
    }
    return level;
  }, [groupKeysByDepth, collapsedGroups, employeeLevel, displayedEmployees]);

  // Refs for stable handlers (avoids MonthHeaderBar re-renders on filter changes)
  const groupKeysByDepthRef = useRef(groupKeysByDepth);
  groupKeysByDepthRef.current = groupKeysByDepth;
  const currentExpansionLevelRef = useRef(currentExpansionLevel);
  currentExpansionLevelRef.current = currentExpansionLevel;
  const displayedEmployeesRef = useRef(displayedEmployees);
  displayedEmployeesRef.current = displayedEmployees;
  const groupedEmployeesRef = useRef(groupedEmployees);
  groupedEmployeesRef.current = groupedEmployees;
  const collapsedGroupsRef = useRef(collapsedGroups);
  collapsedGroupsRef.current = collapsedGroups;
  const employeeLevelRef = useRef(employeeLevel);
  employeeLevelRef.current = employeeLevel;

  // Progressive expand: advance one level (groups depth by depth, then employees)
  const handleProgressiveExpand = useCallback(() => {
    const { byDepth, maxDepth } = groupKeysByDepthRef.current;
    const level = currentExpansionLevelRef.current;
    if (maxDepth >= 0 && level <= maxDepth) {
      const keysToExpand = byDepth.get(level) || [];
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        keysToExpand.forEach((k: string) => next.delete(k));
        return next;
      });
    } else if (maxDepth < 0 || level === maxDepth + 1) {
      // No groups or all groups expanded → expand employees
      const m = new Map();
      displayedEmployeesRef.current.forEach((e: any) => m.set(e.empId, 2));
      setEmployeeLevel(m);
    }
  }, []);

  // Progressive collapse: employees first (if any expanded), then deepest expanded group level
  const handleProgressiveCollapse = useCallback(() => {
    // Always collapse employees first if any are expanded
    const elvl = employeeLevelRef.current;
    const anyEmployeeExpanded = displayedEmployeesRef.current.some((e: any) => (elvl.get(e.empId) || 0) >= 2);
    if (anyEmployeeExpanded) {
      setEmployeeLevel(new Map());
      return;
    }
    // Then find the deepest group level that has any expanded groups and collapse it
    const { byDepth, maxDepth } = groupKeysByDepthRef.current;
    let deepestExpanded = -1;
    for (let d = 0; d <= maxDepth; d++) {
      const keys = byDepth.get(d) || [];
      if (keys.some((k: string) => !collapsedGroupsRef.current.has(k))) {
        deepestExpanded = d;
      }
    }
    if (deepestExpanded >= 0) {
      const keysToCollapse = byDepth.get(deepestExpanded) || [];
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        keysToCollapse.forEach((k: string) => next.add(k));
        return next;
      });
    }
  }, []);

  // Helper: collect subtree info for a given group key
  const getSubtreeInfo = useCallback((groupKey: string) => {
    const subKeysByDepth = new Map();
    const empIds: string[] = [];
    const findGroup = (groups: any[], parentKey = "", depth = 0) => {
      for (const g of groups) {
        const key = parentKey ? `${parentKey}::${g.name}` : g.name;
        if (key === groupKey) {
          // Found the group — collect its subtree
          const collectSub = (subGroups: any[], subParentKey: string, subDepth: number) => {
            if (!subGroups) return;
            subGroups.forEach((sg: any) => {
              const sk = `${subParentKey}::${sg.name}`;
              if (!subKeysByDepth.has(subDepth)) subKeysByDepth.set(subDepth, []);
              subKeysByDepth.get(subDepth).push(sk);
              if (sg._dmSubGroups) collectSub(sg._dmSubGroups, sk, subDepth + 1);
              if (sg.subGroups) collectSub(sg.subGroups, sk, subDepth + 1);
            });
          };
          if (g._dmSubGroups) collectSub(g._dmSubGroups, key, 0);
          if (g.subGroups) collectSub(g.subGroups, key, 0);
          // Collect all employee ids recursively
          const collectEmps = (group: any) => {
            if (group._leafEmployees) group._leafEmployees.forEach((e: any) => empIds.push(e.empId));
            if (group.employees && !group.subGroups) group.employees.forEach((e: any) => empIds.push(e.empId));
            if (group._dmSubGroups) group._dmSubGroups.forEach(collectEmps);
            if (group.subGroups) group.subGroups.forEach(collectEmps);
          };
          collectEmps(g);
          return true;
        }
        if (g._dmSubGroups && findGroup(g._dmSubGroups, key, depth + 1)) return true;
        if (g.subGroups && findGroup(g.subGroups, key, depth + 1)) return true;
      }
      return false;
    };
    findGroup(groupedEmployeesRef.current || []);
    return { subKeysByDepth, empIds, maxSubDepth: subKeysByDepth.size - 1 };
  }, []);

  // Scoped progressive expand for a specific group
  const handleScopedExpand = useCallback(
    (groupKey: string) => {
      const { subKeysByDepth, empIds, maxSubDepth } = getSubtreeInfo(groupKey);
      // Determine scoped expansion level
      let scopedLevel = 0;
      for (let d = 0; d <= maxSubDepth; d++) {
        const keys = subKeysByDepth.get(d) || [];
        if (keys.length > 0 && keys.every((k: string) => !collapsedGroupsRef.current.has(k))) {
          scopedLevel = d + 1;
        } else break;
      }
      if (scopedLevel > maxSubDepth && empIds.length > 0) {
        const elvl = employeeLevelRef.current;
        if (empIds.every((id: string) => (elvl.get(id) || 0) >= 2)) return; // already fully expanded
        // Expand employees
        setEmployeeLevel((prev) => {
          const m = new Map(prev);
          empIds.forEach((id: string) => m.set(id, 2));
          return m;
        });
      } else if (scopedLevel <= maxSubDepth) {
        const keysToExpand = subKeysByDepth.get(scopedLevel) || [];
        setCollapsedGroups((prev) => {
          const next = new Set(prev);
          keysToExpand.forEach((k: string) => next.delete(k));
          return next;
        });
      } else {
        // No subgroups — just expand employees
        setEmployeeLevel((prev) => {
          const m = new Map(prev);
          empIds.forEach((id: string) => m.set(id, 2));
          return m;
        });
      }
    },
    [getSubtreeInfo]
  );

  // Scoped progressive collapse: employees first, then deepest expanded subgroup level
  const handleScopedCollapse = useCallback(
    (groupKey: string) => {
      const { subKeysByDepth, empIds, maxSubDepth } = getSubtreeInfo(groupKey);
      // Always collapse employees first if any are expanded in this scope
      const elvl = employeeLevelRef.current;
      const anyEmployeeExpanded = empIds.some((id: string) => (elvl.get(id) || 0) >= 2);
      if (anyEmployeeExpanded) {
        setEmployeeLevel((prev) => {
          const m = new Map(prev);
          empIds.forEach((id: string) => m.delete(id));
          return m;
        });
        return;
      }
      // Then find the deepest subgroup level with any expanded groups and collapse it
      let deepestExpanded = -1;
      for (let d = 0; d <= maxSubDepth; d++) {
        const keys = subKeysByDepth.get(d) || [];
        if (keys.some((k: string) => !collapsedGroupsRef.current.has(k))) {
          deepestExpanded = d;
        }
      }
      if (deepestExpanded >= 0) {
        const keysToCollapse = subKeysByDepth.get(deepestExpanded) || [];
        setCollapsedGroups((prev) => {
          const next = new Set(prev);
          keysToCollapse.forEach((k: string) => next.add(k));
          return next;
        });
      }
    },
    [getSubtreeInfo]
  );

  return {
    employeeLevel,
    setEmployeeLevel,
    collapsedGroups,
    setCollapsedGroups,
    groupKeysByDepth,
    currentExpansionLevel,
    handleProgressiveExpand,
    handleProgressiveCollapse,
    handleScopedExpand,
    handleScopedCollapse,
    // Expose refs for external consumers that need them
    collapsedGroupsRef,
    employeeLevelRef,
    groupKeysByDepthRef,
    currentExpansionLevelRef,
    displayedEmployeesRef,
    groupedEmployeesRef,
  };
}
