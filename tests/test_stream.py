"""R13-R25 串流、補讀、重連及背壓驗收。"""

import asyncio
import json
import random
from time import monotonic

import pytest

from .asgi import AppFactory, Live, Stream
from .public_api import Event, script_for
from .reference import CASES, check_sequence, folded
from .sync_client import Capture, backfill, snapshot, verify_sync
from .wire import PING, events, headers_ok, log_item


async def _history(live: Live, run: int) -> list[Event]:
    async with live.stream() as stream:
        assert stream.status == 200
        headers_ok(stream.headers)
        await stream.ready()
        return [e async for e in events(stream.blocks, run)]


@pytest.mark.parametrize("scenario", CASES)
async def test_ac4_ac5_ac7_complete_run(apps: AppFactory, scenario: str) -> None:
    """R5-R8、R10、R13、R18-R21、AC4、AC5、AC7 從頭到 EOF 核對事件與終態。"""
    async with apps.open() as live:
        run = await live.start(scenario)
        all_events = await _history(live, run)
        check_sequence(run, scenario, all_events)
        final = await snapshot(live.client)
        assert folded(run, scenario, all_events) == final
        assert all_events[-1].type == "run_finished"
        assert final.status == ("succeeded" if scenario == "success" else "failed")
        assert await live.count() == 0
        for seq in (final.last_seq, final.last_seq + 1):
            response = await live.client.get(
                "/install/events", headers={"Last-Event-ID": f"{run}.{seq}"}
            )
            assert response.status_code == 204
            assert not response.content
        case = CASES[scenario]
        if case.task is not None:
            tasks = [t for stage in final.stages for t in stage.tasks]
            index = next(i for i, t in enumerate(tasks) if t.id == case.task)
            failed = tasks[index]
            assert failed.status == "failed"
            assert failed.error is not None
            assert (failed.error.error_code, failed.error.message, failed.error.hint) == (
                case.code,
                case.message,
                case.hint,
            )
            assert all(t.status == "pending" for t in tasks[index + 1 :])
            where = next(i for i, s in enumerate(final.stages) if failed in s.tasks)
            assert final.stages[where].status == "failed"
            assert all(s.status == "pending" for s in final.stages[where + 1 :])
            target = [e for e in all_events if e.data.get("task_id") == case.task]
            assert target[-1].type == "task_failed"
            assert target[-2].type == "log"
            assert target[-2].data["level"] == "error"
            for key in ("task_id", "error_code", "message", "hint"):
                assert target[-1].data[key]


async def _synchronize(live: Live, limit: int) -> tuple[Capture, list[Event]]:
    state = await snapshot(live.client)
    capture = await backfill(live.client, state, limit)
    async with live.stream(query=f"{state.run_id}.{state.last_seq}") as stream:
        if stream.status == 204:
            assert state.status != "running"
            return capture, []
        assert stream.status == 200
        await stream.ready()
        return capture, [e async for e in events(stream.blocks, state.run_id)]


async def _sync_trial(live: Live, scenario: str, rng: random.Random) -> bool:
    steps = script_for(scenario)
    triggers = set(
        rng.sample([i for i, step in enumerate(steps, 1) if step.type == "log"][:-1], 10)
    )
    run = await live.start(scenario)
    observations = []
    history = []
    async with asyncio.TaskGroup() as group, live.stream() as reference:
        await reference.ready()
        async for event in events(reference.blocks, run):
            history.append(event)
            if event.seq in triggers:
                observations.append(group.create_task(_synchronize(live, rng.randint(2, 9))))
    final = await snapshot(live.client)
    check_sequence(run, scenario, history)
    assert len(observations) == 10
    for task in observations:
        capture, suffix = task.result()
        verify_sync(capture, suffix, history, final)
    return any(task.result()[0].state.status == "running" for task in observations)


