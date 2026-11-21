"""R18-R22 的 SSE 驗收工具。同時用於 ASGI 和 TCP。"""

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from time import monotonic
from typing import Final

from .public_api import Event, JsonValue
from .reference import wire_event

RETRY: Final = b"retry: 3000\n\n"
PING: Final = b": ping\n\n"


@dataclass(frozen=True, slots=True)
class Block:
    raw: bytes
    at: float

    def fields(self) -> dict[str, str]:
        """R19 依欄位名稱解析。拒絕重複欄位與跨行 JSON。"""
        result: dict[str, str] = {}
        for line in self.raw[:-2].decode().split("\n"):
            key, sep, value = line.partition(":")
            assert sep, line
            assert key not in result, line
            result[key] = value.removeprefix(" ")
        return result

    def event(self, run: int) -> Event:
        """R7、R8、R19 驗證識別碼與單行資料。"""
        fields = self.fields()
        assert fields.keys() == {"id", "event", "data"}
        run_text, seq_text = fields["id"].split(".")
        seq = int(seq_text)
        assert seq >= 1
        assert run_text == str(run)
        assert fields["id"] == f"{run}.{seq}"
        data: object = json.loads(fields["data"])
        assert isinstance(data, dict)
        return wire_event(run, seq, fields["event"], data)


async def blocks(chunks: AsyncIterator[tuple[bytes, float]]) -> AsyncIterator[Block]:
    """R19 以空行切分。可跨 chunk 或在同一 chunk 含多筆事件。"""
    pending = b""
    async for chunk, at in chunks:
        pending += chunk
        while b"\n\n" in pending:
            head, pending = pending.split(b"\n\n", 1)
            yield Block(head + b"\n\n", at)
    assert not pending, "串流結尾有未完成的區塊"


async def timed_bytes(chunks: AsyncIterator[bytes]) -> AsyncIterator[tuple[bytes, float]]:
    """R19 為 HTTP 接收區塊記下單調時鐘。"""
    async for chunk in chunks:
        yield chunk, monotonic()


async def events(stream: AsyncIterator[Block], run: int) -> AsyncIterator[Event]:
    """R22 控制註解不占序號。"""
    async for block in stream:
        if block.raw != PING:
            yield block.event(run)


def headers_ok(headers: dict[str, str]) -> None:
    """R19 在客戶端接受壓縮時也必須回傳未壓縮的事件串流。"""
    assert headers["content-type"].lower().startswith("text/event-stream")
    assert {"no-cache", "no-transform"} <= {
        part.strip().lower() for part in headers["cache-control"].split(",")
    }
    assert headers["x-accel-buffering"] == "no"
    assert headers.get("content-encoding", "identity").lower() == "identity"


def log_item(event: Event) -> dict[str, JsonValue]:
    """R15 的補讀資料等於對應的 SSE log 加上 seq。"""
    assert event.type == "log"
    return {"seq": event.seq, **event.data}
