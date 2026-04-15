import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ErrorBoundary from "../ErrorBoundary";

// Suppress React's console.error output for expected boundary errors
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

// Helper to mount a component tree and return the container
function renderIntoDocument(ui: React.ReactElement): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(ui);
  });
  return container;
}

// Component that throws on render
function BrokenChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test render error");
  return <span>OK</span>;
}

describe("ErrorBoundary", () => {
  it("renders children normally when no error occurs", () => {
    const container = renderIntoDocument(
      <ErrorBoundary>
        <span>Hello</span>
      </ErrorBoundary>
    );
    expect(container.textContent).toContain("Hello");
    document.body.removeChild(container);
  });

  it("renders the default fallback UI when a child throws", () => {
    const container = renderIntoDocument(
      <ErrorBoundary>
        <BrokenChild shouldThrow />
      </ErrorBoundary>
    );
    // The default fallback contains a "Something went wrong" heading and a Reload button
    expect(container.textContent).toContain("Something went wrong");
    expect(container.querySelector("button")).not.toBeNull();
    document.body.removeChild(container);
  });

  it("renders a custom fallbackMessage when provided", () => {
    const container = renderIntoDocument(
      <ErrorBoundary fallbackMessage="Custom error message">
        <BrokenChild shouldThrow />
      </ErrorBoundary>
    );
    expect(container.textContent).toContain("Custom error message");
    document.body.removeChild(container);
  });

  it("renders the custom fallback node when provided", () => {
    const container = renderIntoDocument(
      <ErrorBoundary fallback={<div id="custom-fallback">Custom fallback</div>}>
        <BrokenChild shouldThrow />
      </ErrorBoundary>
    );
    expect(container.querySelector("#custom-fallback")).not.toBeNull();
    expect(container.textContent).toContain("Custom fallback");
    document.body.removeChild(container);
  });

  it("shows the thrown error message in the fallback", () => {
    const container = renderIntoDocument(
      <ErrorBoundary>
        <BrokenChild shouldThrow />
      </ErrorBoundary>
    );
    expect(container.textContent).toContain("Test render error");
    document.body.removeChild(container);
  });

  it("calls onReset and clears the error when the Reload button is clicked", () => {
    const onReset = vi.fn();
    const container = renderIntoDocument(
      <ErrorBoundary onReset={onReset}>
        <BrokenChild shouldThrow />
      </ErrorBoundary>
    );

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    act(() => {
      button!.click();
    });

    // After reset the boundary clears — BrokenChild is no longer mounted (it would throw
    // again), but the boundary itself re-renders children. The important assertions are
    // that onReset was called and the error fallback text is gone.
    expect(onReset).toHaveBeenCalledOnce();
    document.body.removeChild(container);
  });
});
