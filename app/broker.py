"""In-memory fan-out of persisted events to SSE subscribers (R16, R20, R23, R24)."""

import asyncio
from dataclasses import dataclass, field
from typing import Literal

from app.domain import Event

type StopReason = Literal["overflow", "shutdown"]


@dataclass(eq=False, slots=True)
class Subscriber:
    """One SSE connection's bounded buffer of live events."""

    queue: asyncio.Queue[Event]
    stopped: asyncio.Event = field(default_factory=asyncio.Event)
    reason: StopReason | None = None

    def stop(self, reason: StopReason) -> None:
        """Ask the connection to end (R23 overflow or R24 shutdown)."""
        if self.reason is None:
            self.reason = reason
        self.stopped.set()


class Broker:
    """Holds the live subscribers; ``publish`` never blocks (R23)."""

    def __init__(self, queue_size: int) -> None:
        self._queue_size = queue_size
        self._subscribers: set[Subscriber] = set()
        self._closed = False

    @property
    def count(self) -> int:
        """R16: number of registered subscribers."""
        return len(self._subscribers)

    def subscribe(self) -> Subscriber:
        """R20: register before replaying history so no live event is missed."""
        subscriber = Subscriber(asyncio.Queue(maxsize=self._queue_size))
        if self._closed:
            subscriber.stop("shutdown")
        else:
            self._subscribers.add(subscriber)
        return subscriber

    def unsubscribe(self, subscriber: Subscriber) -> None:
        """Remove a subscriber; safe to call more than once."""
        self._subscribers.discard(subscriber)

    def publish(self, event: Event) -> None:
        """R23: enqueue without blocking; a full queue ends that subscriber only."""
        for subscriber in list(self._subscribers):
            try:
                subscriber.queue.put_nowait(event)
            except asyncio.QueueFull:
                self._subscribers.discard(subscriber)
                subscriber.stop("overflow")

    def close(self) -> None:
        """R24: end every live stream and refuse new ones."""
        self._closed = True
        for subscriber in self._subscribers:
            subscriber.stop("shutdown")
        self._subscribers.clear()
