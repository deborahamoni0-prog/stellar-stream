import { getDb } from "./db";

export type StreamEventType = "created" | "claimed" | "canceled" | "start_time_updated";

export interface StreamEvent {
  id: number;
  streamId: string;
  eventType: StreamEventType;
  ledgerSequence?: number;
  timestamp: number;
  actor?: string;
  amount?: number;
  metadata?: Record<string, any>;
}

interface EventRow {
  id: number;
  stream_id: string;
  event_type: string;
  ledger_sequence: number | null;
  timestamp: number;
  actor: string | null;
  amount: number | null;
  metadata: string | null;
}

function rowToEvent(row: EventRow): StreamEvent {
  return {
    id: row.id,
    streamId: row.stream_id,
    eventType: row.event_type as StreamEventType,
    ledgerSequence: row.ledger_sequence ?? undefined,
    timestamp: row.timestamp,
    actor: row.actor ?? undefined,
    amount: row.amount ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

export function recordEvent(
  streamId: string,
  eventType: StreamEventType,
  timestamp: number,
  actor?: string,
  amount?: number,
  metadata?: Record<string, any>,
  ledgerSequence?: number,
): void {
  const db = getDb();
  recordEventWithDb(db, streamId, eventType, timestamp, actor, amount, metadata, ledgerSequence);
}

/**
 * Insert a stream event using a caller-supplied db handle (or transaction).
 * Uses INSERT OR IGNORE so duplicate (stream_id, event_type, ledger_sequence)
 * rows are silently skipped — safe to call on indexer restart.
 */
export function recordEventWithDb(
  db: any,
  streamId: string,
  eventType: StreamEventType,
  timestamp: number,
  actor?: string,
  amount?: number,
  metadata?: Record<string, any>,
  ledgerSequence?: number,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO stream_events (stream_id, event_type, ledger_sequence, timestamp, actor, amount, metadata)
     VALUES (@streamId, @eventType, @ledgerSequence, @timestamp, @actor, @amount, @metadata)`,
  ).run({
    streamId,
    eventType,
    ledgerSequence: ledgerSequence ?? null,
    timestamp,
    actor: actor ?? null,
    amount: amount ?? null,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

export function getStreamHistory(streamId: string, limit = 50, offset = 0): StreamEvent[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM stream_events WHERE stream_id = ? ORDER BY timestamp ASC, id ASC LIMIT ? OFFSET ?`,
    )
    .all(streamId, limit, offset) as EventRow[];
  return rows.map(rowToEvent);
}

export function getAllEvents(limit = 100, offset = 0): StreamEvent[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM stream_events ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as EventRow[];
  return rows.map(rowToEvent);
}

export function getGlobalEvents(
  limit: number,
  offset: number,
  eventType?: StreamEventType,
): StreamEvent[] {
  const db = getDb();
  if (eventType) {
    const rows = db
      .prepare(
        `SELECT * FROM stream_events WHERE event_type = ? ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .all(eventType, limit, offset) as EventRow[];
    return rows.map(rowToEvent);
  }
  return getAllEvents(limit, offset);
}

export function countAllEvents(eventType?: StreamEventType): number {
  const db = getDb();
  if (eventType) {
    const row = db
      .prepare(`SELECT COUNT(*) as count FROM stream_events WHERE event_type = ?`)
      .get(eventType) as { count: number };
    return row.count;
  }
  const row = db
    .prepare(`SELECT COUNT(*) as count FROM stream_events`)
    .get() as { count: number };
  return row.count;
}

export function countStreamEvents(streamId: string): number {
  const db = getDb();
  const row = db
    .prepare(`SELECT COUNT(*) as count FROM stream_events WHERE stream_id = ?`)
    .get(streamId) as { count: number };
  return row.count;
}

export function streamHasEvent(
  streamId: string,
  eventType: StreamEventType,
): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 as present FROM stream_events WHERE stream_id = ? AND event_type = ? LIMIT 1`,
    )
    .get(streamId, eventType) as { present: number } | undefined;

  return row !== undefined;
}