@pytest.mark.parametrize("scenario", CASES)
async def test_ac1_ac2_midrun_sync(apps: AppFactory, scenario: str) -> None:
    """R13、R15、R18、R20、AC1、AC2 各情境從十個固定種子的進度點執行三段同步。"""
    rng = random.Random(8971 + list(CASES).index(scenario))
    async with apps.open(interval=0.001) as live:
        for _ in range(3):
            if await _sync_trial(live, scenario, rng):
                return
    pytest.fail("三輪的同步快照都錯過執行中狀態")


async def _reset(stream: Stream, run: int) -> None:
    assert stream.status == 200
    headers_ok(stream.headers)
    await stream.ready()
    block = await anext(stream.blocks)
    fields = block.fields()
    assert fields.keys() == {"event", "data"}
    assert fields["event"] == "reset"
    assert json.loads(fields["data"]) == {"run_id": run}
    assert [block async for block in stream.blocks] == []


async def test_r15_midrun_default_until(apps: AppFactory) -> None:
    """R13、R15 在執行中兩次省略 until。用前後相同的快照核對當下的完整 log。"""
    async with apps.open(interval=0.5) as live:
        run = await live.start("success")
        async with live.stream() as stream, asyncio.timeout(10):
            await stream.ready()
            logs = []
            checked = 0
            async for event in events(stream.blocks, run):
                if event.type != "log":
                    continue
                logs.append(log_item(event))
                before = await snapshot(live.client)
                if before.last_seq != event.seq:
                    continue
                assert before.status == "running"
                response = await live.client.get("/install/logs", params={"run_id": run})
                assert response.status_code == 200
                after = await snapshot(live.client)
                if after.last_seq != before.last_seq:
                    continue
                assert after.status == "running"
                assert response.json() == {"run_id": run, "items": logs, "next_after": None}
                checked += 1
                if checked == 2:
                    return
            pytest.fail("未取得兩個能核對預設 until 的執行中進度點")


async def _uncounted(
    live: Live, query: str | None, status: int, baseline: int, reset_run: int | None = None
) -> None:
    counts: list[int] = []

    async def sample() -> None:
        # 在每次 ASGI send 返回前取樣。涵蓋回應標頭、空 body 與控制區塊。
        counts.append(await live.count())

    assert await live.count() == baseline
    async with asyncio.timeout(3.2), live.stream(query=query, on_send=sample) as stream:
        assert stream.status == status
        if reset_run is None:
            await stream.task
        else:
            await _reset(stream, reset_run)
    assert counts
    assert all(count == baseline for count in counts)
    assert await live.count() == baseline


async def test_r16_r20_excluded_responses(apps: AppFactory) -> None:
    """R16、R18-R20、AC9 重播仍計數。核對 reset 標頭及 404、204、reset 的零計數。"""
    sending, release = asyncio.Event(), asyncio.Event()

    async def hold_replay(chunk: bytes) -> None:
        sending.set()
        await release.wait()

    async with apps.open() as live:
        await _uncounted(live, None, 404, 0)
        run = await live.start("network_unreachable")
        history = await _history(live, run)
        assert history[-1].type == "run_finished"
        async with live.stream(gate=hold_replay) as replay:
            try:
                async with asyncio.timeout(3.2):
                    await sending.wait()
                await _uncounted(live, f"{run}.{history[-1].seq}", 204, 1)
                await _uncounted(live, f"{run + 1}.0", 200, 1, reset_run=run)
            finally:
                release.set()
            await replay.ready()
            assert [e async for e in events(replay.blocks, run)] == history
        assert await live.count() == 0


