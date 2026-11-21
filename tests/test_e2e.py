"""R1、R17-R26 的真實 TCP、程序訊號及頁面驗收。"""

import asyncio
import random
import re
import signal
from collections import Counter
from contextlib import suppress
from html.parser import HTMLParser

import httpx
import pytest

from .page_script import check_scripts
from .public_api import Event, script_for
from .reference import folded
from .server import ServerFactory
from .sync_client import backfill, response_events, snapshot, verify_sync
from .wire import PING, RETRY, blocks, headers_ok, timed_bytes

pytestmark = pytest.mark.e2e


async def _start(client: httpx.AsyncClient, scenario: str = "success") -> int:
    response = await client.post("/install", json={"scenario": scenario})
    assert response.status_code == 202
    return response.json()["run_id"]


async def _history(client: httpx.AsyncClient, run: int) -> list[Event]:
    async with client.stream("GET", "/install/events") as response:
        return [e async for e in response_events(response, run)]


async def test_ac3_tcp_reconnect(servers: ServerFactory) -> None:
    """R13、R15、R18、R20、AC1、AC3 於三十輪的隨機進度斷開真實 TCP 後以 header 補送。"""
    rng = random.Random(13057)
    scenario = "network_unreachable"
    steps = script_for(scenario)
    # 留下至少兩行正常 log。避免客戶端讀到斷點前伺服器已送完最後一批。
    last_cut = [
        seq
        for seq, step in enumerate(steps, 1)
        if step.type == "log" and step.data["level"] == "info"
    ][-3]
    async with servers.launch(interval=0.015) as server:
        client = server.client
        previous_run = 0
        for trial in range(30):
            for _ in range(3):
                run = await _start(client, scenario)
                assert run > previous_run
                previous_run = run
                state = await snapshot(client)
                assert state.run_id == run
                if state.last_seq < last_cut:
                    assert state.status == "running"
                    break
                # 快照已越過可選斷點。等這輪結束再建立下一輪。
                if state.status == "running":
                    await _history(client, run)
            else:
                pytest.fail(f"第 {trial + 1} 次斷線驗收連續三輪錯過可選斷點")
            capture = await backfill(client, state, limit=3)
            cut = rng.randint(state.last_seq + 1, last_cut)
            suffix: list[Event] = []
            query = {"last_event_id": f"{run}.{state.last_seq}"}
            async with client.stream("GET", "/install/events", params=query) as response:
                async for event in response_events(response, run):
                    suffix.append(event)
                    if event.seq == cut:
                        break
            assert suffix, trial
            assert suffix[-1].seq == cut, trial
            async with client.stream(
                "GET", "/install/events", params=query, headers={"Last-Event-ID": f"{run}.{cut}"}
            ) as resumed:
                suffix.extend([e async for e in response_events(resumed, run)])
            final = await snapshot(client)
            history = await _history(client, run)
            assert len(history) == len(steps)
            verify_sync(capture, suffix, history, final)


async def test_ac9_tcp_headers_ping_disconnect(servers: ServerFactory) -> None:
    """R16-R20、R22、R24、AC9 驗證線上格式與關閉 TCP 後的退訂時限。"""
    async with servers.launch(interval=2, heartbeat=0.08) as server:
        client = server.client
        baseline = (await client.get("/stats")).json()["subscribers"]
        run = await _start(client)
        async with client.stream(
            "GET", "/install/events", headers={"Accept-Encoding": "gzip, deflate"}
        ) as response:
            assert response.status_code == 200
            headers_ok(dict(response.headers))
            stream = blocks(timed_bytes(response.aiter_raw()))
            assert (await anext(stream)).raw == RETRY
            assert (await client.get("/stats")).json()["subscribers"] == baseline + 1
            async with asyncio.timeout(2):
                async for block in stream:
                    if block.raw == PING:
                        break
                    block.event(run)
                else:
                    pytest.fail("閒置的連線過早結束")
        async with asyncio.timeout(2 * 3 + 0.2):
            while True:
                stats = await client.get("/stats")
                assert stats.status_code == 200
                if stats.json() == {"subscribers": baseline}:
                    break
                await asyncio.sleep(0.02)
        assert (await snapshot(client)).status == "running"


@pytest.mark.parametrize("sig", [signal.SIGINT, signal.SIGTERM], ids=["sigint", "sigterm"])
async def test_r24_live_shutdown(servers: ServerFactory, sig: signal.Signals) -> None:
    """R24、R25、AC9 在 SSE 仍開著時要求關機。重啟後應出現中斷復原。"""
    async with servers.launch(interval=8) as server:
        run = await _start(server.client)
        async with server.client.stream("GET", "/install/events") as response:
            stream = response_events(response, run)
            async for event in stream:
                if event.type == "task_started":
                    break
            else:
                pytest.fail("收到執行中 task 前串流已結束")
            async with asyncio.timeout(3 * 3 + 0.2):
                server.process.send_signal(sig)
                await server.process.wait()
                with suppress(httpx.RemoteProtocolError, httpx.ReadError):
                    assert all(e.type != "run_finished" for e in [e async for e in stream])
    async with servers.launch(interval=0) as restarted:
        state = await snapshot(restarted.client)
        assert state.run_id == run
        assert state.status == "failed"
        assert any(
            t.error and t.error.error_code == "E_INTERRUPTED" for s in state.stages for t in s.tasks
        )


