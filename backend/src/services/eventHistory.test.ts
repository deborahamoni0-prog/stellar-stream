import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { recordEventWithDb, getStreamHistory } from "./eventHistory";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = OFF");
  db.exec(`
    CREATE TABLE stream_events (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id       TEXT NOT NULL,
      event_type      TEXT NOT NULL,
      ledger_sequence INTEGER,
      timestamp       INTEGER NOT NULL,
      actor           TEXT,
      amount          REAL,
      metadata        TEXT
    );
    CREATE UNIQUE INDEX idx_stream_events_dedup
      ON stream_events(stream_id, event_type, ledger_sequence)
      WHERE ledger_sequence IS NOT NULL;
  `);
  return db;
}

describe("recordEventWithDb", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it("inserts an event normally", () => {
    recordEventWithDb(db, "1", "created", 1000, "GSENDER", 100, undefined, 42);
    const rows = db.prepare("SELECT * FROM stream_events").all();
    expect(rows).toHaveLength(1);
  });

  it("silently ignores a duplicate (stream_id, event_type, ledger_sequence)", () => {
    recordEventWithDb(db, "1", "created", 1000, "GSENDER", 100, undefined, 42);
    recordEventWithDb(db, "1", "created", 1000, "GSENDER", 100, undefined, 42);

    const rows = db.prepare("SELECT * FROM stream_events").all();
    expect(rows).toHaveLength(1);
  });

  it("allows same event_type on different ledger sequences", () => {
    recordEventWithDb(db, "1", "claimed", 1000, "GRECIPIENT", 50, undefined, 10);
    recordEventWithDb(db, "1", "claimed", 2000, "GRECIPIENT", 50, undefined, 20);

    const rows = db.prepare("SELECT * FROM stream_events").all();
    expect(rows).toHaveLength(2);
  });

  it("allows events without ledger_sequence to coexist (reconciliation path)", () => {
    recordEventWithDb(db, "1", "created", 1000, "GSENDER", 100);
    recordEventWithDb(db, "1", "created", 1000, "GSENDER", 100);

    // NULL is not equal to NULL in SQLite unique index, so both rows are inserted
    const rows = db.prepare("SELECT * FROM stream_events").all();
    expect(rows).toHaveLength(2);
  });
});

describe("indexer restart deduplication", () => {
  it("produces no duplicate rows after reprocessing the same ledger range", () => {
    const db = createTestDb();

    // Simulate first indexer run: ledger 5
    recordEventWithDb(db, "42", "created", 1000, "GSENDER", 500, undefined, 5);
    recordEventWithDb(db, "42", "claimed", 2000, "GRECIPIENT", 100, undefined, 6);

    // Simulate restart — same ledger range replayed
    recordEventWithDb(db, "42", "created", 1000, "GSENDER", 500, undefined, 5);
    recordEventWithDb(db, "42", "claimed", 2000, "GRECIPIENT", 100, undefined, 6);

    const rows = db.prepare("SELECT * FROM stream_events WHERE stream_id = '42'").all();
    expect(rows).toHaveLength(2);
  });
});