async def test_r18_ac6_cursor_and_reinstall(apps: AppFactory) -> None:
    """R14、R15、R18-R20、AC6、AC9 切換輪次和各種起點。核對優先序與 reset。"""
    async with apps.open(interval=0.06) as live:
        old = await live.start("network_unreachable")
        old_events = await _history(live, old)
        scenario = "checksum_mismatch"
        run = await live.start(scenario)
        assert run > old
        state = await snapshot(live.client)
        assert state.run_id == run
        assert state.scenario == scenario
        assert state.status == "running"
        await _uncounted(live, f"{run}.9999", 200, 0, reset_run=run)
        assert (await live.client.get("/install/logs", params={"run_id": old})).status_code == 409
        await _uncounted(live, f"{old}.{old_events[-1].seq}", 200, 0, reset_run=run)
        full = await _history(live, run)
        check_sequence(run, scenario, full)
        assert await snapshot(live.client) == folded(run, scenario, full)
        page = await live.client.get("/install/logs", params={"run_id": run})
        assert page.json()["items"] == [log_item(e) for e in full if e.type == "log"]
        async with asyncio.timeout(3.2), live.stream(header=f"{old}.0") as stream:
            await _reset(stream, run)
        for query, header, offset in (
            (f"{run}.2", f"{run}.5", 5),
            (f"{run}.2", "invalid", 2),
            (f" \t{run}.2\n ", None, 2),
            (None, "invalid", 0),
            (None, f"  {run}.2 ", 2),
            (f"{run}.0", None, 0),
        ):
            async with live.stream(query=query, header=header) as stream:
                assert stream.status == 200
                await stream.ready()
                assert [e async for e in events(stream.blocks, run)] == full[offset:]
        for invalid in ("", "1", "\uff11.\uff12", "1.2.3", "1.-1", f" {run}. 2 "):
            async with live.stream(query=invalid) as stream:
                assert stream.status == 422
        async with live.stream(query="invalid", header=f"{run}.2") as stream:
            assert stream.status == 422


@pytest.mark.parametrize("use_env", [True, False], ids=["env", "explicit"])
async def test_r16_r20_r22_r24_heartbeat_disconnect(
    apps: AppFactory, monkeypatch: pytest.MonkeyPatch, use_env: bool
) -> None:
    """R3、R16、R20、R22、R24、AC9 驗證就緒、跨資料事件的 ping 計時及退訂。"""
    heartbeat = 0.3
    monkeypatch.setenv("SSE_HEARTBEAT_SECONDS", str(heartbeat) if use_env else "10")
    async with apps.open(interval=1.5, heartbeat=None if use_env else heartbeat) as live:
        run = await live.start("success")
        async with live.stream() as stream:
            previous = (await stream.ready()).at
            assert await live.count() == 1
            pings = 0
            logs = 0
            async with asyncio.timeout(10):
                async for block in stream.blocks:
                    if block.raw == PING:
                        elapsed = block.at - previous
                        assert heartbeat <= elapsed <= heartbeat * 3 + 0.2
                        pings += 1
                    else:
                        if block.event(run).type == "log":
                            logs += 1
                        pings = 0
                    previous = block.at
                    if logs >= 2 and pings >= 2:
                        break
            assert logs >= 2
            assert pings >= 2
            async with asyncio.timeout(1 * 3 + 0.2):
                stream.disconnect()
                await stream.task
                assert await live.count() == 0


@pytest.mark.parametrize("use_env", [True, False], ids=["env", "explicit"])
async def test_r23_ac10_slow_subscriber(
    apps: AppFactory, monkeypatch: pytest.MonkeyPatch, use_env: bool
) -> None:
    """R3、R16、R18、R20、R23、AC10 永久阻塞單一 send。核對退訂、快訂閱者與補送。"""
    blocked, never = asyncio.Event(), asyncio.Event()
    armed = False

    async def gate(chunk: bytes) -> None:
        if armed:
            blocked.set()
            await never.wait()

    monkeypatch.setenv("SSE_SUBSCRIBER_QUEUE_SIZE", "6" if use_env else "1000")
    async with apps.open(interval=0.015, queue=None if use_env else 6) as live:
        run = await live.start("success")
        async with live.stream() as fast, live.stream(gate=gate) as slow:
            await fast.ready()
            await slow.ready()
            assert await live.count() == 2
            # 已送達的資料可能來自同一個 chunk。重連使用最後確實解析的 id。
            first = await anext(events(slow.blocks, run))
            assert first.seq == 1
            armed = True
            async with asyncio.timeout(4):
                await blocked.wait()
                await asyncio.wait({slow.task}, return_when=asyncio.ALL_COMPLETED)
                if not slow.task.cancelled():
                    slow.task.result()
                assert await live.count() == 1
            async with live.stream(header=f"{run}.{first.seq}") as resumed:
                await resumed.ready()
                actual = [e async for e in events(fast.blocks, run)]
                check_sequence(run, "success", actual)
                assert [e async for e in events(resumed.blocks, run)] == actual[1:]
        assert await live.count() == 0


