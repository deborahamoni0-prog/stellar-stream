import { useMemo, useState, useRef, useCallback, type RefObject } from "react";
import { Stream } from "../types/stream";
import { getExportCsvUrl, ListStreamsFilters } from "../services/api";
import { CopyableAddress } from "./CopyableAddress";
import { StreamTimeline } from "./StreamTimeline";
import { getHealthBadges } from "../utils/streamHealthBadges";
import { FilterBar } from "./FilterBar";
import { EmptyState } from "./EmptyState";

interface StreamsTableProps {
  streams: Stream[];
  loading?: boolean;
  filters: ListStreamsFilters;
  onFiltersChange: (f: ListStreamsFilters) => void;
  onCancel: (streamId: string) => Promise<void>;
  onPause?: (streamId: string) => Promise<void>;
  onResume?: (streamId: string) => Promise<void>;
  onOpenStream?: (streamId: string) => void;
  totalStreamCount?: number;
  onCreateStream?: () => void;
  onEditStartTime: (stream: Stream, triggerRef: RefObject<HTMLButtonElement | null>) => void;
  onRefresh?: () => void;
}

const SKELETON_ROW_COUNT = 6;

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      <td><div className="skeleton" style={{ width: "80px", height: "16px" }} /></td>
      <td><div className="skeleton" style={{ width: "120px", height: "32px" }} /></td>
      <td><div className="skeleton" style={{ width: "90px", height: "16px" }} /></td>
      <td><div className="skeleton" style={{ width: "100%", height: "20px" }} /></td>
      <td><div className="skeleton" style={{ width: "70px", height: "20px" }} /></td>
      <td><div className="skeleton" style={{ width: "80px", height: "28px" }} /></td>
    </tr>
  );
}

function statusClass(status: Stream["progress"]["status"]): string {
  switch (status) {
    case "active":
      return "badge badge-active";
    case "scheduled":
      return "badge badge-scheduled";
    case "completed":
      return "badge badge-completed";
    case "canceled":
      return "badge badge-canceled";
    case "paused":
      return "badge badge-paused";
    default:
      return "badge";
  }
}

function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}

function isStreamSelectable(stream: Stream): boolean {
  return stream.progress.status === "active" || stream.progress.status === "scheduled";
}

interface StreamRowProps {
  stream: Stream;
  isScheduled: boolean;
  isFinalised: boolean;
  isExpanded: boolean;
  healthBadges: ReturnType<typeof getHealthBadges>;
  onCancel: (id: string) => Promise<void>;
  onPause?: (id: string) => Promise<void>;
  onResume?: (id: string) => Promise<void>;
  onEditStartTime: StreamsTableProps["onEditStartTime"];
  onOpenStream?: (streamId: string) => void;
  onToggleTimeline: (streamId: string) => void;
}

