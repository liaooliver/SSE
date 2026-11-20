"""SQLite persistence of the single event sequence (R25).

All methods are synchronous and must be called through ``asyncio.to_thread``. A single
connection guarded by a lock serialises every read and write, so ``seq`` stays contiguous
and every multi-statement read is atomic.
"""

import json
import sqlite3
import threading
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Final

from app.domain import (
    Event,
    EventType,
    JsonValue,
    Snapshot,
    apply_event,
    initial_snapshot,
)

_SCHEMA: Final = """
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario TEXT NOT NULL,
    status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
    run_id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    ts TEXT NOT NULL,
    PRIMARY KEY (run_id, seq)
);
"""

_INTERRUPTED: Final[Mapping[str, str]] = {
    "error_code": "E_INTERRUPTED",
    "message": "伺服器在安裝途中停止",
    "hint": "請重新安裝",
}


@dataclass(frozen=True, slots=True)
class RunInfo:
    """The current (latest) run row."""

    run_id: int
    scenario: str
    running: bool
    last_seq: int


@dataclass(frozen=True, slots=True)
class LogPage:
    """R15: one page of log events of the current run."""

    run: RunInfo
    items: tuple[Event, ...]
    has_more: bool


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _decode_data(raw: str) -> dict[str, JsonValue]:
    value: JsonValue = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("stored event data is not a JSON object")
    return value


def _row_to_event(row: sqlite3.Row) -> Event:
    event_type: EventType = row["type"]
    return Event(row["run_id"], row["seq"], event_type, _decode_data(row["data"]), row["ts"])


