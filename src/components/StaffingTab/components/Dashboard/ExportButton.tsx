import React, { memo, useState, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import DownloadIcon from "@mui/icons-material/Download";
import GroupIcon from "@mui/icons-material/Group";
import WorkIcon from "@mui/icons-material/Work";
import WarningIcon from "@mui/icons-material/Warning";
import TableChartIcon from "@mui/icons-material/TableChart";
import PrintIcon from "@mui/icons-material/Print";
import {
  exportEmployeesToExcel,
  exportProjectsToExcel,
  exportAlertsToExcel,
  exportKPISummaryToExcel,
  generateFilename,
} from "../../utils/exportUtils";
import { exportToCsv, exportToPdf } from "../../../../utils/exportUtils";
import SlideshowIcon from "@mui/icons-material/Slideshow";

/**
 * Export menu item
 */
const ExportMenuItem = memo(({ icon: Icon, label, description, onClick, iconColor }: any) => (
  <Button
    onClick={onClick}
    fullWidth
    sx={{
      justifyContent: "flex-start",
      textAlign: "left",
      textTransform: "none",
      gap: 1.5,
      p: 1.5,
      borderRadius: 2,
      "&:hover": { bgcolor: "grey.50" },
    }}
  >
    <Icon sx={{ fontSize: 20, color: iconColor || "grey.500", mt: 0.25 }} />
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary" }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: "grey.500" }}>
        {description}
      </Typography>
    </Box>
  </Button>
));

ExportMenuItem.displayName = "ExportMenuItem";

/**
 * Export dropdown menu
 */
export const ExportButton = memo(
  ({
    employees = [],
    projects = [],
    alerts = [],
    teamTuStats = {},
    compact = false,
    dropdownPosition = "bottom-right",
  }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleExportEmployees = () => {
      exportEmployeesToExcel(employees, generateFilename("employees"));
      setIsOpen(false);
    };

    const handleExportProjects = () => {
      exportProjectsToExcel(projects, generateFilename("projects"));
      setIsOpen(false);
    };

    const handleExportAlerts = () => {
      exportAlertsToExcel(alerts, generateFilename("alerts"));
      setIsOpen(false);
    };

    const handleExportEmployeesCsv = () => {
      const csvData = employees.map((emp: any) => ({
        "Employee ID": emp.empId,
        Name: emp.name,
        Grade: emp.grade || "",
        Team: emp.subTeam || "",
        Projects: emp.projectCount,
        "Utilization Rate (%)": emp.trueUtilizationRate?.toFixed(1) ?? "",
        "Billable Hours": emp.chargeableHours?.toFixed(1) ?? "",
        "Billable Days": emp.chargeableHours ? (emp.chargeableHours / 8).toFixed(1) : "",
        "Absence Hours": emp.absenceHours?.toFixed(1) ?? "",
        "Net Available Hours": emp.netAvailableHours?.toFixed(1) ?? "",
      }));
      const date = new Date().toISOString().split("T")[0];
      exportToCsv(csvData, `employees-${date}.csv`);
      setIsOpen(false);
    };

    const handleExportPrint = () => {
      setIsOpen(false);
      exportToPdf("main-content", "staffing.pdf");
    };

    const handleExportPpt = async () => {
      setIsOpen(false);
      const today = new Date().toISOString().split("T")[0];
      try {
        const { exportPptxViaApi, svgToBase64 } = await import("../../../../utils/exportUtils");
        const { default: html2canvas } = await import("html2canvas-pro");

        // Helper: capture a DOM element as base64 PNG (fallback for non-SVG or older PowerPoint)
        const capturePng = async (el: HTMLElement | null): Promise<string | undefined> => {
          if (!el) return undefined;
          const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
          return canvas.toDataURL("image/png").split(",")[1];
        };

        // Find Recharts SVG elements in the dashboard
        const mainEl = document.getElementById("main-content");
        const svgEls = mainEl
          ? Array.from(mainEl.querySelectorAll<SVGSVGElement>(".recharts-wrapper svg.recharts-surface"))
          : [];

        // Build KPI text from props
        const tuPct = teamTuStats?.tu != null ? `${teamTuStats.tu.toFixed(1)}%` : "N/A";
        const headcount = employees.length;
        const alertCount = alerts.length;

        // Build slides
        const slides: Array<{
          layout: string;
          title?: string;
          subtitle?: string;
          body?: string;
          imageBase64?: string;
          svgBase64?: string;
        }> = [
          { layout: "title", title: "Staffing Dashboard", subtitle: `Report — ${today}` },
          {
            layout: "content",
            title: "Key Performance Indicators",
            body: [
              `**Team Utilization:** ${tuPct}`,
              `**Headcount:** ${headcount} employees`,
              `**Active Alerts:** ${alertCount}`,
              "",
              "Overview of team staffing, utilization rates, and capacity allocation.",
            ].join("\n"),
          },
        ];

        // Create a slide per chart with SVG (primary) + PNG (fallback)
        const chartLabels = [
          "Utilization Overview",
          "Grade Distribution",
          "Team Breakdown",
          "Trend Analysis",
          "Capacity Heatmap",
        ];
        for (let i = 0; i < Math.min(svgEls.length, 5); i++) {
          const svg = svgEls[i];
          const wrapper = svg.closest(".recharts-wrapper") as HTMLElement | null;
          const name =
            (wrapper || svg).closest("[data-chart-name]")?.getAttribute("data-chart-name") ||
            chartLabels[i] ||
            `Chart ${i + 1}`;

          // Extract SVG with inlined styles (vector, crisp in PowerPoint 2019+)
          const svgB64 = svgToBase64(svg);
          // PNG fallback for older PowerPoint versions
          const pngB64 = await capturePng(wrapper || svg.parentElement);

          slides.push({
            layout: "content",
            title: name,
            body: `${name} for the current staffing period.`,
            svgBase64: svgB64,
            imageBase64: pngB64,
          });
        }

        // If no SVG charts found, capture the whole dashboard as PNG
        if (svgEls.length === 0 && mainEl) {
          const pngB64 = await capturePng(mainEl);
          slides.push({
            layout: "content",
            title: "Dashboard View",
            body: "Full dashboard capture for the current staffing period.",
            imageBase64: pngB64,
          });
        }

        slides.push({ layout: "end", body: "BearingPoint — Confidential" });

        await exportPptxViaApi(slides, `staffing_${today}`);
      } catch (err) {
        console.warn("PPTX API failed, falling back to PNG export:", err);
        const { exportForPowerPoint } = await import("../../../../utils/exportUtils");
        await exportForPowerPoint("main-content", `staffing_${today}`);
      }
    };

    return (
      <Box sx={{ position: "relative" }} ref={menuRef}>
        <Button
          onClick={() => setIsOpen(!isOpen)}
          variant={compact ? "text" : "contained"}
          title="Export"
          sx={
            compact
              ? {
                  width: "100%",
                  justifyContent: "flex-start",
                  gap: 1.5,
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  textTransform: "none",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "grey.300",
                  "&:hover": { bgcolor: "grey.800" },
                }
              : {
                  gap: 1,
                  textTransform: "none",
                  bgcolor: "#16a34a",
                  "&:hover": { bgcolor: "#15803d" },
                }
          }
          startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
        >
          {compact ? <Typography noWrap>Export</Typography> : "Export"}
        </Button>

        {isOpen && (
          <Paper
            elevation={4}
            sx={{
              position: "absolute",
              width: 288,
              borderRadius: 2,
              border: 1,
              borderColor: "grey.200",
              zIndex: 50,
              ...(dropdownPosition === "right" ? { left: "100%", top: 0, ml: 1 } : { right: 0, mt: 1 }),
            }}
          >
            <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 500,
                  color: "grey.500",
                  textTransform: "uppercase",
                  px: 1.5,
                  py: 0.5,
                  display: "block",
                }}
              >
                Export to Excel
              </Typography>
            </Box>

            <Box sx={{ p: 1 }}>
              <ExportMenuItem
                icon={GroupIcon}
                label="Employees"
                description="Employee summary and assignments"
                onClick={handleExportEmployees}
              />

              <ExportMenuItem
                icon={WorkIcon}
                label="Projects"
                description="Project list and assignments"
                onClick={handleExportProjects}
              />

              <ExportMenuItem
                icon={WarningIcon}
                label="Alerts"
                description="All active alerts"
                onClick={handleExportAlerts}
              />

              <ExportMenuItem
                icon={DownloadIcon}
                label="KPI Report"
                description="KPIs, distribution, by grade and team"
                onClick={() => {
                  exportKPISummaryToExcel(employees, teamTuStats, alerts, generateFilename("kpi_report"));
                  setIsOpen(false);
                }}
              />
            </Box>

            <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 500,
                  color: "grey.500",
                  textTransform: "uppercase",
                  px: 1.5,
                  py: 0.5,
                  display: "block",
                }}
              >
                Other Formats
              </Typography>
            </Box>

            <Box sx={{ p: 1 }}>
              <ExportMenuItem
                icon={TableChartIcon}
                label="Employees CSV"
                description="Employee summary as CSV file"
                onClick={handleExportEmployeesCsv}
              />

              <ExportMenuItem
                icon={PrintIcon}
                label="Print / PDF"
                description="Print current view or save as PDF"
                onClick={handleExportPrint}
              />

              <ExportMenuItem
                icon={SlideshowIcon}
                label="Export PowerPoint"
                description="PNG 3x + charts SVG for presentations"
                onClick={handleExportPpt}
                iconColor="#D24726"
              />
            </Box>

            <Box
              sx={{
                p: 1,
                borderTop: 1,
                borderColor: "divider",
                bgcolor: "grey.50",
                borderBottomLeftRadius: 8,
                borderBottomRightRadius: 8,
              }}
            >
              <Typography variant="caption" sx={{ color: "grey.500", px: 1.5, display: "block" }}>
                Excel files in .xlsx, CSV as .csv
              </Typography>
            </Box>
          </Paper>
        )}
      </Box>
    );
  }
);

ExportButton.displayName = "ExportButton";
