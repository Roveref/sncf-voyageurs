import React, { memo, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import WorkIcon from "@mui/icons-material/Work";
import GroupIcon from "@mui/icons-material/Group";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SearchIcon from "@mui/icons-material/Search";
import WarningIcon from "@mui/icons-material/Warning";
import { TimelineBackground, MonthLabels } from "../Timeline";
import { getCategoryBarColor, getCategoryLabel } from "../../utils/categoryUtils";
import { calculateBarPosition } from "../../utils/timelineUtils";
import { JOB_CATEGORIES, CATEGORY_LABELS, CATEGORY_BADGE_COLORS, MS_PER_DAY } from "../../constants";
import { CATEGORY_THEME } from "../../constants/theme";
import { easing } from "../../../../styles/animations";

/**
 * Project card header
 */
const ProjectHeader = memo(({ project, isExpanded, onToggle }: any) => {
  const categoryTheme = CATEGORY_THEME[project.category] || CATEGORY_THEME.unknown;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        p: 1.5,
        bgcolor: "background.default",
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        cursor: "pointer",
        transition: `background-color 0.3s ${easing.elegant}`,
        "&:hover": { bgcolor: "#f3f4f6" },
      }}
      onClick={onToggle}
    >
      {isExpanded ? (
        <ExpandMoreIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
      ) : (
        <ChevronRightIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
      )}

      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography component="h3" sx={{ fontWeight: 500, color: "text.primary" }}>
            {project.jobName}
          </Typography>
          <Box
            component="span"
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 1,
              fontSize: "0.75rem",
              bgcolor: categoryTheme.bg,
              color: categoryTheme.text,
            }}
          >
            {getCategoryLabel(project.category)}
          </Box>
          {project.hasProvisional && (
            <Box
              component="span"
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontSize: "0.75rem",
                bgcolor: "#fff7ed",
                color: "#9a3412",
              }}
            >
              Provisional
            </Box>
          )}
        </Box>
        {project.jobNo && (
          <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>Code: {project.jobNo}</Typography>
        )}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.875rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
          <GroupIcon sx={{ fontSize: 16 }} />
          <Box component="span">{project.employeeCount} employees</Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
          <AccessTimeIcon sx={{ fontSize: 16 }} />
          <Box component="span">{project.totalHours.toFixed(0)}h</Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
          <CalendarTodayIcon sx={{ fontSize: 16 }} />
          <Box component="span">
            {project.earliestStart} - {project.latestEnd}
          </Box>
        </Box>
      </Box>
    </Box>
  );
});

ProjectHeader.displayName = "ProjectHeader";

/**
 * Employee row in project view
 */