class Store:
    """Owns the SQLite connection; every public method is atomic."""

    def __init__(self, path: str) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._conn: sqlite3.Connection | None = None

    def open(self) -> None:
        """Open the database, enable WAL and create the schema."""
        with self._lock:
            conn = sqlite3.connect(self._path, check_same_thread=False, isolation_level=None)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.executescript(_SCHEMA)
            self._conn = conn

    def close(self) -> None:
        """Close the connection (waits for any in-flight operation)."""
        with self._lock:
            if self._conn is not None:
                self._conn.close()
                self._conn = None

    def _db(self) -> sqlite3.Connection:
        if self._conn is None:
            raise RuntimeError("store is not open")
        return self._conn

    def _current_run(self, conn: sqlite3.Connection) -> RunInfo | None:
        row = conn.execute(
            "SELECT r.id, r.scenario, r.status, "
            "(SELECT COALESCE(MAX(seq), 0) FROM events e WHERE e.run_id = r.id) AS last_seq "
            "FROM runs r ORDER BY r.id DESC LIMIT 1"
        ).fetchone()
        if row is None:
            return None
        return RunInfo(row["id"], row["scenario"], row["status"] == "running", row["last_seq"])

    def _insert(
        self,
        conn: sqlite3.Connection,
        run_id: int,
        seq: int,
        event_type: EventType,
        data: Mapping[str, JsonValue],
    ) -> Event:
        ts = _now()
        payload = dict(data)
        if event_type == "log":
            payload["ts"] = ts
        conn.execute(
            "INSERT INTO events (run_id, seq, type, data, ts) VALUES (?, ?, ?, ?, ?)",
            (run_id, seq, event_type, json.dumps(payload, ensure_ascii=False), ts),
        )
        if event_type == "run_finished":
            conn.execute("UPDATE runs SET status = ? WHERE id = ?", (payload["result"], run_id))
        return Event(run_id, seq, event_type, payload, ts)

    def start_run(self, scenario: str) -> Event | None:
        """R14: atomically replace the previous run; None if a run is still running."""
        with self._lock:
            conn = self._db()
            conn.execute("BEGIN IMMEDIATE")
            try:
                current = self._current_run(conn)
                if current is not None and current.running:
                    conn.execute("ROLLBACK")
                    return None
                conn.execute("DELETE FROM events")
                conn.execute("DELETE FROM runs")
                cursor = conn.execute(
                    "INSERT INTO runs (scenario, status) VALUES (?, 'running')", (scenario,)
                )
                run_id = cursor.lastrowid
                if run_id is None:
                    raise RuntimeError("INSERT did not return a row id")
                data: dict[str, JsonValue] = {"run_id": run_id, "scenario": scenario}
                event = self._insert(conn, run_id, 1, "run_started", data)
                conn.execute("COMMIT")
            except BaseException:
                conn.execute("ROLLBACK")
                raise
            return event

    def append(self, run_id: int, event_type: EventType, data: Mapping[str, JsonValue]) -> Event:
        """R7/R25: persist the next event of ``run_id`` with ``seq = last_seq + 1``."""
        with self._lock:
            conn = self._db()
            conn.execute("BEGIN IMMEDIATE")
            try:
                current = self._current_run(conn)
                if current is None or current.run_id != run_id or not current.running:
                    raise RuntimeError(f"run {run_id} is not the running run")
                event = self._insert(conn, run_id, current.last_seq + 1, event_type, data)
                conn.execute("COMMIT")
            except BaseException:
                conn.execute("ROLLBACK")
                raise
            return event

    def _events(self, conn: sqlite3.Connection, run_id: int, after: int) -> tuple[Event, ...]:
        rows = conn.execute(
            "SELECT * FROM events WHERE run_id = ? AND seq > ? ORDER BY seq", (run_id, after)
        ).fetchall()
        return tuple(_row_to_event(row) for row in rows)

    def read_after(self, after: int) -> tuple[RunInfo, tuple[Event, ...]] | None:
        """R18/R20: the current run and its events with ``seq > after``, read atomically."""
        with self._lock:
            conn = self._db()
            conn.execute("BEGIN")
            try:
                run = self._current_run(conn)
                events = () if run is None else self._events(conn, run.run_id, after)
            finally:
                conn.execute("COMMIT")
        return None if run is None else (run, events)

    def snapshot(self) -> Snapshot | None:
        """R13: fold every event of the current run, read in one transaction."""
        loaded = self.read_after(0)
        if loaded is None:
            return None
        run, events = loaded
        state = initial_snapshot(run.run_id, run.scenario)
        for event in events:
            state = apply_event(state, event)
        return state

    def read_logs(self, after: int, until: int | None, limit: int) -> LogPage | None:
        """R15: log events of the current run with ``after < seq <= until``."""
        with self._lock:
            conn = self._db()
            conn.execute("BEGIN")
            try:
                run = self._current_run(conn)
                if run is None:
                    return None
                upper = run.last_seq if until is None else until
                rows = conn.execute(
                    "SELECT * FROM events WHERE run_id = ? AND type = 'log' "
                    "AND seq > ? AND seq <= ? ORDER BY seq LIMIT ?",
                    (run.run_id, after, upper, limit + 1),
                ).fetchall()
            finally:
                conn.execute("COMMIT")
        items = tuple(_row_to_event(row) for row in rows[:limit])
        return LogPage(run, items, len(rows) > limit)

    def recover(self) -> tuple[Event, ...]:
        """R25: close a run left ``running`` by an interrupted process; return added events."""
        with self._lock:
            conn = self._db()
            conn.execute("BEGIN IMMEDIATE")
            try:
                added = self._recover(conn)
                conn.execute("COMMIT")
            except BaseException:
                conn.execute("ROLLBACK")
                raise
            return added

    def _recover(self, conn: sqlite3.Connection) -> tuple[Event, ...]:
        run = self._current_run(conn)
        if run is None or not run.running:
            return ()
        state = initial_snapshot(run.run_id, run.scenario)
        for event in self._events(conn, run.run_id, 0):
            state = apply_event(state, event)
        added: list[Event] = []

        def emit(event_type: EventType, data: Mapping[str, JsonValue]) -> None:
            nonlocal state
            event = self._insert(conn, run.run_id, state.last_seq + 1, event_type, data)
            state = apply_event(state, event)
            added.append(event)

        if state.last_seq == 0:
            emit("run_started", {"run_id": run.run_id, "scenario": run.scenario})
        for stage in state.stages:
            for task in stage.tasks:
                if task.status == "running":
                    emit("task_failed", {"stage_id": stage.id, "task_id": task.id, **_INTERRUPTED})
            if stage.status == "running":
                emit("stage_failed", {"stage_id": stage.id})
        emit("run_finished", {"result": "failed"})
        return tuple(added)
