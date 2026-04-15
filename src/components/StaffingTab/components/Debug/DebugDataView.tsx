import React, { useState, useMemo, useCallback, memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { getCategoryLabel } from "../../utils/categoryUtils";
import CloseIcon from "@mui/icons-material/Close";

const PAGE_SIZE = 50;

const TAB_DEFS = [
  { id: "staffing", label: "MDS (brut)" },
  { id: "sap", label: "SAP (brut)" },
];

const STAFFING_COLUMNS = [
  { key: "empId", label: "EmpId" },
  { key: "lastName", label: "Last name" },
  { key: "firstName", label: "First name" },
  { key: "jobNo", label: "Job No" },
  { key: "jobName", label: "Job Name" },
  { key: "startDate", label: "Start" },
  { key: "endDate", label: "End" },
  { key: "utilization", label: "Util %" },
  { key: "status", label: "Status" },
  { key: "hours", label: "Hours" },
  { key: "workingDays", label: "Working days" },
  { key: "hoursTotal", label: "Total hours" },
  { key: "hoursPerDay", label: "H/day" },
  { key: "category", label: "Category" },
];

const SAP_COLUMNS = [
  { key: "empId", label: "EmpId" },
  { key: "name", label: "Name" },
  { key: "date", label: "Date" },
  { key: "absenceType", label: "Att./Abs. Type" },
  { key: "text", label: "Text" },
  { key: "salesOrder", label: "Sales Order" },
  { key: "salesOrderItem", label: "SO Item" },
  { key: "hours", label: "Hours" },
  { key: "category", label: "Category" },
];

/* ── Flat list of SAP records from the lookup structure ── */
const flattenSapLookup = (lookup: Record<string, Record<string, { records?: any[] }>> | undefined) => {
  if (!lookup) return [];
  const rows: any[] = [];
  for (const empId of Object.keys(lookup)) {
    const dates = lookup[empId];
    for (const dateStr of Object.keys(dates)) {
      const { records } = dates[dateStr];
      if (records) records.forEach((r: any) => rows.push(r));
    }
  }
  rows.sort((a, b) => {
    const cmp = (a.empId || "").localeCompare(b.empId || "");
    return cmp !== 0 ? cmp : (a.date || "").localeCompare(b.date || "");
  });
  return rows;
};

/* ── Cell value formatter ── */
const fmt = (value: any, key: string) => {
  if (value == null || value === "") return "";
  if (key === "category") return getCategoryLabel(value);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
};

/* ── Apply column filters to rows ── */
const applyFilters = (rows: any, columns: any, filters: any) => {
  const activeFilters = Object.entries(filters).filter(([, v]) => v !== "");
  if (activeFilters.length === 0) return rows;
  return rows.filter((row: any) =>
    activeFilters.every(([key, search]) => {
      const col = columns.find((c: any) => c.key === key);
      if (!col) return true;
      const cellText = fmt(row[key], key).toLowerCase();
      return cellText.includes((search as string).toLowerCase());
    })
  );
};

/* ── Table component ── */
const DataTable = memo(({ rows, columns, filters, onFilterChange, page, onPageChange }: any) => {
  const filtered = useMemo(() => applyFilters(rows, columns, filters), [rows, columns, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const sliced = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleFilterInput = useCallback(
    (key: string, value: string) => {
      onFilterChange((prev: Record<string, string>) => ({ ...prev, [key]: value }));
      onPageChange(0);
    },
    [onFilterChange, onPageChange]
  );

  const clearAllFilters = useCallback(() => {
    onFilterChange({});
    onPageChange(0);
  }, [onFilterChange, onPageChange]);

  return (
    <>
      {/* toolbar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
          fontSize: "0.75rem",
          color: "text.secondary",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography component="span" sx={{ fontSize: "inherit", color: "inherit" }}>
            {filtered.length} lignes{activeFilterCount > 0 && ` (sur ${rows.length})`}
          </Typography>
          {activeFilterCount > 0 && (
            <Button
              onClick={clearAllFilters}
              size="small"
              startIcon={<CloseIcon sx={{ fontSize: 12 }} />}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: "#fef2f2",
                color: "#ef4444",
                fontSize: "0.75rem",
                textTransform: "none",
                minWidth: "auto",
                lineHeight: 1.5,
                border: "1px solid",
                borderColor: "#fecaca",
                "&:hover": { bgcolor: "#fee2e2" },
              }}
            >
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </Button>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            size="small"
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 1,
              border: "1px solid",
              borderColor: "#d1d5db",
              fontSize: "0.75rem",
              textTransform: "none",
              minWidth: "auto",
              color: "inherit",
              "&:disabled": { opacity: 0.3 },
              "&:hover": { bgcolor: "#f3f4f6" },
            }}
          >
            ← Prev
          </Button>
          <Typography component="span" sx={{ fontSize: "0.75rem", color: "inherit" }}>
            Page {page + 1} / {totalPages}
          </Typography>
          <Button
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
            size="small"
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 1,
              border: "1px solid",
              borderColor: "#d1d5db",
              fontSize: "0.75rem",
              textTransform: "none",
              minWidth: "auto",
              color: "inherit",
              "&:disabled": { opacity: 0.3 },
              "&:hover": { bgcolor: "#f3f4f6" },
            }}
          >
            Suiv →
          </Button>
        </Box>
      </Box>

      {/* table */}
      <Box sx={{ overflow: "auto", maxHeight: "70vh", border: "1px solid", borderColor: "#e5e7eb", borderRadius: 2 }}>
        <table style={{ minWidth: "100%", fontSize: "0.75rem", borderCollapse: "collapse" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
            {/* Header labels */}
            <tr>
              <th
                style={{
                  padding: "6px 8px",
                  backgroundColor: "#f3f4f6",
                  borderBottom: "1px solid #e5e7eb",
                  borderRight: "1px solid #e5e7eb",
                  color: "text.secondary",
                  fontWeight: 500,
                  textAlign: "right",
                  width: 40,
                }}
              >
                #
              </th>
              {columns.map((col: { key: string; label: string }) => (
                <th
                  key={col.key}
                  style={{
                    padding: "6px 8px",
                    backgroundColor: "#f3f4f6",
                    borderBottom: "1px solid #e5e7eb",
                    borderRight: "1px solid #e5e7eb",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "text.secondary",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
            {/* Filter row */}
            <tr>
              <th
                style={{
                  padding: "4px",
                  backgroundColor: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
                  borderRight: "1px solid #e5e7eb",
                }}
              />
              {columns.map((col: { key: string; label: string }) => (
                <th
                  key={col.key}
                  style={{
                    padding: "4px",
                    backgroundColor: "#f9fafb",
                    borderBottom: "1px solid #e5e7eb",
                    borderRight: "1px solid #e5e7eb",
                  }}
                >
                  <TextField
                    type="text"
                    value={filters[col.key] || ""}
                    onChange={(e) => handleFilterInput(col.key, e.target.value)}
                    placeholder="Filter..."
                    variant="outlined"
                    size="small"
                    sx={{
                      width: "100%",
                      "& .MuiInputBase-input": {
                        px: 0.75,
                        py: 0.25,
                        fontSize: "0.75rem",
                        fontWeight: 400,
                      },
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 1,
                        bgcolor: "white",
                        "& fieldset": {
                          borderColor: "#e5e7eb",
                        },
                        "&:hover fieldset": {
                          borderColor: "#e5e7eb",
                        },
                        "&.Mui-focused fieldset": {
                          borderWidth: 1,
                          borderColor: "#60a5fa",
                          boxShadow: "0 0 0 1px #60a5fa",
                        },
                      },
                      "& .MuiInputBase-input::placeholder": {
                        color: "#d1d5db",
                        opacity: 1,
                      },
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sliced.map((row: any, i: number) => (
              <tr key={page * PAGE_SIZE + i} style={{ backgroundColor: i % 2 === 0 ? "white" : "#f9fafb" }}>
                <td
                  style={{
                    padding: "4px 8px",
                    borderRight: "1px solid #f3f4f6",
                    textAlign: "right",
                    color: "text.disabled",
                    fontFamily: "monospace",
                  }}
                >
                  {page * PAGE_SIZE + i + 1}
                </td>
                {columns.map((col: { key: string; label: string }) => (
                  <td
                    key={col.key}
                    style={{
                      padding: "4px 8px",
                      borderRight: "1px solid #f3f4f6",
                      whiteSpace: "nowrap",
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {fmt(row[col.key], col.key)}
                  </td>
                ))}
              </tr>
            ))}
            {sliced.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  style={{ padding: "32px 0", textAlign: "center", color: "text.disabled" }}
                >
                  {activeFilterCount > 0 ? "No results for these filters" : "No data imported"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Box>
    </>
  );
});
DataTable.displayName = "DataTable";

/* ── Main component ── */
const DebugDataView = ({ rawData, sapData }: any) => {
  const [activeSubTab, setActiveSubTab] = useState("staffing");
  const [staffingPage, setStaffingPage] = useState(0);
  const [sapPage, setSapPage] = useState(0);
  const [staffingFilters, setStaffingFilters] = useState<Record<string, string>>({});
  const [sapFilters, setSapFilters] = useState<Record<string, string>>({});

  const sapRows = useMemo(() => flattenSapLookup(sapData?.lookup), [sapData]);

  const hasSap = sapRows.length > 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Sub-tabs */}
      <Box sx={{ display: "flex", gap: 1 }}>
        {TAB_DEFS.map(({ id, label }: any) => {
          const disabled = id === "sap" && !hasSap;
          return (
            <Button
              key={id}
              onClick={() => !disabled && setActiveSubTab(id)}
              disabled={disabled}
              sx={{
                px: 1.5,
                py: 0.75,
                fontSize: "0.875rem",
                borderRadius: 2,
                fontWeight: 500,
                textTransform: "none",
                transition: "background-color 0.15s, color 0.15s",
                minWidth: "auto",
                ...(activeSubTab === id
                  ? {
                      bgcolor: "text.primary",
                      color: "white",
                      "&:hover": { bgcolor: "text.primary" },
                    }
                  : disabled
                    ? {
                        bgcolor: "#f3f4f6",
                        color: "#d1d5db",
                        cursor: "not-allowed",
                        "&.Mui-disabled": {
                          bgcolor: "#f3f4f6",
                          color: "#d1d5db",
                        },
                      }
                    : {
                        bgcolor: "#f3f4f6",
                        color: "text.secondary",
                        "&:hover": { bgcolor: "#e5e7eb" },
                      }),
              }}
            >
              {label}
              {id === "staffing" && (
                <Typography component="span" sx={{ ml: 0.75, fontSize: "0.75rem", opacity: 0.6 }}>
                  ({rawData.length})
                </Typography>
              )}
              {id === "sap" && hasSap && (
                <Typography component="span" sx={{ ml: 0.75, fontSize: "0.75rem", opacity: 0.6 }}>
                  ({sapRows.length})
                </Typography>
              )}
            </Button>
          );
        })}
      </Box>

      {/* Table */}
      {activeSubTab === "staffing" && (
        <DataTable
          rows={rawData}
          columns={STAFFING_COLUMNS}
          filters={staffingFilters}
          onFilterChange={setStaffingFilters}
          page={staffingPage}
          onPageChange={setStaffingPage}
        />
      )}
      {activeSubTab === "sap" && (
        <DataTable
          rows={sapRows}
          columns={SAP_COLUMNS}
          filters={sapFilters}
          onFilterChange={setSapFilters}
          page={sapPage}
          onPageChange={setSapPage}
        />
      )}
    </Box>
  );
};

export default DebugDataView;
