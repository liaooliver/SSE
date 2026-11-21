"""AC11 真實 TCP 的二十個訂閱者和可公開計時的 log。"""

import asyncio
import math
from dataclasses import dataclass
from time import time

import pytest

from .public_api import Event
from .reference import check_sequence, utc_stamp
from .server import ServerFactory
from .wire import PING, RETRY, blocks, timed_bytes


@dataclass(slots=True)
class _Observation:
    ready: float
    history: list[Event]
    parsed_logs: dict[int, float]


@pytest.mark.perf
async def test_ac11_log_latency(servers: ServerFactory) -> None:
    """AC11、R20、R23 量測共同就緒後每筆 log 被最後一位訂閱者解析完成的延遲。"""
    async with servers.launch(interval=0.005) as server:
        client = server.client
        response = await client.post("/install", json={"scenario": "success"})
        assert response.status_code == 202
        run = response.json()["run_id"]

        async def observe() -> _Observation:
            async with client.stream("GET", "/install/events") as response:
                assert response.status_code == 200
                stream = blocks(timed_bytes(response.aiter_bytes()))
                assert (await anext(stream)).raw == RETRY
                observation = _Observation(time(), [], {})
                async for block in stream:
                    if block.raw == PING:
                        continue
                    event = block.event(run)
                    parsed = time()
                    observation.history.append(event)
                    if event.type == "log":
                        observation.parsed_logs[event.seq] = parsed
                return observation

        results = await asyncio.gather(*(observe() for _ in range(20)))
        ready = max(result.ready for result in results)
        baseline = results[0].history
        check_sequence(run, "success", baseline)
        assert len(baseline) == 202
        for result in results:
            assert result.history == baseline
            assert len(result.parsed_logs) == 168

        latencies = []
        for event in baseline:
            if event.type != "log":
                continue
            timestamp = utc_stamp(event.data["ts"]).timestamp()
            if timestamp > ready:
                delay = max(result.parsed_logs[event.seq] for result in results) - timestamp
                assert delay >= 0
                latencies.append(delay)
        assert latencies, "二十位訂閱者全部就緒後沒有可計時的 log"
        latencies.sort()
        p95 = latencies[math.ceil(len(latencies) * 0.95) - 1]
        assert p95 < 0.2, f"共同就緒後 {len(latencies)} 筆 log 的 p95 為 {p95 * 1000:.1f} ms"
