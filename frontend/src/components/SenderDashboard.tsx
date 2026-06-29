import { useEffect, useState, useMemo } from "react";
import { listStreams, cancelStream, createStream } from "../services/api";
import { Stream, CreateStreamPayload } from "../types/stream";
import { CreateStreamForm } from "./CreateStreamForm";

interface SenderDashboardProps {
  /** Connected wallet address (sender account). When null, user must connect. */
  senderAddress: string | null;
  /** Callback to open the edit start time modal */
  onEditStartTime: (stream: Stream) => void;
}

/**
 * Returns the CSS class for a stream status badge.
 * @param status - The progress status of the stream.
 * @returns A string containing the CSS classes.
 */
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

/**
 * Dashboard for users who are sending streams.
 * Displays active/scheduled streams, historical streams, and a creation form.
 * 
 * @param props - The component props.
 * @returns The rendered SenderDashboard component.
 */
export function SenderDashboard({ senderAddress, onEditStartTime }: SenderDashboardProps) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!senderAddress) {
      setLoading(false);
      setStreams([]);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const result = await listStreams({ sender: senderAddress });
        if (!active) return;
        setStreams(result.data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load streams.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    // Poll every 5 seconds to keep metrics and progress fresh
    const interval = setInterval(async () => {
      try {
        const result = await listStreams({ sender: senderAddress });
        if (active) setStreams(result.data);
      } catch {
        // Silent fail on polling
      }
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [senderAddress]);

  const activeStreams = useMemo(() => streams.filter((s) => s.progress.status === "active"), [streams]);
  const scheduledStreams = useMemo(() => streams.filter((s) => s.progress.status === "scheduled"), [streams]);
  const completedStreams = useMemo(() => streams.filter(
    (s) => s.progress.status === "completed" || s.progress.status === "canceled"
  ), [streams]);

  // Group totals by asset for accuracy
  const totalsByAsset = useMemo(() => streams.reduce((acc, s) => {
    acc[s.assetCode] = (acc[s.assetCode] || 0) + s.totalAmount;
    return acc;
  }, {} as Record<string, number>), [streams]);

  /**
   * Handles the creation of a new stream.
   * Ensures the dashboard is refreshed before closing the form.
   * 
   * @param payload - The data for the new stream.
   */
  const handleCreate = async (payload: CreateStreamPayload) => {
    setCreateError(null);
    try {
      await createStream(payload);
      const data = await listStreams({ sender: senderAddress! });
      setStreams(data);
      setShowCreateForm(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create stream.";
      setCreateError(msg);
      throw err;
    }
  };

  if (!senderAddress) {
    return (
      <div className="card recipient-dashboard-card">
        <h2 className="recipient-dashboard-title">Sender Dashboard</h2>
        <div className="activity-empty">
          <span className="activity-empty-icon">🔌</span>
          <p>Wallet Not Connected</p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Connect your wallet to see streams where you are the sender.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card recipient-dashboard-card">
        <h2 className="recipient-dashboard-title">Sender Dashboard</h2>
        <div className="activity-feed">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton skeleton-item" style={{ height: '80px' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card recipient-dashboard-card">
        <h2 className="recipient-dashboard-title">Sender Dashboard</h2>
        <div className="activity-error">
          <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>⚠️</span>
          <h3>Dashboard Load Failed</h3>
          <p className="muted">{error}</p>
        </div>
      </div>
    );
  }

  if (streams.length === 0 && !showCreateForm) {
  if (streams.length === 0) {
    return (
      <div className="card recipient-dashboard-card">
        <h2 className="recipient-dashboard-title">Sender Dashboard</h2>
        <div className="activity-empty">
          <span className="activity-empty-icon">📤</span>
          <p>No Streams Found</p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            You have no active or completed streams as a sender yet.
          </p>
          <button 
            type="button"
            className="btn-primary" 
            style={{ marginTop: '1rem' }}
            onClick={() => setShowCreateForm(true)}
          >
            Create your first stream
          </button>
        </div>
      </div>
    );
  }

  /**
   * Prompts for confirmation and cancels a stream if the user agrees.
   * 
   * @param id - The unique identifier of the stream to cancel.
   */
  const handleCancel = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this stream?")) return;
    try {
      await cancelStream(id);
      const result = await listStreams({ sender: senderAddress! });
      setStreams(result.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel stream");
    }
  };

  return (
    <div className="recipient-dashboard">
      <div className="card recipient-dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 className="recipient-dashboard-title" style={{ marginBottom: 0 }}>Sender Dashboard</h2>
          <button 
            type="button"
            className={showCreateForm ? "btn-ghost" : "btn-primary"}
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "Back to Dashboard" : "Create Stream"}
          </button>
        </div>
        <p className="muted recipient-dashboard-subtitle">
          Outgoing streams created from your account.
        </p>

        {showCreateForm ? (
          <section style={{ marginTop: '1.5rem' }}>
            <CreateStreamForm 
              onCreate={handleCreate}
              apiError={createError}
              walletAddress={senderAddress}
            />
          </section>
        ) : (
          <>
            <section className="recipient-dashboard-metrics">
              {Object.entries(totalsByAsset).map(([asset, amount]) => (
                <article className="metric-card" key={asset}>
                  <span>Total {asset} Outgoing</span>
                  <strong>{Number(amount.toFixed(2))}</strong>
                </article>
              ))}
              <article className="metric-card">
                <span>Active</span>
                <strong>{activeStreams.length}</strong>
              </article>
              <article className="metric-card">
                <span>Scheduled</span>
                <strong>{scheduledStreams.length}</strong>
              </article>
              <article className="metric-card">
                <span>Completed</span>
                <strong>{completedStreams.length}</strong>
              </article>
            </section>

            {(activeStreams.length > 0 || scheduledStreams.length > 0) && (
              <section className="recipient-dashboard-section">
                <h3 className="recipient-dashboard-section-title">Active & Scheduled</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>To</th>
                        <th>Asset</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...scheduledStreams, ...activeStreams].map((stream) => (
                        <tr key={stream.id}>
                          <td>
                            <span className="truncate-address">
                              {stream.recipient.slice(0, 8)}…{stream.recipient.slice(-4)}
                            </span>
                          </td>
                          <td>{stream.assetCode}</td>
                          <td>
                            <strong>
                              {stream.totalAmount} {stream.assetCode}
                            </strong>
                          </td>
                          <td>
                            <span className={statusClass(stream.progress.status)}>
                              {stream.progress.status}
                            </span>
                          </td>
                          <td>
                            <div className="progress-copy">
                              <strong>{stream.progress.percentComplete}%</strong>
                            </div>
                            <div className="progress-bar" aria-hidden>
                              <div
                                style={{
                                  width: `${Math.min(stream.progress.percentComplete, 100)}%`,
                                }}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="action-cell">
                              {stream.progress.status === "scheduled" && (
                                <button
                                  className="btn-ghost btn-edit"
                                  type="button"
                                  title="Edit start time"
                                  onClick={() => onEditStartTime(stream)}
                                >
                                  ✏️ Edit
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-ghost"
                                style={{ color: 'var(--color-error)', padding: '4px 8px' }}
                                onClick={() => handleCancel(stream.id)}
                                disabled={stream.progress.status === 'canceled'}
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {completedStreams.length > 0 && (
              <section className="recipient-dashboard-section">
                <h3 className="recipient-dashboard-section-title">History</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>To</th>
                        <th>Asset</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedStreams.map((stream) => (
                        <tr key={stream.id}>
                          <td>
                            <span className="truncate-address">
                              {stream.recipient.slice(0, 8)}…{stream.recipient.slice(-4)}
                            </span>
                          </td>
                          <td>{stream.assetCode}</td>
                          <td>
                            <strong>
                              {stream.totalAmount} {stream.assetCode}
                            </strong>
                          </td>
                          <td>
                            <span className={statusClass(stream.progress.status)}>
                              {stream.progress.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}