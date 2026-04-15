import { describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { NoDataEmptyState, NoResultsEmptyState, ErrorEmptyState } from "../EmptyStates";

function renderIntoDocument(ui: React.ReactElement): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(ui);
  });
  return container;
}

describe("NoDataEmptyState", () => {
  it("renders without crashing", () => {
    const container = renderIntoDocument(<NoDataEmptyState />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });

  it("displays the 'No data loaded yet' heading", () => {
    const container = renderIntoDocument(<NoDataEmptyState />);
    expect(container.textContent).toContain("No data loaded yet");
    document.body.removeChild(container);
  });

  it("renders the Upload Excel File button", () => {
    const container = renderIntoDocument(<NoDataEmptyState />);
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button!.textContent).toContain("Upload Excel File");
    document.body.removeChild(container);
  });

  it("calls onUploadClick when the button is clicked", () => {
    const onUploadClick = vi.fn();
    const container = renderIntoDocument(<NoDataEmptyState onUploadClick={onUploadClick} />);
    const button = container.querySelector("button")!;
    act(() => {
      button.click();
    });
    expect(onUploadClick).toHaveBeenCalledOnce();
    document.body.removeChild(container);
  });
});

describe("NoResultsEmptyState", () => {
  it("renders without crashing", () => {
    const container = renderIntoDocument(<NoResultsEmptyState />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });

  it("displays the default 'No results found' message", () => {
    const container = renderIntoDocument(<NoResultsEmptyState />);
    expect(container.textContent).toContain("No results found");
    document.body.removeChild(container);
  });

  it("displays a custom message when provided", () => {
    const container = renderIntoDocument(<NoResultsEmptyState message="Nothing here" />);
    expect(container.textContent).toContain("Nothing here");
    document.body.removeChild(container);
  });

  it("does not render a Clear Filters button when onClearFilters is not provided", () => {
    const container = renderIntoDocument(<NoResultsEmptyState />);
    // No button should be present without the callback
    expect(container.querySelector("button")).toBeNull();
    document.body.removeChild(container);
  });

  it("renders the Clear Filters button when onClearFilters is provided", () => {
    const onClearFilters = vi.fn();
    const container = renderIntoDocument(<NoResultsEmptyState onClearFilters={onClearFilters} />);
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button!.textContent).toContain("Clear Filters");
    document.body.removeChild(container);
  });

  it("calls onClearFilters when the button is clicked", () => {
    const onClearFilters = vi.fn();
    const container = renderIntoDocument(<NoResultsEmptyState onClearFilters={onClearFilters} />);
    act(() => {
      container.querySelector("button")!.click();
    });
    expect(onClearFilters).toHaveBeenCalledOnce();
    document.body.removeChild(container);
  });
});

describe("ErrorEmptyState", () => {
  it("renders without crashing", () => {
    const container = renderIntoDocument(<ErrorEmptyState />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });

  it("displays the default error message", () => {
    const container = renderIntoDocument(<ErrorEmptyState />);
    expect(container.textContent).toContain("Something went wrong");
    document.body.removeChild(container);
  });

  it("displays a custom error message when provided", () => {
    const container = renderIntoDocument(<ErrorEmptyState errorMessage="Network failure" />);
    expect(container.textContent).toContain("Network failure");
    document.body.removeChild(container);
  });

  it("does not render a retry button when onRetry is not provided", () => {
    const container = renderIntoDocument(<ErrorEmptyState />);
    expect(container.querySelector("button")).toBeNull();
    document.body.removeChild(container);
  });

  it("renders the retry button when onRetry is provided", () => {
    const onRetry = vi.fn();
    const container = renderIntoDocument(<ErrorEmptyState onRetry={onRetry} />);
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button!.textContent).toContain("Try Again");
    document.body.removeChild(container);
  });

  it("renders a custom retry label when provided", () => {
    const container = renderIntoDocument(<ErrorEmptyState onRetry={vi.fn()} retryLabel="Retry now" />);
    expect(container.querySelector("button")!.textContent).toContain("Retry now");
    document.body.removeChild(container);
  });

  it("calls onRetry when the retry button is clicked", () => {
    const onRetry = vi.fn();
    const container = renderIntoDocument(<ErrorEmptyState onRetry={onRetry} />);
    act(() => {
      container.querySelector("button")!.click();
    });
    expect(onRetry).toHaveBeenCalledOnce();
    document.body.removeChild(container);
  });
});