async def test_r25_ac9_sigkill_recovery(servers: ServerFactory) -> None:
    """R7、R8、R10、R13、R25、AC9 收到 log 即 SIGKILL。核對重播前綴、復原尾端及冪等性。"""
    prefix: list[Event] = []
    async with servers.launch(interval=0.5) as server:
        run = await _start(server.client)
        async with server.client.stream("GET", "/install/events") as response:
            async for event in response_events(response, run):
                prefix.append(event)
                if event.type == "log":
                    server.process.kill()
                    break
            else:
                pytest.fail("強制終止前未見執行中的 log")
            async with asyncio.timeout(4):
                assert await server.process.wait() == -signal.SIGKILL

    async with servers.launch(interval=0) as recovered:
        client = recovered.client
        final = await snapshot(client)
        assert (final.run_id, final.scenario, final.status) == (run, "success", "failed")
        history = await _history(client, run)
        assert history[: len(prefix)] == prefix
        assert [e.seq for e in history] == list(range(1, final.last_seq + 1))
        assert [e.type for e in history[-3:]] == ["task_failed", "stage_failed", "run_finished"]
        before = folded(run, "success", history[:-3])
        (stage,) = (s for s in before.stages if s.status == "running")
        (task,) = (t for t in stage.tasks if t.status == "running")
        assert history[-3].data == {
            "stage_id": stage.id,
            "task_id": task.id,
            "error_code": "E_INTERRUPTED",
            "message": "伺服器在安裝途中停止",
            "hint": "請重新安裝",
        }
        assert history[-2].data == {"stage_id": stage.id}
        assert history[-1].data == {"result": "failed"}
        assert final == folded(run, "success", history)
    async with servers.launch(interval=0) as restarted:
        assert await snapshot(restarted.client) == final
        assert await _history(restarted.client, run) == history
        assert await _start(restarted.client) > run


class _Page(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: Counter[str] = Counter()
        self.selects: set[str | None] = set()
        self.resources: list[str] = []
        self.in_style = False
        self.script_type: str | None = None
        self.scripts: list[tuple[bool, str]] = []
        self.has_script_src = False
        self.import_map = False

    def _css(self, css: str) -> None:
        css = re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)
        for match in re.finditer(r"""url\(\s*['"]?(.*?)['"]?\s*\)""", css, re.I | re.S):
            self.resources.append(match[1])
        for match in re.finditer(r"""@import\s+['"]([^'"]+)""", css, re.I):
            self.resources.append(match[1])

    def _srcset(self, value: str) -> None:
        # 資料 URI 也能含逗號。先讀取整個 URL 再略過寬度或像素密度描述。
        remaining = value.strip()
        while remaining:
            parts = remaining.split(maxsplit=1)
            url = parts[0]
            self.resources.append(url.rstrip(","))
            remaining = parts[1] if len(parts) == 2 else ""
            if not url.endswith(","):
                remaining = remaining.partition(",")[2].lstrip()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        if (identifier := a.get("id")) is not None:
            self.ids[identifier] += 1
        if tag == "select":
            self.selects.add(identifier)
        self.scripts.extend(
            (False, value) for key, value in attrs if key.startswith("on") and value
        )
        if tag == "script":
            kind = (a.get("type") or "").partition(";")[0].strip().lower()
            self.import_map |= kind == "importmap"
            if a.get("src"):
                self.has_script_src = True
            elif kind in {"", "module", "text/jscript", "text/livescript"} or re.fullmatch(
                r"(?:application|text)/(?:x-)?(?:java|ecma)script|text/javascript1\.[0-5]", kind
            ):
                self.script_type = kind
        self.in_style = tag == "style"
        self._css(a.get("style") or "")
        if tag in {
            "script",
            "img",
            "iframe",
            "audio",
            "video",
            "source",
            "embed",
            "track",
            "input",
        } and (src := a.get("src")):
            self.resources.append(src)
        if tag in {"img", "source", "link"}:
            self._srcset(a.get("srcset") or a.get("imagesrcset") or "")
        if tag == "object" and (src := a.get("data")):
            self.resources.append(src)
        if tag == "video" and (src := a.get("poster")):
            self.resources.append(src)
        if tag == "link" and set((a.get("rel") or "").lower().split()) & {
            "stylesheet",
            "icon",
            "preload",
            "modulepreload",
            "manifest",
            "prefetch",
        }:
            self.resources.append(a.get("href") or "")
        if tag in {"image", "use"}:
            self.resources.append(a.get("href") or a.get("xlink:href") or "")

    def handle_endtag(self, tag: str) -> None:
        if tag == "style":
            self.in_style = False
        if tag == "script":
            self.script_type = None

    def handle_data(self, data: str) -> None:
        if self.in_style:
            self._css(data)
        if self.script_type is not None:
            self.scripts.append((self.script_type == "module", data))


async def test_r26_html(servers: ServerFactory) -> None:
    """R26 核對媒體類型、固定元素、內嵌腳本及可靜態辨識的資源載入。"""
    async with servers.launch(interval=0) as server:
        response = await server.client.get("/")
        assert response.status_code == 200
        media, *params = response.headers["content-type"].lower().split(";")
        assert media.strip() == "text/html"
        assert "charset=utf-8" in [p.strip().replace('"', "") for p in params]
        page = _Page()
        page.feed(response.content.decode("utf-8"))
        page.close()
        assert "scenario" in page.selects
        for key in (
            "scenario",
            "install-btn",
            "run-status",
            "stage-list",
            "task-list",
            "follow-btn",
        ):
            assert page.ids[key] == 1, key
        for target in page.resources:
            assert not target or target.strip().lower().startswith(("data:", "#")), target
        check_scripts(page.scripts, str(response.url), page.has_script_src, page.import_map)
