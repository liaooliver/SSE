"""R2 的測試端 ASGI 傳輸。只使用標準訊息與公開 HTTP 介面。"""

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable, Iterable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from time import monotonic
from urllib.parse import urlencode

import httpx

from .public_api import create_app
from .wire import RETRY, Block, blocks

type Message = dict[str, object]
type Application = Callable[
    [Message, Callable[[], Awaitable[Message]], Callable[[Message], Awaitable[None]]],
    Awaitable[None],
]
type Gate = Callable[[bytes], Awaitable[None]]


async def _cleanup(task: asyncio.Task[None]) -> None:
    if not task.done():
        task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        if not task.cancelled():
            raise


async def _message(queue: asyncio.Queue[Message], task: asyncio.Task[None]) -> Message:
    if not queue.empty():
        return queue.get_nowait()
    reading = asyncio.create_task(queue.get())
    try:
        async with asyncio.timeout(8):
            await asyncio.wait((reading, task), return_when=asyncio.FIRST_COMPLETED)
            if reading.done():
                return reading.result()
            await task
            assert not queue.empty(), "應用程式結束時缺少 ASGI 訊息"
            return queue.get_nowait()
    finally:
        reading.cancel()
        await asyncio.gather(reading, return_exceptions=True)


@dataclass(slots=True)
class Stream:
    status: int
    headers: dict[str, str]
    blocks: AsyncIterator[Block]
    incoming: asyncio.Queue[Message]
    task: asyncio.Task[None]

    async def ready(self) -> Block:
        """R20 等待獨立的第一個 retry 區塊。"""
        async with asyncio.timeout(3.2):
            first = await anext(self.blocks)
            assert first.raw == RETRY
            return first

    def disconnect(self) -> None:
        """R24 由傳輸層通知斷線。"""
        self.incoming.put_nowait({"type": "http.disconnect"})


@dataclass(slots=True)
class Live:
    application: Application
    client: httpx.AsyncClient

    async def start(self, scenario: str) -> int:
        """R14 建立安裝並驗證公開回應。"""
        response = await self.client.post("/install", json={"scenario": scenario})
        assert response.status_code == 202
        data = response.json()
        run = data["run_id"]
        assert type(run) is int
        assert run > 0
        assert data == {"run_id": run, "scenario": scenario}
        return run

    async def count(self) -> int:
        """R16 讀取公開訂閱數。"""
        response = await self.client.get("/stats")
        assert response.status_code == 200
        data = response.json()
        count = data["subscribers"]
        assert type(count) is int
        assert count >= 0
        assert data == {"subscribers": count}
        return count

    @asynccontextmanager
    async def stream(
        self,
        query: str | None = None,
        header: str | None = None,
        gate: Gate | None = None,
        on_send: Callable[[], Awaitable[None]] | None = None,
    ) -> AsyncIterator[Stream]:
        """R2、R23 使用可阻塞的 send 與測試端控制的 disconnect。"""
        incoming: asyncio.Queue[Message] = asyncio.Queue()
        outgoing: asyncio.Queue[Message] = asyncio.Queue()
        incoming.put_nowait({"type": "http.request", "body": b"", "more_body": False})
        headers = [(b"accept-encoding", b"gzip, deflate")]
        if header is not None:
            headers.append((b"last-event-id", header.encode()))
        scope: Message = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "scheme": "http",
            "method": "GET",
            "path": "/install/events",
            "raw_path": b"/install/events",
            "root_path": "",
            "query_string": urlencode({"last_event_id": query}).encode()
            if query is not None
            else b"",
            "headers": headers,
            "client": ("127.0.0.1", 55555),
            "server": ("test", 80),
        }

        async def send(message: Message) -> None:
            if on_send is not None:
                await on_send()
            body = message.get("body")
            if gate is not None and isinstance(body, (bytes, memoryview)) and body:
                await gate(bytes(body))
            outgoing.put_nowait({**message, "at": monotonic()})

        async def serve() -> None:
            await self.application(scope, incoming.get, send)

        task = asyncio.create_task(serve())

        async def chunks() -> AsyncIterator[tuple[bytes, float]]:
            while True:
                message = await _message(outgoing, task)
                assert message["type"] == "http.response.body"
                body = message.get("body", b"")
                at = message["at"]
                assert isinstance(body, (bytes, memoryview))
                assert isinstance(at, float)
                yield bytes(body), at
                if not message.get("more_body", False):
                    async with asyncio.timeout(8):
                        await task
                    return

        try:
            start = await _message(outgoing, task)
            assert start["type"] == "http.response.start"
            status, raw = start["status"], start.get("headers", [])
            assert isinstance(status, int)
            assert isinstance(raw, Iterable)
            received = dict(httpx.Headers(list(raw)))
            yield Stream(status, received, blocks(chunks()), incoming, task)
        finally:
            incoming.put_nowait({"type": "http.disconnect"})
            if not task.done():
                await asyncio.wait({task}, timeout=3.2)
            await _cleanup(task)


@asynccontextmanager
async def lifespan(application: Application) -> AsyncIterator[Live]:
    """R2 在測試端啟動與關閉完整 lifespan。"""
    incoming: asyncio.Queue[Message] = asyncio.Queue()
    outgoing: asyncio.Queue[Message] = asyncio.Queue()
    shared: dict[str, object] = {}
    scope: Message = {
        "type": "lifespan",
        "asgi": {"version": "3.0", "spec_version": "2.0"},
        "state": shared,
    }

    async def serve() -> None:
        await application(scope, incoming.get, outgoing.put)

    task = asyncio.create_task(serve())
    try:
        incoming.put_nowait({"type": "lifespan.startup"})
        assert (await _message(outgoing, task))["type"] == "lifespan.startup.complete"
        try:

            async def request(
                scope: Message,
                receive: Callable[[], Awaitable[Message]],
                send: Callable[[Message], Awaitable[None]],
            ) -> None:
                await application({**scope, "state": shared.copy()}, receive, send)

            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=request), base_url="http://test"
            ) as client:
                yield Live(request, client)
        finally:
            incoming.put_nowait({"type": "lifespan.shutdown"})
            assert (await _message(outgoing, task))["type"] == "lifespan.shutdown.complete"
            async with asyncio.timeout(8):
                await task
    finally:
        await _cleanup(task)


@dataclass(frozen=True, slots=True)
class AppFactory:
    path: Path

    @asynccontextmanager
    async def open(
        self, interval: float = 0, heartbeat: float | None = 15, queue: int | None = 1000
    ) -> AsyncIterator[Live]:
        """R2 透過 lifespan 啟用獨立 app。"""
        app = create_app(
            db_path=str(self.path),
            log_interval=interval,
            heartbeat_interval=heartbeat,
            subscriber_queue_size=queue,
        )
        async with lifespan(app) as live:
            yield live
