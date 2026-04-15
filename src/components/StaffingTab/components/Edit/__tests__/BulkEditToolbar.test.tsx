import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";

// Mock DatePicker to avoid date-fns internal path issues
vi.mock("@mui/x-date-pickers/DatePicker", () => ({
  DatePicker: ({ value, onChange, sx }: any) => (
    <input
      aria-label="date-picker"
      value={value ? String(value) : ""}
      onChange={(e) => onChange && onChange(e.target.value)}
    />
  ),
}));

// Mock sub-components
vi.mock("../EditModeSelector", () => ({
  EditModeSelector: () => <div data-testid="edit-mode-selector" />,
}));

import { ToolBar } from "../BulkEditToolbar";

const baseEditProps = {
  mode: "edit" as const,
  selection: { empId: "EMP001", groupKey: "JOB001::2025-01-01", subRange: undefined },
  selectedGroup: {
    groupKey: "JOB001::2025-01-01",
    jobNo: "JOB001",
    jobName: "Test Job",
    category: "C",
    startDate: "2025-01-01",
    endDate: "2025-03-31",
    items: [],
    periods: [],
    isDeleted: false,
    isModified: false,
    hasNewItems: false,
    totalHours: 0,
  },
  enabledHolidayDates: new Set<string>(),
  dispatchBatch: vi.fn(),
  onClearSelection: vi.fn(),
  onSelectionChange: vi.fn(),
  labelParts: { account: "Acme", oppName: "Test Opp", name: "Test Job", jobNo: "JOB001", hours: "100h", days: "20d" },
  leftColShrink: 0,
  canUndo: true,
  canRedo: false,
  onUndo: vi.fn(),
  onRedo: vi.fn(),
};

function renderToolbar(overrides: Record<string, any> = {}) {
  return render(<ToolBar {...baseEditProps} {...overrides} />);
}

describe("BulkEditToolbar (edit mode)", () => {
  it("renders without crashing", () => {
    const { container } = renderToolbar();
    expect(container.firstChild).not.toBeNull();
  });

  it("shows Undo button when canUndo is true", () => {
    renderToolbar({ canUndo: true, canRedo: false });
    expect(screen.getByLabelText("Undo")).toBeInTheDocument();
  });

  it("shows Redo button when canRedo is true", () => {
    renderToolbar({ canUndo: false, canRedo: true });
    expect(screen.getByLabelText("Redo")).toBeInTheDocument();
  });

  it("Undo button is disabled when canUndo is false", () => {
    renderToolbar({ canUndo: false, canRedo: true });
    const undoBtn = screen.getByLabelText("Undo");
    expect(undoBtn).toBeDisabled();
  });

  it("shows Cancel button", () => {
    renderToolbar();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("shows Apply button in edit mode", () => {
    renderToolbar();
    expect(screen.getByText("Apply")).toBeInTheDocument();
  });

  it("calls onUndo when Undo is clicked", async () => {
    const onUndo = vi.fn();
    renderToolbar({ onUndo, canUndo: true });
    const undoBtn = screen.getByLabelText("Undo");
    undoBtn.click();
    expect(onUndo).toHaveBeenCalled();
  });

  it("does not show Undo/Redo when both are false", () => {
    renderToolbar({ canUndo: false, canRedo: false });
    expect(screen.queryByLabelText("Undo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Redo")).not.toBeInTheDocument();
  });
});
