"""R2、R3、R11-R18 的 HTTP 和 lifespan 驗收。"""

import asyncio
from itertools import pairwise
from pathlib import Path
from time import monotonic

import pytest

from .asgi import AppFactory, lifespan
from .public_api import create_app, script_for
from .reference import CASES, contract_value_error, plan_json
from .sync_client import snapshot
from .wire import PING, events, log_item


def test_r9_r14_r15_r18_openapi(tmp_path: Path) -> None:
    """R9、R14、R15、R18 核對工廠回傳的 FastAPI 公開 OpenAPI 文件。"""
    schema = create_app(db_path=str(tmp_path / "install.db")).openapi()
    paths = schema["paths"]
    body = paths["/install"]["post"]["requestBody"]
    assert body["required"] is True
    body_schema = body["content"]["application/json"]["schema"]
    assert body_schema["$ref"] == "#/components/schemas/InstallRequest"
    model = schema["components"]["schemas"]["InstallRequest"]
    assert model["type"] == "object"
    assert model["required"] == ["scenario"]
    assert model["properties"].keys() == {"scenario"}
    assert model["properties"]["scenario"]["type"] == "string"

    def query(path: str, name: str) -> dict[str, object]:
        (param,) = [
            p for p in paths[path]["get"]["parameters"] if p["in"] == "query" and p["name"] == name
        ]
        assert not param.get("required", False)
        result = param["schema"]
        assert isinstance(result, dict)
        return result

    until = query("/install/logs", "until")
    assert until.get("default") is None
    options = until["anyOf"]
    assert isinstance(options, list)
    assert sorted(option["type"] for option in options) == ["integer", "null"]
    (integer,) = [option for option in options if option["type"] == "integer"]
    assert integer["minimum"] == 0

    cursor = query("/install/events", "last_event_id")
    assert "pattern" not in cursor
    branches = cursor.get("anyOf", [cursor])
    assert isinstance(branches, list)
    assert any(branch.get("type") == "string" for branch in branches)
    assert all("pattern" not in branch for branch in branches)


