"""Configuration (R3) and the per-app runtime: store, broker, simulator (R14, R24, R25)."""

import asyncio
import contextlib
import logging
import math
import os
import signal
import threading
from collections.abc import Callable
from dataclasses import dataclass
from types import FrameType
from typing import Final

from app.broker import Broker
from app.domain import Event, script_for
from app.store import Store

logger = logging.getLogger(__name__)

_SIGNALS: Final = (signal.SIGINT, signal.SIGTERM)


@dataclass(frozen=True, slots=True)
class Settings:
    """R3: resolved configuration."""

    db_path: str
    log_interval: float
    heartbeat_interval: float
    subscriber_queue_size: int


def _pick(value: object, env_name: str, default: object) -> object:
    if value is not None:
        return value
    raw = os.environ.get(env_name)
    return default if raw is None else raw


def _as_float(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        raise ValueError(f"{name} must be a number")
    try:
        number = float(value)
    except ValueError as exc:
        raise ValueError(f"{name} is not a number: {value!r}") from exc
    if not math.isfinite(number):
        raise ValueError(f"{name} must be finite")
    return number


def _as_int(value: object, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int | str):
        raise ValueError(f"{name} must be an integer")
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"{name} is not an integer: {value!r}") from exc


def resolve_settings(
    db_path: str | None,
    log_interval: float | None,
    heartbeat_interval: float | None,
    subscriber_queue_size: int | None,
) -> Settings:
    """R3: explicit non-None argument > environment variable > default; ValueError if invalid."""
    path = _pick(db_path, "SSE_DB_PATH", "./install.db")
    if not isinstance(path, str) or not path:
        raise ValueError("db_path must be a non-empty string")
    interval = _as_float(_pick(log_interval, "SSE_LOG_INTERVAL", 0.15), "log_interval")
    if not 0 <= interval <= 10:
        raise ValueError("log_interval must be between 0 and 10")
    heartbeat = _as_float(
        _pick(heartbeat_interval, "SSE_HEARTBEAT_SECONDS", 15.0), "heartbeat_interval"
    )
    if heartbeat <= 0:
        raise ValueError("heartbeat_interval must be positive")
    queue_size = _as_int(
        _pick(subscriber_queue_size, "SSE_SUBSCRIBER_QUEUE_SIZE", 1000), "subscriber_queue_size"
    )
    if queue_size < 1:
        raise ValueError("subscriber_queue_size must be >= 1")
    return Settings(path, interval, heartbeat, queue_size)


class Runtime:
    """State owned by one app's lifespan."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.store = Store(settings.db_path)
        self.broker = Broker(settings.subscriber_queue_size)
        self._simulators: set[asyncio.Task[None]] = set()
        self._shutting_down = False
        self._previous_handlers: dict[signal.Signals, object] = {}

    async def start(self) -> None:
        """R25: open the database, create the schema and finish an interrupted run."""
        await asyncio.to_thread(self.store.open)
        recovered = await asyncio.to_thread(self.store.recover)
        if recovered:
            logger.warning("recovered interrupted run %d", recovered[0].run_id)
        self._install_signal_handlers()

    async def stop(self) -> None:
        """R24: cancel the simulator, end every stream, close the database."""
        self._restore_signal_handlers()
        self.begin_shutdown()
        simulators = list(self._simulators)
        await asyncio.gather(*simulators, return_exceptions=True)
        await asyncio.to_thread(self.store.close)

    def begin_shutdown(self) -> None:
        """R24: stop producing events and end all SSE responses."""
        self._shutting_down = True
        for task in self._simulators:
            task.cancel()
        self.broker.close()

    async def start_install(self, scenario: str) -> Event | None:
        """R14: persist ``run_started`` atomically, then simulate in the background."""
        event = await asyncio.to_thread(self.store.start_run, scenario)
        if event is None:
            return None
        self.broker.publish(event)
        if not self._shutting_down:
            task = asyncio.create_task(self._simulate(event.run_id, scenario))
            self._simulators.add(task)
            task.add_done_callback(self._simulators.discard)
        return event

    async def _simulate(self, run_id: int, scenario: str) -> None:
        """R6/R14: play the script after ``run_started``; DB write happens before broadcast."""
        previous_was_log = False
        try:
            for step in script_for(scenario)[1:]:
                is_log = step.type == "log"
                if is_log and previous_was_log:
                    await asyncio.sleep(self.settings.log_interval)
                previous_was_log = is_log
                event = await asyncio.to_thread(self.store.append, run_id, step.type, step.data)
                self.broker.publish(event)
        except asyncio.CancelledError:
            logger.info("simulator for run %d cancelled", run_id)
            raise
        except Exception:
            logger.exception("simulator for run %d failed; closing the run", run_id)
            for event in await asyncio.to_thread(self.store.recover):
                self.broker.publish(event)

    def _install_signal_handlers(self) -> None:
        if threading.current_thread() is not threading.main_thread():
            return
        loop = asyncio.get_running_loop()
        for sig in _SIGNALS:
            previous = signal.getsignal(sig)
            self._previous_handlers[sig] = previous
            signal.signal(sig, self._make_handler(loop, previous))

    def _make_handler(
        self, loop: asyncio.AbstractEventLoop, previous: object
    ) -> Callable[[int, FrameType | None], None]:
        def handler(signum: int, frame: FrameType | None) -> None:
            with contextlib.suppress(RuntimeError):
                loop.call_soon_threadsafe(self.begin_shutdown)
            if callable(previous):
                previous(signum, frame)
            elif previous == signal.SIG_DFL:
                signal.signal(signum, signal.SIG_DFL)
                signal.raise_signal(signum)

        return handler

    def _restore_signal_handlers(self) -> None:
        for sig, previous in self._previous_handlers.items():
            if callable(previous) or isinstance(previous, int):
                signal.signal(sig, previous)
        self._previous_handlers.clear()
