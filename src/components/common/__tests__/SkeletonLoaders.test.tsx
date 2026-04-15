import { describe, it, expect } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import {
  SkeletonCard,
  SkeletonTable,
  SkeletonChart,
  SkeletonGrid,
  SkeletonDashboard,
  SkeletonSidebar,
  PulseLoader,
} from "../SkeletonLoaders";

function renderIntoDocument(ui: React.ReactElement): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(ui);
  });
  return container;
}

describe("SkeletonCard", () => {
  it("renders without crashing", () => {
    const container = renderIntoDocument(<SkeletonCard />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });

  it("renders with showChart=true without crashing", () => {
    const container = renderIntoDocument(<SkeletonCard height={300} showChart />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });
});

describe("SkeletonTable", () => {
  it("renders without crashing with default props", () => {
    const container = renderIntoDocument(<SkeletonTable />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });

  it("renders with custom rows and columns without crashing", () => {
    const container = renderIntoDocument(<SkeletonTable rows={3} columns={4} />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });
});

describe("SkeletonChart", () => {
  it("renders bar type without crashing", () => {
    const container = renderIntoDocument(<SkeletonChart type="bar" />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });

  it("renders line type without crashing", () => {
    const container = renderIntoDocument(<SkeletonChart type="line" />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });

  it("renders pie type without crashing", () => {
    const container = renderIntoDocument(<SkeletonChart type="pie" />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });
});

describe("SkeletonGrid", () => {
  it("renders without crashing with default props", () => {
    const container = renderIntoDocument(<SkeletonGrid />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });

  it("renders with custom items and columns without crashing", () => {
    const container = renderIntoDocument(<SkeletonGrid items={6} columns={3} />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });
});

describe("SkeletonDashboard", () => {
  it("renders without crashing", () => {
    const container = renderIntoDocument(<SkeletonDashboard />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });
});

describe("SkeletonSidebar", () => {
  it("renders without crashing", () => {
    const container = renderIntoDocument(<SkeletonSidebar />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });
});

describe("PulseLoader", () => {
  it("renders without crashing with default props", () => {
    const container = renderIntoDocument(<PulseLoader />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });

  it("renders with custom width and height without crashing", () => {
    const container = renderIntoDocument(<PulseLoader width={100} height={30} />);
    expect(container.firstChild).not.toBeNull();
    document.body.removeChild(container);
  });
});
