"""SSE wire handling for ``GET /install/events`` (R19-R24)."""

import asyncio
import contextlib
import json
import logging
from collections.abc import AsyncGenerator, Callable
from typing import Final

from starlette.responses import StreamingResponse
from starlette.types import Receive, Scope, Send

from app.broker import Subscriber
from app.domain import PING_COMMENT, RETRY_BLOCK, Event, format_event

logger = logging.getLogger(__name__)

SSE_HEADERS: Final[dict[str, str]] = {
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
}
_FINISH_TIMEOUT: Final = 1.0


def reset_block(run_id: int) -> str:
    """R18: control event telling the client to resync; carries no ``id``."""
    return f"event: reset\ndata: {json.dumps({'run_id': run_id})}\n\n"


async def reset_stream(run_id: int) -> AsyncGenerator[str]:
    """R18: ``retry`` block, then ``reset``, then end of response."""
    yield RETRY_BLOCK
    yield reset_block(run_id)


async def event_stream(
    subscriber: Subscriber,
    run_id: int,
    start_seq: int,
    replay: tuple[Event, ...],
    heartbeat_interval: float,
) -> AsyncGenerator[str]:
    """R20-R22: retry block, replayed events, then deduplicated live events with pings."""
    yield RETRY_BLOCK
    last_sent = start_seq
    for event in replay:
        yield format_event(event)
        last_sent = event.seq
        if event.type == "run_finished":
            return
    loop = asyncio.get_running_loop()
    deadline = loop.time() + heartbeat_interval
    while True:
        try:
            async with asyncio.timeout_at(deadline):
                event = await subscriber.queue.get()
        except TimeoutError:
            yield PING_COMMENT
            deadline = loop.time() + heartbeat_interval
            continue
        if event.run_id != run_id or event.seq <= last_sent:
            continue
        yield format_event(event)
        last_sent = event.seq
        deadline = loop.time() + heartbeat_interval
        if event.type == "run_finished":
            return


class EventStreamResponse(StreamingResponse):
    """Streams SSE chunks; ends on client disconnect, overflow (R23) or shutdown (R24).

    Each chunk is sent as its own ASGI message. ``on_close`` always runs exactly once.
    """

    media_type = "text/event-stream"

    def __init__(
        self,
        chunks: AsyncGenerator[str],
        subscriber: Subscriber | None = None,
        on_close: Callable[[], None] | None = None,
    ) -> None:
        super().__init__(chunks, headers=SSE_HEADERS, media_type=self.media_type)
        self._chunks = chunks
        self._subscriber = subscriber
        self._on_close = on_close

    async def _pump(self, send: Send) -> None:
        try:
            async for chunk in self._chunks:
                await send(
                    {"type": "http.response.body", "body": chunk.encode(), "more_body": True}
                )
        finally:
            await self._chunks.aclose()
        await send({"type": "http.response.body", "body": b"", "more_body": False})

    @staticmethod
    async def _wait_disconnect(receive: Receive) -> None:
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return

    async def _finish_after_shutdown(self, send: Send) -> None:
        with contextlib.suppress(TimeoutError, OSError):
            async with asyncio.timeout(_FINISH_TIMEOUT):
                await send({"type": "http.response.body", "body": b"", "more_body": False})

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """R19-R24: run the pump against disconnect and stop signals."""
        tasks: list[asyncio.Task[None]] = []
        try:
            await send(
                {
                    "type": "http.response.start",
                    "status": self.status_code,
                    "headers": self.raw_headers,
                }
            )
            pump = asyncio.create_task(self._pump(send))
            tasks = [pump, asyncio.create_task(self._wait_disconnect(receive))]
            if self._subscriber is not None:
                stopped = self._subscriber.stopped
                tasks.append(asyncio.create_task(_wait_event(stopped)))
            done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            if pump in done:
                pump.result()
            else:
                await _cancel_all(tasks)
                tasks = []
                if self._subscriber is not None and self._subscriber.reason == "shutdown":
                    await self._finish_after_shutdown(send)
        finally:
            await _cancel_all(tasks)
            await self._chunks.aclose()
            if self._on_close is not None:
                self._on_close()
        if self.background is not None:
            await self.background()


async def _wait_event(event: asyncio.Event) -> None:
    await event.wait()


async def _cancel_all(tasks: list[asyncio.Task[None]]) -> None:
    for task in tasks:
        task.cancel()
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for result in results:
        if isinstance(result, Exception):
            logger.warning("SSE helper task failed: %r", result)