function StreamRow({
  stream,
  isScheduled,
  isFinalised,
  isExpanded,
  healthBadges,
  onCancel,
  onPause,
  onResume,
  onEditStartTime,
  onOpenStream,
  onToggleTimeline,
}: StreamRowProps) {
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const isPaused = stream.progress.status === "paused";
  const isActive = stream.progress.status === "active";

  return (
    <>
      <tr>
        <td>
          <button
            type="button"
            className="btn-ghost"
            aria-expanded={isExpanded}
            aria-controls={`timeline-${stream.id}`}
            onClick={() => {
              onToggleTimeline(stream.id);
            }}
            title={isExpanded ? "Hide timeline" : "Show timeline"}
          >
            {isExpanded ? "▼" : "▶"} {stream.id}
          </button>
        </td>
        <td>
          <div className="stacked">
            <CopyableAddress address={stream.sender} truncationMode="end" />
            <CopyableAddress address={stream.recipient} truncationMode="end" />
          </div>
        </td>
        <td>
          {stream.totalAmount} {stream.assetCode}
          <div className="muted">Start: {formatTimestamp(stream.startAt)}</div>
        </td>
        <td>
          <div className="progress-copy">
            <strong>{stream.progress.percentComplete}%</strong>
            <span className="muted">
              Vested: {stream.progress.vestedAmount} {stream.assetCode}
            </span>
          </div>
          <div className="progress-bar" aria-hidden>
            <div
              style={{ width: `${Math.min(stream.progress.percentComplete, 100)}%` }}
            />
          </div>
        </td>
        <td>
          <div className="status-cell">
            <span className={statusClass(stream.progress.status)}>
              {stream.progress.status}
            </span>
            {healthBadges.length > 0 && (
              <div className="health-badge-row" role="list" aria-label="Health badges">
                {healthBadges.map((badge) => (
                  <span key={badge.key} className={badge.cssClass} title={badge.title} role="listitem">
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </td>
        <td>
          <div className="action-cell">
            {isScheduled && (
              <button
                ref={editBtnRef}
                className="btn-ghost btn-edit"
                type="button"
                aria-label={`Edit start time for stream ${stream.id}`}
                onClick={() => onEditStartTime(stream, editBtnRef)}
              >
                Edit
              </button>
            )}
            {isActive && onPause && (
              <button
                className="btn-ghost"
                type="button"
                aria-label={`Pause stream ${stream.id}`}
                onClick={() => onPause(stream.id)}
              >
                Pause
              </button>
            )}
            {isPaused && onResume && (
              <button
                className="btn-ghost"
                type="button"
                aria-label={`Resume stream ${stream.id}`}
                onClick={() => onResume(stream.id)}
              >
                Resume
              </button>
            )}
            <button
              className="btn-ghost"
              type="button"
              aria-label={`Cancel stream ${stream.id}`}
              onClick={() => onCancel(stream.id)}
              disabled={isFinalised}
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>

      {isExpanded && (
        <tr id={`timeline-${stream.id}`}>
          <td colSpan={6} style={{ padding: "1rem 1.5rem", background: "var(--color-background-secondary)" }}>
            <StreamTimeline streamId={stream.id} />
          </td>
        </tr>
      )}
    </>
  );
}

export function StreamsTable({
  streams,
  filters,
  onFiltersChange,
  onCancel,
  onPause,
  onResume,
  onOpenStream,
  totalStreamCount = 0,
  onCreateStream,
  onEditStartTime,
}: StreamsTableProps) {
  const [expandedStreamId, setExpandedStreamId] = useState<string | null>(null);
  const exportUrl = useMemo(() => getExportCsvUrl(filters as Record<string, string>), [filters]);

  const toggleTimeline = useCallback((streamId: string) => {
    setExpandedStreamId((prev) => (prev === streamId ? null : streamId));
    onOpenStream?.(streamId);
  }, [onOpenStream]);

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      status: "",
      sender: "",
      recipient: "",
      asset: "",
      q: "",
    });
  }, [onFiltersChange]);

  return (
    <div className="card">
      <FilterBar filters={filters} onChange={onFiltersChange} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: 0 }}>Live Streams</h2>
        <a href={exportUrl} className="btn-ghost" download>
          Export CSV
        </a>
      </div>

      {streams.length === 0 ? (
        <EmptyState
          filters={filters}
          onClearFilters={handleClearFilters}
          hasAnyStreams={(totalStreamCount ?? 0) > 0}
          onCreateStream={onCreateStream}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Addresses</th>
                <th>Amount</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {streams.map((stream) => {
                const isScheduled = stream.progress.status === "scheduled";
                const isFinalised =
                  stream.progress.status === "completed" ||
                  stream.progress.status === "canceled";
                const isExpanded = expandedStreamId === stream.id;
                const healthBadges = getHealthBadges(stream);

                return (
                  <StreamRow
                    key={stream.id}
                    stream={stream}
                    isScheduled={isScheduled}
                    isFinalised={isFinalised}
                    isExpanded={isExpanded}
                    healthBadges={healthBadges}
                    onCancel={onCancel}
                    onPause={onPause}
                    onResume={onResume}
                    onEditStartTime={onEditStartTime}
                    onOpenStream={onOpenStream}
                    onToggleTimeline={toggleTimeline}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
