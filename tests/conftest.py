"""R2、R3、R17 共用的應用程式和真實伺服器 fixture。"""

from pathlib import Path

import pytest

from .asgi import AppFactory
from .server import ServerFactory


@pytest.fixture(autouse=True)
def settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """R3 隔離呼叫端環境設定與資料庫路徑。"""
    monkeypatch.setenv("SSE_DB_PATH", str(tmp_path / "install.db"))
    for key in ("SSE_LOG_INTERVAL", "SSE_HEARTBEAT_SECONDS", "SSE_SUBSCRIBER_QUEUE_SIZE"):
        monkeypatch.delenv(key, raising=False)


@pytest.fixture
def apps(tmp_path: Path) -> AppFactory:
    """R2 每個測試使用自己的資料庫路徑。"""
    return AppFactory(tmp_path / "install.db")


@pytest.fixture
def servers(tmp_path: Path) -> ServerFactory:
    """AC9 僅同一測試的重啟共用路徑。"""
    return ServerFactory(tmp_path / "install.db")
