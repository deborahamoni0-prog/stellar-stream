import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StreamMetricsChart } from "./StreamMetricsChart";

// Mock recharts so tests don't depend on canvas/SVG rendering
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ data, children }: any) => (
    <svg data-testid="area-chart" data-points={data?.length}>{children}</svg>
  ),
  Area: ({ dataKey }: any) => <g data-testid={`area-${dataKey}`}>Area: {dataKey}</g>,
  XAxis: ({ dataKey }: any) => <g data-testid="x-axis">{dataKey}</g>,
  YAxis: () => <g data-testid="y-axis" />,
  CartesianGrid: () => <g data-testid="cartesian-grid" />,
  Tooltip: () => <g data-testid="tooltip" />,
  Legend: () => <g data-testid="legend" />,
  ReferenceArea: () => <g data-testid="reference-area" />,
}));

// Helper: build daily MetricsSnapshot fixtures
const DAY = 24 * 60 * 60 * 1000;
function makeData(count = 7) {
  const now = 1_750_000_000_000; // fixed timestamp for predictability
  return Array.from({ length: count }, (_, i) => ({
    timestamp: now - (count - 1 - i) * DAY,
    active: 10 + i,
    completed: 5 + i,
    vested: 100 + i * 25,
  }));
}

describe("StreamMetricsChart", () => {
  // ── Normal render ────────────────────────────────────────────────────────

  it("renders all three metric series", () => {
    render(<StreamMetricsChart data={makeData()} />);
    expect(screen.getByTestId("area-Vested Amount")).toBeInTheDocument();
    expect(screen.getByTestId("area-Active")).toBeInTheDocument();
    expect(screen.getByTestId("area-Completed")).toBeInTheDocument();
  });

  it("uses date as the x-axis dataKey", () => {
    render(<StreamMetricsChart data={makeData()} />);
    expect(screen.getByTestId("x-axis").textContent).toBe("date");
  });

  it("wraps chart in a ResponsiveContainer", () => {
    render(<StreamMetricsChart data={makeData()} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("handles a single data point without crashing", () => {
    render(<StreamMetricsChart data={makeData(1)} />);
    expect(screen.getByTestId("area-Vested Amount")).toBeInTheDocument();
  });

  // ── Empty state ──────────────────────────────────────────────────────────

  it("renders empty state when data is an empty array", () => {
    render(<StreamMetricsChart data={[]} />);
    expect(screen.getByText(/No Chart Data Yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it("renders loading state when loading=true", () => {
    render(<StreamMetricsChart data={[]} loading={true} />);
    expect(screen.getByText(/Loading Chart Data/i)).toBeInTheDocument();
    expect(screen.queryByText(/No Chart Data Yet/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });

  it("does not render loading state when loading=false", () => {
    render(<StreamMetricsChart data={makeData()} loading={false} />);
    expect(screen.queryByText(/Loading Chart Data/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });

  it("loading state has aria-busy attribute", () => {
    render(<StreamMetricsChart data={[]} loading={true} />);
    expect(screen.getByRole("generic", { hidden: true })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  // ── Error state ──────────────────────────────────────────────────────────

  it("renders error state when error prop is provided", () => {
    const err = new Error("Network timeout");
    render(<StreamMetricsChart data={[]} error={err} />);
    expect(screen.getByText(/Failed to Load Chart/i)).toBeInTheDocument();
    expect(screen.getByText(/Network timeout/i)).toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });

  it("error state has role=alert", () => {
    render(<StreamMetricsChart data={[]} error={new Error("oops")} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("loading takes precedence over error", () => {
    render(
      <StreamMetricsChart
        data={[]}
        loading={true}
        error={new Error("something")}
      />,
    );
    expect(screen.getByText(/Loading Chart Data/i)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to Load Chart/i)).not.toBeInTheDocument();
  });

  it("error takes precedence over empty state", () => {
    render(<StreamMetricsChart data={[]} error={new Error("oops")} />);
    expect(screen.getByText(/Failed to Load Chart/i)).toBeInTheDocument();
    expect(screen.queryByText(/No Chart Data Yet/i)).not.toBeInTheDocument();
  });

  it("uses a generic fallback message when error has no message", () => {
    const err = new Error("");
    render(<StreamMetricsChart data={[]} error={err} />);
    expect(
      screen.getByText(/An error occurred while fetching metrics history/i),
    ).toBeInTheDocument();
  });
});
