"""R1、R17、R24 透過子程序和真實 TCP 驅動單一 worker。"""

import asyncio
import os
import socket
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path

import httpx


@dataclass(slots=True)
class Server:
    process: asyncio.subprocess.Process
    client: httpx.AsyncClient


@dataclass(frozen=True, slots=True)
class ServerFactory:
    path: Path

    @asynccontextmanager
    async def launch(self, interval: float, heartbeat: float = 15.0) -> AsyncIterator[Server]:
        """R1、R3、R17 交由核心分配埠號。保留 socket 至子程序接手。"""
        env = {
            **os.environ,
            "SSE_DB_PATH": str(self.path),
            "SSE_LOG_INTERVAL": str(interval),
            "SSE_HEARTBEAT_SECONDS": str(heartbeat),
            "SSE_SUBSCRIBER_QUEUE_SIZE": "1000",
        }
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
            fd = listener.fileno()
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--workers",
                "1",
                "--fd",
                str(fd),
                "--no-access-log",
                "--log-level",
                "warning",
                pass_fds=(fd,),
                cwd=Path(__file__).parents[1],
                env=env,
            )
        try:
            async with httpx.AsyncClient(
                base_url=f"http://127.0.0.1:{port}", trust_env=False, timeout=8.0
            ) as client:
                async with asyncio.timeout(8):
                    while True:
                        assert process.returncode is None, "uvicorn 已在就緒前退出"
                        try:
                            health = await client.get("/health")
                        except httpx.TransportError:
                            continue
                        assert health.status_code == 200
                        assert health.json() == {"status": "ok"}
                        break
                yield Server(process, client)
        finally:
            if process.returncode is None:
                process.terminate()
                try:
                    async with asyncio.timeout(3.2):
                        await process.wait()
                except TimeoutError:
                    if process.returncode is None:
                        process.kill()
            async with asyncio.timeout(5):
                await process.wait()
