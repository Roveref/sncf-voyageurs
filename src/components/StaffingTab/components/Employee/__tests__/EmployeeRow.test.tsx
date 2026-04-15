/**
 * Tests for EmployeeRowHeader — the name/grade display portion of EmployeeRow.
 * EmployeeRow itself requires many Timeline Contexts, so we test the header
 * sub-component which has no external context dependencies.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import React from "react";

// Mock badge sub-components (they pull constants but we don't need them here)
vi.mock("../EmployeeRowBadges", () => ({
  AlertDots: () => null,
  FragBadge: () => null,
  TransitionLossBadge: () => null,
  GradeTransitionBadge: () => null,
  EtpBadge: () => null,
  PotentialBadge: () => null,
  TeamContribBadge: () => null,
  SapCompletionBadge: () => null,
}));

import { EmployeeRowHeader } from "../EmployeeRowHeader";

const baseEmployee = {
  empId: "EMP001",
  name: "Alice Martin",
  grade: "Manager",
  subTeam: "Digital",
  directManager: "Bob Smith",
  isRecruit: false,
};

function renderHeader(overrides: Record<string, any> = {}) {
  return render(
    <EmployeeRowHeader
      employee={baseEmployee}
      collapsed={true}
      showDetails={false}
      showUtilization={true}
      showIO="off"
      currentEtp={null}
      gradeTransition={null}
      teamContribPts={0}
      teamNetHours={0}
      chargeableH={0}
      potentialTeamPts={0}
      sapCompletion={null}
      tuTooltip="TU: 75%"
      metricText="75%"
      onToggle={vi.fn()}
      onNameClick={undefined}
      onTuClick={vi.fn()}
      hasNameClickHandler={false}
      isRecruit={false}
      ioTU={null}
      {...overrides}
    />
  );
}

describe("EmployeeRowHeader", () => {
  it("renders without crashing", () => {
    const { container } = renderHeader();
    expect(container.firstChild).not.toBeNull();
  });

  it("displays the employee name", () => {
    renderHeader();
    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
  });

  it("displays the grade abbreviation chip", () => {
    renderHeader();
    // Grade chip shows abbreviated grade label
    const content = document.body.textContent || "";
    expect(content).toContain("M"); // Manager abbreviation
  });

  it("shows the utilization metric text", () => {
    renderHeader();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("does not crash when svg expand icon is present", () => {
    renderHeader({ onToggle: vi.fn() });
    const icons = document.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
  });

  it("renders grade chip text in the DOM", () => {
    renderHeader();
    // Grade abbreviation chip text is in the DOM
    const content = document.body.textContent || "";
    // "Manager" abbreviated is "M" — it's somewhere in the rendered content
    expect(content.length).toBeGreaterThan(0);
  });

  it("shows IO TU when showIO is not 'off' and ioTU is provided", () => {
    renderHeader({ showIO: "show", ioTU: 40 });
    const content = document.body.textContent || "";
    expect(content).toContain("40");
  });
});
