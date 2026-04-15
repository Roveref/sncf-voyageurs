import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import React from "react";

import FilterPanel from "../FilterPanel";

const defaultFilters = {
  accounts: [],
  technologyPartners: [],
  people: [],
};

function renderFilterPanel(overrides: Partial<React.ComponentProps<typeof FilterPanel>> = {}) {
  return render(
    <FilterPanel data={[]} filters={defaultFilters} onFilterChange={vi.fn()} showNetRevenue={false} {...overrides} />
  );
}

describe("FilterPanel", () => {
  it("renders without crashing", () => {
    const { container } = renderFilterPanel();
    expect(container.firstChild).not.toBeNull();
  });

  it("renders Accounts filter field", () => {
    renderFilterPanel();
    const accountsInput = screen.getByLabelText("Filter by account");
    expect(accountsInput).toBeInTheDocument();
  });

  it("renders Technology Partners filter field", () => {
    renderFilterPanel();
    const techInput = screen.getByLabelText("Filter by technology partner");
    expect(techInput).toBeInTheDocument();
  });

  it("renders People filter field", () => {
    renderFilterPanel();
    const peopleInput = screen.getByLabelText("Filter by person");
    expect(peopleInput).toBeInTheDocument();
  });

  it("renders search field when onSearchTextChange is provided", () => {
    renderFilterPanel({ onSearchTextChange: vi.fn(), searchText: "" });
    const searchInput = screen.getByLabelText("Search");
    expect(searchInput).toBeInTheDocument();
  });

  it("does not render Clear All button when no filters are active", () => {
    renderFilterPanel();
    const clearBtn = screen.queryByText("Clear all");
    expect(clearBtn).not.toBeInTheDocument();
  });

  it("renders Clear All button when accounts filter is active", () => {
    renderFilterPanel({ filters: { ...defaultFilters, accounts: ["Acme Corp"] } });
    expect(screen.getByText("Clear all")).toBeInTheDocument();
  });

  it("calls onFilterChange when Clear All is clicked", async () => {
    const onFilterChange = vi.fn();
    renderFilterPanel({ filters: { ...defaultFilters, accounts: ["Acme Corp"] }, onFilterChange });
    await userEvent.click(screen.getByText("Clear all"));
    expect(onFilterChange).toHaveBeenCalledWith({ accounts: [], technologyPartners: [], people: [] });
  });
});
