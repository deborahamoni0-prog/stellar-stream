import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../server";
import { SenderDashboard } from "./SenderDashboard";
import { Stream } from "../types/stream";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SENDER = "GSENDER123";

const mockActiveStream = (id: string, sender: string): Stream => ({
  id,
  sender: sender,
  recipient: `GRECIPIENT_${id}`,
  assetCode: "USDC",
  totalAmount: 1000,
  durationSeconds: 86400,
  startAt: 1700000000,
  createdAt: 1699990000,
  progress: {
    status: "active",
    ratePerSecond: 0.01157,
    elapsedSeconds: 43200,
    vestedAmount: 500,
    remainingAmount: 500,
    percentComplete: 50,
  },
});

const mockCompletedStream = (id: string, sender: string): Stream => ({
  ...mockActiveStream(id, sender),
  progress: {
    ...mockActiveStream(id, sender).progress,
    status: "completed",
    elapsedSeconds: 86400,
    vestedAmount: 1000,
    remainingAmount: 0,
    percentComplete: 100,
  },
});

function setupSenderHandler(streams: Stream[], sender: string) {
  server.use(
    http.get("/api/streams", ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("sender") === sender) {
        return HttpResponse.json({ data: streams });
      }
      return HttpResponse.json({ data: [] });
    }),
    http.get("/api/config", () => {
      return HttpResponse.json({ allowedAssets: ["USDC", "XLM"] });
    })
  );
}

function setupErrorHandler() {
  server.use(
    http.get("/api/streams", () => {
      return HttpResponse.json({ error: "Server Error 500" }, { status: 500 });
    })
  );
}

describe("SenderDashboard", () => {
  const onEditStartTime = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with 3 active and 2 completed streams and asserts metric counts", async () => {
    const SENDER_METRICS = "GSENDER_METRICS";
    const streams = [
      mockActiveStream("1", SENDER_METRICS),
      mockActiveStream("2", SENDER_METRICS),
      mockActiveStream("3", SENDER_METRICS),
      mockCompletedStream("4", SENDER_METRICS),
      mockCompletedStream("5", SENDER_METRICS),
    ];
    setupSenderHandler(streams, SENDER_METRICS);

    render(<SenderDashboard senderAddress={SENDER_METRICS} onEditStartTime={onEditStartTime} />);

    // Wait for loading to finish
    await waitFor(() => expect(screen.queryByText(/Sender Dashboard/)).toBeInTheDocument());
    
    // Check metrics
    // Total USDC Outgoing: 5 * 1000 = 5000
    expect(await screen.findByText("5000")).toBeInTheDocument();
    
    const activeMetric = screen.getByText("Active").parentElement;
    expect(activeMetric?.querySelector("strong")?.textContent).toBe("3");

    const completedMetric = screen.getByText("Completed").parentElement;
    expect(completedMetric?.querySelector("strong")?.textContent).toBe("2");
  });

  it("renders with no streams and asserts zero metrics and 'create your first stream' prompt", async () => {
    const SENDER_EMPTY = "GSENDER_EMPTY";
    setupSenderHandler([], SENDER_EMPTY);

    render(<SenderDashboard senderAddress={SENDER_EMPTY} onEditStartTime={onEditStartTime} />);

    await waitFor(() => expect(screen.getByText("No Streams Found")).toBeInTheDocument());
    expect(screen.getByText("Create your first stream")).toBeInTheDocument();

    // Verify metrics are absent in the empty state
    expect(screen.queryByText(/Total .* Outgoing/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
    expect(screen.queryByText("Scheduled")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("shows CreateStreamForm when 'Create Stream' button is clicked", async () => {
    const SENDER_CREATE = "GSENDER_CREATE";
    setupSenderHandler([], SENDER_CREATE);

    render(<SenderDashboard senderAddress={SENDER_CREATE} onEditStartTime={onEditStartTime} />);

    await waitFor(() => expect(screen.getByText("Create your first stream")).toBeInTheDocument());
    
    fireEvent.click(screen.getByText("Create your first stream"));

    // Check if CreateStreamForm elements are present
    expect(screen.getByText(/Recipient Account/i)).toBeInTheDocument();
    expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
  });

  it("shows CreateStreamForm when 'Create Stream' button in header is clicked", async () => {
    const SENDER_HEADER = "GSENDER_HEADER";
    const streams = [mockActiveStream("1", SENDER_HEADER)];
    setupSenderHandler(streams, SENDER_HEADER);

    render(<SenderDashboard senderAddress={SENDER_HEADER} onEditStartTime={onEditStartTime} />);

    await waitFor(() => expect(screen.getByText("Sender Dashboard")).toBeInTheDocument());
    
    // Click the "Create Stream" button in the header
    fireEvent.click(screen.getByRole("button", { name: /Create Stream/i }));

    // Check if CreateStreamForm elements are present
    expect(screen.getByText(/Recipient Account/i)).toBeInTheDocument();
    expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();

    // Toggle back
    fireEvent.click(screen.getByText("Back to Dashboard"));
    expect(screen.queryByText(/Recipient Account/i)).not.toBeInTheDocument();
  });

  it("surfaces a user-visible message on API error", async () => {
    const SENDER_ERROR = "GSENDER_ERROR";
    setupErrorHandler();

    render(<SenderDashboard senderAddress={SENDER_ERROR} onEditStartTime={onEditStartTime} />);

    await waitFor(() => expect(screen.getByText("Dashboard Load Failed")).toBeInTheDocument());
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });
});
