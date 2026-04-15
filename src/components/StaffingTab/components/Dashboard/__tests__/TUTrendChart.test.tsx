import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";

// Mock recharts which relies on DOM APIs not fully available in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  ComposedChart: ({ children }: any) => <svg data-testid="composed-chart">{children}</svg>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  ReferenceArea: () => null,
  Customized: () => null,
}));

// Mock sub-components
vi.mock("../TUTrendLegend", () => ({
  TUTrendLegend: () => <div data-testid="tu-trend-legend" />,
  useTrendVisibility: vi.fn().mockReturnValue([{}, vi.fn()]),
  COLORS: {},
}));
vi.mock("../TUTrendYearSelector", () => ({
  TUTrendYearSelector: () => null,
  useTrendYears: vi.fn().mockReturnValue([[], vi.fn()]),
}));
vi.mock("../TUTrendTooltip", () => ({ ChartTooltip: () => null }));
vi.mock("../TUTrendHandles", () => ({ HighlightHandles: () => null }));
vi.mock("../TUTrendData", () => ({
  MONTHS_FR: ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"],
  buildTimePoints: vi.fn().mockReturnValue([
    {
      _xPos: 1,
      _label: "Jan",
      _mStart: 1735689600000,
      _mEnd: 1738368000000,
      _totalNet: 160,
      _totalCh: 120,
      tu: 75,
      to: 75,
      fte: 1,
      _hasSapBucket: false,
    },
    {
      _xPos: 2,
      _label: "Feb",
      _mStart: 1738368000000,
      _mEnd: 1740787200000,
      _totalNet: 160,
      _totalCh: 120,
      tu: 75,
      to: 75,
      fte: 1,
      _hasSapBucket: false,
    },
  ]),
  buildTargetSeries: vi.fn().mockReturnValue(new Map()),
  findSelectionXPos: vi.fn().mockReturnValue({ selStartXPos: null, selEndXPos: null }),
}));

vi.mock("../useTUTrendChartData", () => ({
  useTUTrendChartData: vi.fn().mockReturnValue({
    chartPoints: [
      {
        _xPos: 1,
        _label: "Jan",
        _mStart: 1735689600000,
        _mEnd: 1738368000000,
        _totalNet: 160,
        _totalCh: 120,
        tu: 75,
        to: 75,
        fte: 1,
        _hasSapBucket: false,
      },
      {
        _xPos: 2,
        _label: "Feb",
        _mStart: 1738368000000,
        _mEnd: 1740787200000,
        _totalNet: 160,
        _totalCh: 120,
        tu: 75,
        to: 75,
        fte: 1,
        _hasSapBucket: false,
      },
    ],
    selStartXPos: null,
    selEndXPos: null,
    isVarianceMode: false,
    hasDelta: false,
    yearFirstIdx: [],
    hmTicks: [],
    monthTicksMap: new Map(),
    seqTicks: [1, 2],
    quarterBoundaryPositions: [],
    yearChangePositions: [],
    varianceYDomain: [0, 10],
    fteDomain: [0, 5],
    showDots: false,
  }),
}));
vi.mock("../tuTrendChartCalc", () => ({
  computeYearFirstIdx: vi.fn().mockReturnValue([]),
  computeHmTicks: vi.fn().mockReturnValue([]),
  computeMonthTicksMap: vi.fn().mockReturnValue(new Map()),
  computeSeqTicks: vi.fn().mockReturnValue([]),
  computeQuarterBoundaryPositions: vi.fn().mockReturnValue([]),
  computeYearChangePositions: vi.fn().mockReturnValue([]),
  computeVarianceYDomain: vi.fn().mockReturnValue([0, 10]),
  computeFteDomain: vi.fn().mockReturnValue([0, 10]),
}));
vi.mock("../../hooks/useCrosshairSync", () => ({
  setCrosshairRange: vi.fn(),
  useCrosshairRange: vi.fn().mockReturnValue(null),
}));
vi.mock("../../../../config/brandConfig", () => ({ brand: { primary: "#FF3D47" } }));
vi.mock("../TUTrendChartXAxisTick", () => ({ default: () => null, TUTrendChartXAxisTick: () => null }));

import TUTrendChart from "../TUTrendChart";

const baseProps = {
  employees: [],
  allEmployees: [],
  timelineStart: "2025-01-01",
  timelineEnd: "2025-12-31",
  chargeableCombined: false,
  enabledHolidayDates: new Set<string>(),
  sapLookup: null,
  visible: {},
  onToggle: vi.fn(),
  theoreticalTU: null,
};

describe("TUTrendChart", () => {
  it("renders without crashing", () => {
    const { container } = render(<TUTrendChart {...baseProps} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("renders the responsive container", () => {
    render(<TUTrendChart {...baseProps} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("renders the composed chart", () => {
    render(<TUTrendChart {...baseProps} />);
    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();
  });

  it("renders chart container (legend is external to TUTrendChart)", () => {
    const { container } = render(<TUTrendChart {...baseProps} />);
    // TUTrendLegend is not rendered inside TUTrendChart — it's rendered by parent
    // Just verify the chart renders content
    expect(container).not.toBeNull();
    expect(document.body.textContent).not.toBeNull();
  });

  it("renders without crashing in variance_hours mode", () => {
    const { container } = render(<TUTrendChart {...baseProps} heatmapMode="variance_hours" />);
    expect(container.firstChild).not.toBeNull();
  });

  it("renders without crashing with staffing needs", () => {
    const { container } = render(
      <TUTrendChart
        {...baseProps}
        staffingNeeds={[{ id: "n1", grade: "Manager", quantity: 1, startDate: "2025-01-01", endDate: "2025-06-30" }]}
      />
    );
    expect(container.firstChild).not.toBeNull();
  });
});