async def _probe_cursor(
    live: Live, run: int, seq: int, ready: asyncio.Future[None]
) -> tuple[float, bool]:
    before = monotonic()
    async with live.stream(query=f"{run}.{seq}") as waiting:
        assert waiting.status == 200
        retry = await waiting.ready()
        ready.set_result(None)
        assert await live.count() == 2
        still_idle = (await snapshot(live.client)).last_seq == seq
        following = await anext(events(waiting.blocks, run))
        assert following.seq == seq + 1
        return retry.at - before, still_idle


async def test_r18_r20_r25_live_cursor(apps: AppFactory) -> None:
    """R7、R13、R15、R18、R20、R25 驗證廣播時已能補讀且等於目前 seq 時可立即訂閱。"""
    async with apps.open(interval=1.5) as live:
        run = await live.start("success")
        async with live.stream() as first:
            await first.ready()
            async for event in events(first.blocks, run):
                if event.type == "log":
                    break
            else:
                pytest.fail("未收到第一筆 log")
            logs = await live.client.get(
                "/install/logs", params={"run_id": run, "after": event.seq - 1, "until": event.seq}
            )
            assert logs.status_code == 200
            assert logs.json() == {"run_id": run, "items": [log_item(event)], "next_after": None}
            for _ in range(3):
                state = await snapshot(live.client)
                assert state.status == "running"
                assert state.last_seq >= event.seq
                ready: asyncio.Future[None] = asyncio.get_running_loop().create_future()
                stalled = False
                async with asyncio.TaskGroup() as group:
                    probe = group.create_task(_probe_cursor(live, run, state.last_seq, ready))
                    while not ready.done():
                        tick = monotonic()
                        await asyncio.wait({ready}, timeout=0.05)
                        if monotonic() - tick > 0.15:
                            stalled = True
                elapsed, still_idle = probe.result()
                if not still_idle:
                    continue
                if elapsed <= 0.2:
                    return
                # 逾時只能在獨立取樣也觀察到排程停頓時重試。
                assert stalled, f"閒置時等了 {elapsed:.3f} 秒才送出 retry"
            pytest.fail("三次訂閱都未取得可量測立即 retry 的閒置空窗")


async def test_r20_replay_live_overlap(apps: AppFactory) -> None:
    """R16、R20 控制第一個 send 返回的時機。強制在重播期間累積即時事件。"""
    sending, release = asyncio.Event(), asyncio.Event()

    async def hold_first(chunk: bytes) -> None:
        if not sending.is_set():
            sending.set()
            await release.wait()

    async with apps.open(interval=0.02) as live:
        run = await live.start("success")
        async with live.stream() as reference:
            await reference.ready()
            feed = events(reference.blocks, run)
            history = []
            async for event in feed:
                history.append(event)
                if event.type == "log" and event.data["line_no"] == 3:
                    break
            start = history[0].seq
            async with live.stream(query=f"{run}.{start}", gate=hold_first) as late:
                try:
                    async with asyncio.timeout(4):
                        await sending.wait()
                        assert await live.count() == 2
                        boundary = (await snapshot(live.client)).last_seq
                        async for event in feed:
                            history.append(event)
                            if event.seq >= boundary + 3:
                                break
                        assert history[-1].seq >= boundary + 3
                finally:
                    release.set()
                await late.ready()
                received = [e async for e in events(late.blocks, run)]
            history.extend([e async for e in feed])
            check_sequence(run, "success", history)
            assert received == history[start:]
