import React, { memo, useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { easing } from "../../../../styles/animations";

/**
 * Holiday selector dropdown component with year grouping and custom holidays.
 */
export const HolidaySelector = memo(
  ({
    holidays,
    enabledHolidays,
    onToggleHoliday,
    onEnableAll,
    onDisableAll,
    onAddCustomHoliday,
    onRemoveCustomHoliday,
  }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newDate, setNewDate] = useState("");
    const [newLabel, setNewLabel] = useState("");

    const enabledCount = enabledHolidays.size;
    const totalCount = holidays.length;

    // Group holidays by year, sorted descending
    const groupedByYear = useMemo(() => {
      const groups: Record<string, any[]> = {};
      holidays.forEach((h: any) => {
        const year: string = h.year || h.date.substring(0, 4);
        if (!groups[year]) groups[year] = [];
        groups[year].push(h);
      });
      // Sort years descending, holidays within year by date ascending
      return Object.keys(groups)
        .sort((a: string, b: string) => Number(a) - Number(b))
        .map((year) => ({
          year,
          holidays: groups[year].sort((a: any, b: any) => a.date.localeCompare(b.date)),
        }));
    }, [holidays]);

    const handleAdd = () => {
      if (newDate && newLabel.trim()) {
        onAddCustomHoliday(newDate, newLabel.trim());
        setNewDate("");
        setNewLabel("");
        setShowAddForm(false);
      }
    };

    const formatDateDisplay = (dateStr: string) => {
      const parts = dateStr.split("-");
      return `${parts[2]}/${parts[1]}`;
    };

    return (
      <Box sx={{ position: "relative" }}>
        <Button
          onClick={() => setIsOpen(!isOpen)}
          variant="outlined"
          size="small"
          sx={{
            textTransform: "none",
            fontSize: "0.875rem",
            borderColor: "grey.300",
            color: "text.primary",
            "&:hover": { bgcolor: "grey.50" },
          }}
          startIcon={<CalendarTodayIcon sx={{ fontSize: 16 }} />}
          endIcon={isOpen ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
        >
          Public holidays ({enabledCount}/{totalCount})
        </Button>

        {isOpen && (
          <Paper
            elevation={4}
            sx={{
              position: "absolute",
              top: "100%",
              right: 0,
              mt: 0.5,
              width: 320,
              border: 1,
              borderColor: "grey.200",
              borderRadius: 2,
              zIndex: 50,
            }}
          >
            {/* Header with bulk actions */}
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "grey.200" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, color: "grey.700" }}>
                  Public holidays to exclude
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  onClick={onEnableAll}
                  variant="contained"
                  size="small"
                  fullWidth
                  sx={{
                    textTransform: "none",
                    fontSize: "0.75rem",
                    bgcolor: "#dbeafe",
                    color: "#1d4ed8",
                    boxShadow: "none",
                    "&:hover": { bgcolor: "#bfdbfe", boxShadow: "none" },
                  }}
                >
                  All
                </Button>
                <Button
                  onClick={onDisableAll}
                  variant="contained"
                  size="small"
                  fullWidth
                  sx={{
                    textTransform: "none",
                    fontSize: "0.75rem",
                    bgcolor: "grey.100",
                    color: "grey.700",
                    boxShadow: "none",
                    "&:hover": { bgcolor: "grey.200", boxShadow: "none" },
                  }}
                >
                  None
                </Button>
              </Box>
            </Box>

            {/* Grouped holiday list */}
            <Box sx={{ maxHeight: 288, overflowY: "auto" }}>
              {groupedByYear.map(({ year, holidays: yearHolidays }: any) => (
                <Box key={year}>
                  {/* Year header */}
                  <Box
                    sx={{
                      position: "sticky",
                      top: 0,
                      bgcolor: "grey.50",
                      px: 1.5,
                      py: 0.75,
                      borderBottom: 1,
                      borderColor: "divider",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, color: "grey.500", textTransform: "uppercase", letterSpacing: "0.05em" }}
                    >
                      {year}
                    </Typography>
                  </Box>
                  {/* Holidays in this year */}
                  <Box sx={{ px: 0.5, py: 0.25 }}>
                    {yearHolidays.map((holiday: any) => {
                      const isEnabled = enabledHolidays.has(holiday.id);
                      return (
                        <Box
                          component="label"
                          key={holiday.id}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 1,
                            py: 0.75,
                            borderRadius: 1,
                            cursor: "pointer",
                            "&:hover": { bgcolor: "grey.50" },
                            "&:hover .delete-btn": { opacity: 1 },
                          }}
                        >
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              borderRadius: 0.5,
                              border: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              borderColor: isEnabled ? "primary.main" : "grey.300",
                              bgcolor: isEnabled ? "primary.main" : "transparent",
                              color: "white",
                              cursor: "pointer",
                            }}
                            onClick={() => onToggleHoliday(holiday.id)}
                          >
                            {isEnabled && <CheckIcon sx={{ fontSize: 10 }} />}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" component="span" sx={{ color: "grey.700" }}>
                              {holiday.label}
                            </Typography>
                            <Typography variant="caption" component="span" sx={{ color: "grey.400", ml: 0.75 }}>
                              {formatDateDisplay(holiday.date)}
                            </Typography>
                          </Box>
                          {holiday.isCustom && (
                            <IconButton
                              className="delete-btn"
                              size="small"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRemoveCustomHoliday(holiday.id);
                              }}
                              sx={{
                                opacity: 0,
                                p: 0.25,
                                color: "grey.400",
                                "&:hover": { color: "error.main" },
                                transition: `opacity 0.3s ${easing.elegant}`,
                              }}
                              title="Remove"
                            >
                              <CloseIcon sx={{ fontSize: 12 }} />
                            </IconButton>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>

            {/* Add custom holiday */}
            <Box sx={{ borderTop: 1, borderColor: "grey.200", p: 1 }}>
              {showAddForm ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <TextField
                    type="date"
                    size="small"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    fullWidth
                    sx={{ "& .MuiInputBase-input": { fontSize: "0.875rem", px: 1, py: 0.5 } }}
                  />
                  <TextField
                    size="small"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Public holiday name"
                    fullWidth
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    sx={{ "& .MuiInputBase-input": { fontSize: "0.875rem", px: 1, py: 0.5 } }}
                  />
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      onClick={handleAdd}
                      disabled={!newDate || !newLabel.trim()}
                      variant="contained"
                      size="small"
                      fullWidth
                      sx={{
                        textTransform: "none",
                        fontSize: "0.75rem",
                        bgcolor: "primary.main",
                        "&:hover": { bgcolor: "primary.dark" },
                        "&.Mui-disabled": { opacity: 0.4 },
                      }}
                    >
                      Add
                    </Button>
                    <Button
                      onClick={() => {
                        setShowAddForm(false);
                        setNewDate("");
                        setNewLabel("");
                      }}
                      variant="contained"
                      size="small"
                      fullWidth
                      sx={{
                        textTransform: "none",
                        fontSize: "0.75rem",
                        bgcolor: "grey.100",
                        color: "grey.700",
                        boxShadow: "none",
                        "&:hover": { bgcolor: "grey.200", boxShadow: "none" },
                      }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Button
                  onClick={() => setShowAddForm(true)}
                  fullWidth
                  size="small"
                  sx={{
                    textTransform: "none",
                    fontSize: "0.75rem",
                    color: "primary.main",
                    "&:hover": { bgcolor: "primary.50" },
                  }}
                  startIcon={<AddIcon sx={{ fontSize: 12 }} />}
                >
                  Add a public holiday
                </Button>
              )}
            </Box>

            {/* Close button */}
            <Box sx={{ p: 1, borderTop: 1, borderColor: "grey.200" }}>
              <Button
                onClick={() => setIsOpen(false)}
                fullWidth
                variant="contained"
                size="small"
                sx={{
                  textTransform: "none",
                  fontSize: "0.875rem",
                  bgcolor: "grey.100",
                  color: "grey.700",
                  boxShadow: "none",
                  borderRadius: 1,
                  "&:hover": { bgcolor: "grey.200", boxShadow: "none" },
                }}
              >
                Close
              </Button>
            </Box>
          </Paper>
        )}
      </Box>
    );
  }
);

HolidaySelector.displayName = "HolidaySelector";