def test_r3_configuration_validation(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """R2、R3 在工廠當下檢查輸入。建構本身不需要已存在的資料庫目錄。"""
    create_app(db_path=str(tmp_path / "不存在的目錄" / "install.db"))
    for key, env, values in (
        ("db_path", "SSE_DB_PATH", ("",)),
        ("log_interval", "SSE_LOG_INTERVAL", (-0.001, 10.001, float("nan"), float("inf"), "x")),
        ("heartbeat_interval", "SSE_HEARTBEAT_SECONDS", (0, -1, float("-inf"), float("nan"), "x")),
        ("subscriber_queue_size", "SSE_SUBSCRIBER_QUEUE_SIZE", (0, -1, 1.5, "x")),
    ):
        for value in values:
            with contract_value_error():
                create_app(**{key: value})
            with monkeypatch.context() as patch:
                patch.setenv(env, str(value))
                with contract_value_error():
                    create_app(**{key: None})
    for interval in (0, 10):
        create_app(log_interval=interval, heartbeat_interval=0.0001, subscriber_queue_size=1)


async def test_r2_r3_isolation(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """R2、R3、R16、R25 以 HTTP 觀察路徑選擇、建構時讀環境及 lifespan 復原。"""
    path_a, path_b = (str(tmp_path / name) for name in ("a.db", "b.db"))
    monkeypatch.setenv("SSE_DB_PATH", path_a)
    a = create_app(db_path=None, log_interval=5)
    monkeypatch.setenv("SSE_DB_PATH", path_b)
    b = create_app(log_interval=5)
    assert a is not b
    async with lifespan(a) as first, lifespan(b) as second:
        assert await first.count() == await second.count() == 0
        run = await first.start("success")
        async with first.stream() as stream:
            await stream.ready()
            assert await first.count() == 1
            assert await second.count() == 0
            assert (await second.client.get("/install")).status_code == 404
            stream.disconnect()
            async with asyncio.timeout(3.2):
                await stream.task
    async with lifespan(create_app(db_path=path_a)) as reopened:
        state = await snapshot(reopened.client)
        assert (state.run_id, state.status) == (run, "failed")


async def test_r3_r14_log_interval(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """R3、R14 比較環境值、覆寫值和預設值的可觀察 log 節奏。"""
    for index, (env, explicit, expected) in enumerate(
        ((None, None, 0.15), ("0.35", None, 0.35), ("5", 0.015, 0.015))
    ):
        if env is None:
            monkeypatch.delenv("SSE_LOG_INTERVAL", raising=False)
        else:
            monkeypatch.setenv("SSE_LOG_INTERVAL", env)
        app = create_app(db_path=str(tmp_path / f"interval-{index}.db"), log_interval=explicit)
        monkeypatch.setenv("SSE_LOG_INTERVAL", "8")
        async with lifespan(app) as live:
            before = monotonic()
            run = await live.start("success")
            async with live.stream() as stream:
                await stream.ready()
                stamps = []
                async for block in stream.blocks:
                    if block.event(run).type == "log":
                        stamps.append(block.at)
                        if len(stamps) == 8:
                            break
                assert len(stamps) == 8
                for index, stamp in enumerate(stamps[1:], 1):
                    assert stamp - before >= index * expected
                assert stamps[-1] - stamps[0] <= 7 * expected * 3 + 0.2
                for earlier, later in pairwise(stamps):
                    assert later - earlier <= expected * 3 + 0.2
                stream.disconnect()
                async with asyncio.timeout(3.2):
                    await stream.task


async def test_r14_nonlog_timing(apps: AppFactory) -> None:
    """R14 在首次 log、跨 task 與 stage、失敗收尾時檢查非 log 事件不另加等待。"""
    scenario = "network_unreachable"
    async with apps.open(interval=0.4) as live:
        run = await live.start(scenario)
        async with live.stream() as stream:
            await stream.ready()
            timeline = [
                (block.event(run).type, block.at)
                async for block in stream.blocks
                if block.raw != PING
            ]
    assert [kind for kind, _ in timeline] == [step.type for step in script_for(scenario)]
    first_log = next(i for i, (kind, _) in enumerate(timeline) if kind == "log")
    last_log = max(i for i, (kind, _) in enumerate(timeline) if kind == "log")
    # 首行前及末行後均無相鄰 log 間隔。§10 對零等待給予 200 ms 容差。
    for index, ((left, earlier), (right, later)) in enumerate(pairwise(timeline)):
        if index < first_log or index >= last_log or (left != "log" and right != "log"):
            assert later - earlier <= 0.2, (left, right)


async def test_r11_r12_r13_r15_r16_r17_empty(apps: AppFactory) -> None:
    """R11-R13、R15-R18 檢查固定資源、狀態碼與首次安裝前的空資料庫。"""
    async with apps.open() as live:
        for path, expected in (
            ("/install/plan", plan_json()),
            (
                "/install/scenarios",
                [
                    {"id": key, "label": case.label, "fail_task_id": case.task}
                    for key, case in CASES.items()
                ],
            ),
            ("/health", {"status": "ok"}),
        ):
            response = await live.client.get(path)
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("application/json")
            assert response.json() == expected
        assert await live.count() == 0
        for path in ("/install", "/install/logs?run_id=1", "/install/events"):
            assert (await live.client.get(path)).status_code == 404


async def test_r14_ac8_atomic_start(apps: AppFactory) -> None:
    """R13、R14、AC8 輸入驗證、忽略額外欄位。十個同時請求恰好一個成功。"""
    async with apps.open(interval=1) as live:
        for body in ({}, {"scenario": 7}, {"scenario": None}, {"scenario": "unknown"}, []):
            assert (await live.client.post("/install", json=body)).status_code == 422
        assert (
            await live.client.post(
                "/install", content=b"{", headers={"content-type": "application/json"}
            )
        ).status_code == 422
        barrier = asyncio.Barrier(10)

        async def post() -> tuple[int, object]:
            await barrier.wait()
            response = await live.client.post("/install", json={"scenario": "success", "extra": 1})
            return response.status_code, response.json() if response.status_code == 202 else None

        async with asyncio.timeout(8):
            results = await asyncio.gather(*(post() for _ in range(10)))
        assert sorted(code for code, _ in results) == [202, *([409] * 9)]
        state = await snapshot(live.client)
        assert (202, {"run_id": state.run_id, "scenario": "success"}) in results
        assert state.status == "running"
        assert state.last_seq >= 1
        assert (await live.client.post("/install", json={"scenario": "success"})).status_code == 409
        assert (await live.client.get("/install/plan")).json() == plan_json()


async def test_r15_log_windows(apps: AppFactory) -> None:
    """R15 對照完整 SSE 檢查邊界、預設、頁尾 cursor 及輸入限制。"""
    async with apps.open() as live:
        run = await live.start("success")
        async with live.stream() as stream:
            await stream.ready()
            logs = [log_item(e) async for e in events(stream.blocks, run) if e.type == "log"]
        for params in (
            {},
            {"run_id": 0},
            {"run_id": "x"},
            {"run_id": run, "after": -1},
            {"run_id": run, "until": -1},
            {"run_id": run, "until": "x"},
            {"run_id": run, "after": "1.5"},
            {"run_id": run, "limit": 0},
            {"run_id": run, "limit": 1001},
            {"run_id": run, "limit": "x"},
        ):
            assert (await live.client.get("/install/logs", params=params)).status_code == 422
        for params, expected, more in (
            ({}, logs, False),
            ({"limit": 1}, logs[:1], True),
            ({"until": logs[2]["seq"], "limit": 3}, logs[:3], False),
            ({"after": logs[0]["seq"], "until": logs[2]["seq"], "limit": 1}, logs[1:2], True),
            ({"after": logs[0]["seq"], "until": logs[2]["seq"], "limit": 1000}, logs[1:3], False),
            ({"until": 0}, [], False),
            ({"after": 202}, [], False),
        ):
            response = await live.client.get("/install/logs", params={"run_id": run, **params})
            assert response.status_code == 200
            assert response.json() == {
                "run_id": run,
                "items": expected,
                "next_after": expected[-1]["seq"] if more else None,
            }


async def test_r3_r25_default_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """R3、R25 以重新開啟後的 HTTP 快照驗證預設檔名和結束狀態的持久性。"""
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("SSE_DB_PATH")
    async with lifespan(create_app(log_interval=0)) as live:
        run = await live.start("network_unreachable")
        async with live.stream() as stream:
            await stream.ready()
            history = [e async for e in events(stream.blocks, run)]
        assert history[-1].type == "run_finished"
        finished = await snapshot(live.client)
    async with lifespan(create_app(db_path=str(tmp_path / "install.db"))) as reopened:
        assert await snapshot(reopened.client) == finished