const ProjectEmployeeRow = memo(
  ({ employee, timelineStart, timelineEnd, weekendMarkers, holidayMarkers, category }: any) => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        py: 1,
        borderBottom: 1,
        borderColor: "#f3f4f6",
        "&:last-child": { borderBottom: 0 },
      }}
    >
      <Box sx={{ width: 192, flexShrink: 0, pr: 2 }}>
        <Box sx={{ fontWeight: 500, color: "text.primary", fontSize: "0.875rem" }}>{employee.name}</Box>
        <Box sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{employee.totalHours.toFixed(1)}h total</Box>
      </Box>
      <Box sx={{ flex: 1, position: "relative", height: 24, bgcolor: "#f3f4f6", borderRadius: 1 }}>
        <TimelineBackground
          weekendMarkers={weekendMarkers}
          holidayMarkers={holidayMarkers}
          labels={[]}
          showGrid={false}
        />
        {employee.periods.map((period: any, idx: number) => {
          const { left, width } = calculateBarPosition(period.startDate, period.endDate, timelineStart, timelineEnd);
          const barColor = getCategoryBarColor(category, period.utilization);

          return (
            <Box
              key={idx}
              sx={{
                position: "absolute",
                height: 20,
                top: 2,
                borderRadius: 1,
                fontSize: "0.75rem",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                left: `calc(${left}% - 4px)`,
                width: `calc(${width}% - 1px)`,
                opacity: period.status === "P" ? 0.7 : 0.9,
                backgroundColor: barColor,
              }}
              title={`${period.startDate} - ${period.endDate} (${period.hoursPerDay.toFixed(1)}h/day)`}
            >
              {width > 10 && (
                <Box
                  component="span"
                  sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", px: 0.5 }}
                >
                  {period.hoursPerDay.toFixed(1)}h
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  )
);

ProjectEmployeeRow.displayName = "ProjectEmployeeRow";

/**
 * Project expanded content
 */
const ProjectContent = memo(
  ({ project, timelineStart, timelineEnd, weekendMarkers, holidayMarkers, monthLabels }: any) => (
    <Box sx={{ p: 2, bgcolor: "#fff" }}>
      <Box sx={{ mb: 1.5 }}>
        <MonthLabels labels={monthLabels} />
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {project.employees.map((employee: any) => (
          <ProjectEmployeeRow
            key={employee.empId}
            employee={employee}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            weekendMarkers={weekendMarkers}
            holidayMarkers={holidayMarkers}
            category={project.category}
          />
        ))}
      </Box>
    </Box>
  )
);

ProjectContent.displayName = "ProjectContent";

/**
 * Single project card
 */
const ProjectCard = memo(
  ({ project, isExpanded, onToggle, timelineStart, timelineEnd, weekendMarkers, holidayMarkers, monthLabels }: any) => (
    <Box sx={{ border: 1, borderColor: "grey.200", borderRadius: 2, overflow: "hidden" }}>
      <ProjectHeader project={project} isExpanded={isExpanded} onToggle={onToggle} />
      {isExpanded && (
        <ProjectContent
          project={project}
          timelineStart={timelineStart}
          timelineEnd={timelineEnd}
          weekendMarkers={weekendMarkers}
          holidayMarkers={holidayMarkers}
          monthLabels={monthLabels}
        />
      )}
    </Box>
  )
);

ProjectCard.displayName = "ProjectCard";

/**
 * Projects ending soon widget
 */
export const ProjectsEndingSoon = memo(({ projects, daysThreshold = 30 }: any) => {
  const endingSoon = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return projects
      .filter((p: any) => p.category === JOB_CATEGORIES.CHARGEABLE)
      .map((project: any) => {
        const endDate = new Date(project.latestEnd);
        const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / MS_PER_DAY);
        return { ...project, daysUntilEnd };
      })
      .filter((p: any) => p.daysUntilEnd >= 0 && p.daysUntilEnd <= daysThreshold)
      .sort((a: any, b: any) => a.daysUntilEnd - b.daysUntilEnd)
      .slice(0, 5);
  }, [projects, daysThreshold]);

  if (endingSoon.length === 0) return null;

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: 2, border: 1, borderColor: "grey.200", p: 2 }}>
      <Typography
        component="h3"
        sx={{ fontWeight: 500, color: "text.primary", mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}
      >
        <WarningIcon sx={{ fontSize: 20, color: "#f97316" }} />
        Projects ending soon
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {endingSoon.map((project: any) => (
          <Box
            key={project.jobNo || project.jobName}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 1,
              bgcolor: "#fff7ed",
              borderRadius: 1,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.primary" }}>
                {project.jobName}
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                {project.employeeCount} employees
              </Typography>
            </Box>
            <Box
              sx={{
                fontSize: "0.875rem",
                fontWeight: 500,
                ...(project.daysUntilEnd <= 7
                  ? { color: "#ef4444" }
                  : project.daysUntilEnd <= 14
                    ? { color: "#ea580c" }
                    : { color: "#ca8a04" }),
              }}
            >
              {project.daysUntilEnd === 0
                ? "Today"
                : project.daysUntilEnd === 1
                  ? "Tomorrow"
                  : `${project.daysUntilEnd} days`}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
});

ProjectsEndingSoon.displayName = "ProjectsEndingSoon";

/**
 * Project statistics summary
 */
export const ProjectStats = memo(({ projects }: any) => {
  const stats = useMemo(() => {
    const chargeable = projects.filter((p: any) => p.category === JOB_CATEGORIES.CHARGEABLE);
    const totalEmployees = new Set(projects.flatMap((p: any) => p.employees.map((e: any) => e.empId))).size;

    return {
      totalProjects: projects.length,
      chargeableProjects: chargeable.length,
      totalEmployees,
      totalHours: projects.reduce((sum: number, p: any) => sum + p.totalHours, 0),
    };
  }, [projects]);

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
      <Box sx={{ bgcolor: "#eff6ff", borderRadius: 2, p: 1.5, border: 1, borderColor: "#bfdbfe" }}>
        <Typography sx={{ fontSize: "0.875rem", color: "primary.main" }}>Total projets</Typography>
        <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#1d4ed8" }}>{stats.totalProjects}</Typography>
      </Box>
      <Box sx={{ bgcolor: "#f0fdf4", borderRadius: 2, p: 1.5, border: 1, borderColor: "#bbf7d0" }}>
        <Typography sx={{ fontSize: "0.875rem", color: "#16a34a" }}>Projets facturables</Typography>
        <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#15803d" }}>
          {stats.chargeableProjects}
        </Typography>
      </Box>
      <Box sx={{ bgcolor: "#faf5ff", borderRadius: 2, p: 1.5, border: 1, borderColor: "#e9d5ff" }}>
        <Typography sx={{ fontSize: "0.875rem", color: "#9333ea" }}>Collaborateurs affectés</Typography>
        <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#7e22ce" }}>{stats.totalEmployees}</Typography>
      </Box>
      <Box sx={{ bgcolor: "#fff7ed", borderRadius: 2, p: 1.5, border: 1, borderColor: "#fed7aa" }}>
        <Typography sx={{ fontSize: "0.875rem", color: "#ea580c" }}>Heures totales</Typography>
        <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#c2410c" }}>
          {stats.totalHours.toFixed(0)}h
        </Typography>
      </Box>
    </Box>
  );
});

ProjectStats.displayName = "ProjectStats";

/**
 * Main Project View component
 */
export const ProjectView = memo(
  ({ projects, timelineStart, timelineEnd, weekendMarkers, holidayMarkers, monthLabels }: any) => {
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");

    const filteredProjects = useMemo(() => {
      let result = projects;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter(
          (p: any) => p.jobName.toLowerCase().includes(query) || (p.jobNo && p.jobNo.toLowerCase().includes(query))
        );
      }

      if (categoryFilter !== "all") {
        result = result.filter((p: any) => p.category === categoryFilter);
      }

      return result;
    }, [projects, searchQuery, categoryFilter]);

    const toggleProject = (projectKey: string) => {
      setExpandedProjects((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(projectKey)) {
          newSet.delete(projectKey);
        } else {
          newSet.add(projectKey);
        }
        return newSet;
      });
    };

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Stats */}
        <ProjectStats projects={projects} />

        {/* Search and filters */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ position: "relative", flex: 1 }}>
            <SearchIcon
              sx={{
                fontSize: 16,
                color: "text.disabled",
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
            <Box
              component="input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              sx={{
                width: "100%",
                pl: "40px",
                pr: 2,
                py: 1,
                border: 1,
                borderColor: "#d1d5db",
                borderRadius: 2,
                fontSize: "0.875rem",
                outline: "none",
                "&:focus": {
                  outline: "none",
                  boxShadow: "0 0 0 2px #3b82f6",
                },
              }}
            />
          </Box>
          <Box
            component="select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            sx={{
              px: 1.5,
              py: 1,
              border: 1,
              borderColor: "#d1d5db",
              borderRadius: 2,
              fontSize: "0.875rem",
            }}
          >
            <option value="all">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Box>
        </Box>

        {/* Projects ending soon */}
        <ProjectsEndingSoon projects={projects} />

        {/* Project list */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {filteredProjects.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
              <WorkIcon sx={{ fontSize: 48, display: "block", mx: "auto", mb: 1.5, color: "#d1d5db" }} />
              <Typography>Aucun projet trouvé</Typography>
            </Box>
          ) : (
            filteredProjects.map((project: any) => {
              const projectKey = project.jobNo || project.jobName;
              return (
                <ProjectCard
                  key={projectKey}
                  project={project}
                  isExpanded={expandedProjects.has(projectKey)}
                  onToggle={() => toggleProject(projectKey)}
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                  weekendMarkers={weekendMarkers}
                  holidayMarkers={holidayMarkers}
                  monthLabels={monthLabels}
                />
              );
            })
          )}
        </Box>

        {/* Count */}
        <Box sx={{ fontSize: "0.875rem", color: "text.secondary", textAlign: "center" }}>
          {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""} shown
        </Box>
      </Box>
    );
  }
);

ProjectView.displayName = "ProjectView";
