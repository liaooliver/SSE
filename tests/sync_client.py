"""AC1、AC2、AC3 共用的黑箱同步與獨立全序列核對。"""

from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass

import httpx

from .public_api import Event, Snapshot, StageState, TaskError, TaskState, apply_event
from .reference import folded, snapshot_json
from .wire import RETRY, blocks, events, log_item, timed_bytes


@dataclass(slots=True)
class Capture:
    state: Snapshot
    logs: list[dict[str, object]]


async def snapshot(client: httpx.AsyncClient) -> Snapshot:
    """R13 逐層反序列化線上的真實快照。"""
    response = await client.get("/install")
    assert response.status_code == 200
    data = response.json()
    stages = tuple(
        StageState(
            s["id"],
            s["name"],
            s["status"],
            tuple(
                TaskState(
                    t["id"],
                    t["name"],
                    t["status"],
                    None if t["error"] is None else TaskError(**t["error"]),
                )
                for t in s["tasks"]
            ),
        )
        for s in data["stages"]
    )
    result = Snapshot(data["run_id"], data["scenario"], data["status"], data["last_seq"], stages)
    assert type(result.run_id) is int
    assert result.run_id >= 1
    assert type(result.last_seq) is int
    assert result.last_seq >= 1
    assert data == snapshot_json(result)
    return result


async def backfill(client: httpx.AsyncClient, state: Snapshot, limit: int) -> Capture:
    """R15 固定 until。以伺服器回傳的 cursor 逐頁補讀。"""
    cursor = 0
    items: list[dict[str, object]] = []
    while True:
        response = await client.get(
            "/install/logs",
            params={
                "run_id": state.run_id,
                "after": cursor,
                "until": state.last_seq,
                "limit": limit,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data.keys() == {"run_id", "items", "next_after"}
        assert type(data["run_id"]) is int
        assert data["run_id"] == state.run_id
        page = data["items"]
        assert isinstance(page, list)
        assert len(page) <= limit
        assert cursor == 0 or page, "上一頁回傳了沒有後續資料的 cursor"
        for item in page:
            assert type(item["seq"]) is int
            assert type(item["line_no"]) is int
            assert cursor < item["seq"] <= state.last_seq
            cursor = item["seq"]
        items.extend(page)
        if data["next_after"] is None:
            return Capture(state, items)
        assert page
        assert type(data["next_after"]) is int
        assert data["next_after"] == cursor


async def response_events(response: httpx.Response, run: int) -> AsyncIterator[Event]:
    """R20 在真正的 TCP 串流讀到 retry 後才接收事件。"""
    assert response.status_code == 200
    stream = blocks(timed_bytes(response.aiter_bytes()))
    assert (await anext(stream)).raw == RETRY
    async for event in events(stream, run):
        yield event


def verify_sync(
    capture: Capture, suffix: Sequence[Event], full: Sequence[Event], final: Snapshot
) -> None:
    """AC1 快照反映精確前綴。補讀與 SSE 無重疊。重建後與最終快照一致。"""
    state = capture.state
    start = state.last_seq
    assert [event.seq for event in full] == list(range(1, final.last_seq + 1))
    assert (state.run_id, state.scenario) == (final.run_id, final.scenario)
    assert folded(state.run_id, state.scenario, full[:start]) == state
    assert capture.logs == [log_item(event) for event in full[:start] if event.type == "log"]
    assert list(suffix) == list(full[start:])
    # 補讀負責前綴中的 log。快照負責該前綴的狀態。SSE 接續其後。
    seen = [e.seq for e in full[:start] if e.type != "log"]
    for item in capture.logs:
        seq = item["seq"]
        assert isinstance(seq, int)
        seen.append(seq)
    seen.extend(e.seq for e in suffix)
    assert sorted(seen) == list(range(1, final.last_seq + 1))
    for event in suffix:
        state = apply_event(state, event)
    assert state == final
    assert state.status in {"succeeded", "failed"}
