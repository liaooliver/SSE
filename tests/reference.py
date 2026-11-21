"""R4、R5 表格的獨立期望值與公開介面的交叉比對。"""

from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Final, TypeGuard

import pytest

from .public_api import (
    Event,
    EventType,
    JsonValue,
    Snapshot,
    apply_event,
    initial_snapshot,
    script_for,
)

PLAN_ROWS: Final = (
    (
        "prepare",
        "準備環境",
        (
            ("check_os", "檢查作業系統", 8),
            ("check_disk", "檢查磁碟空間", 6),
            ("check_deps", "檢查相依套件", 12),
        ),
    ),
    (
        "download",
        "下載套件",
        (
            ("fetch_manifest", "取得套件清單", 6),
            ("download_packages", "下載套件", 30),
            ("verify_checksum", "驗證雜湊", 10),
        ),
    ),
    (
        "install",
        "安裝",
        (
            ("extract", "解壓縮", 20),
            ("copy_files", "複製檔案", 40),
            ("register", "註冊元件", 8),
        ),
    ),
    (
        "configure",
        "設定",
        (
            ("write_config", "寫入設定", 10),
            ("set_permissions", "設定權限", 6),
            ("start_service", "啟動服務", 12),
        ),
    ),
)


@dataclass(frozen=True, slots=True)
class Case:
    label: str
    task: str | None = None
    lines: int | None = None
    code: str | None = None
    message: str | None = None
    hint: str | None = None


CASES: Final = {
    "success": Case("全部成功"),
    "network_unreachable": Case(
        "無法連線到套件伺服器",
        "fetch_manifest",
        0,
        "E_NETWORK",
        "無法連線到套件伺服器 packages.example.com:443",
        "請檢查網路、Proxy 與防火牆設定後重新安裝",
    ),
    "dependency_missing": Case(
        "缺少相依套件",
        "check_deps",
        7,
        "E_DEPENDENCY",
        "缺少相依套件 libssl（需要 >= 3.0）",  # noqa: RUF001  # R5 的比對值保留規格原文
        "請先安裝 libssl 3.0 以上版本後重新安裝",
    ),
    "checksum_mismatch": Case(
        "套件雜湊值不符",
        "verify_checksum",
        9,
        "E_CHECKSUM",
        "套件 core-2.4.1.pkg 的 SHA-256 雜湊值不符",
        "請清除下載快取後重新下載，或改用其他鏡像站",  # noqa: RUF001  # R5 的比對值保留規格原文
    ),
    "disk_full": Case(
        "磁碟空間不足",
        "copy_files",
        23,
        "E_DISK_FULL",
        "磁碟空間不足，/opt 剩餘 0 MB",  # noqa: RUF001  # R5 的比對值保留規格原文
        "請釋放至少 2 GB 空間後重新安裝",
    ),
    "permission_denied": Case(
        "權限不足",
        "set_permissions",
        3,
        "E_PERMISSION",
        "無法寫入 /etc/app：權限不足",  # noqa: RUF001  # R5 的比對值保留規格原文
        "請以系統管理員權限執行安裝",
    ),
    "service_timeout": Case(
        "服務啟動逾時",
        "start_service",
        12,
        "E_SERVICE_TIMEOUT",
        "服務 app-daemon 在 30 秒內沒有回應",
        "請查看服務 log，並確認連接埠 8443 沒有被佔用",  # noqa: RUF001  # R5 的比對值保留規格原文
    ),
}

STAMP: Final = "2026-11-20T01:02:03.000004+00:00"


def plan_json() -> dict[str, object]:
    """R11 的計畫投影不含劇本行數。"""
    return {
        "stages": [
            {
                "id": sid,
                "name": name,
                "tasks": [{"id": tid, "name": title} for tid, title, _ in tasks],
            }
            for sid, name, tasks in PLAN_ROWS
        ]
    }


def utc_stamp(raw: object) -> datetime:
    """R7 的公開時間戳須以 UTC 表示。"""
    assert isinstance(raw, str)
    assert raw.endswith(("Z", "+00:00"))
    stamp = datetime.fromisoformat(raw)
    assert stamp.utcoffset() == timedelta(0)
    return stamp


def snapshot_json(state: Snapshot) -> dict[str, object]:
    """R13 的 JSON 將 dataclass 內的 tuple 呈現為陣列。"""
    result = asdict(state)
    result["stages"] = [dict(asdict(s), tasks=[asdict(t) for t in s.tasks]) for s in state.stages]
    return result


def folded(run: int, scenario: str, events: Sequence[Event]) -> Snapshot:
    """R10 從公開初始狀態依序歸約。"""
    state = initial_snapshot(run, scenario)
    for event in events:
        state = apply_event(state, event)
    return state


def check_sequence(run: int, scenario: str, actual: Sequence[Event]) -> None:
    """AC4 逐筆比對完整劇本。只有落盤時加入的欄位需要另外核對。"""
    script = script_for(scenario)
    assert [event.seq for event in actual] == list(range(1, len(script) + 1))
    for event, step in zip(actual, script, strict=True):
        assert event.run_id == run
        assert event.type == step.type
        data = dict(event.data)
        if event.type == "run_started":
            assert type(data["run_id"]) is int
            assert data.pop("run_id") == run
        elif event.type == "log":
            utc_stamp(data.pop("ts"))
        assert data == step.data


def _event_type(kind: str) -> TypeGuard[EventType]:
    return kind in {
        "run_started",
        "stage_started",
        "stage_succeeded",
        "stage_failed",
        "task_started",
        "task_succeeded",
        "task_failed",
        "log",
        "run_finished",
    }


def wire_event(run: int, seq: int, kind: str, data: Mapping[str, JsonValue]) -> Event:
    """R8 非 log 未公開 ts。歸約時使用固定 UTC 值。"""
    assert _event_type(kind)
    ts = data.get("ts", STAMP)
    assert isinstance(ts, str)
    if kind == "run_started":
        assert type(data["run_id"]) is int
        assert data["run_id"] == run
    if kind == "log":
        assert type(data["line_no"]) is int
        utc_stamp(data["ts"])
    return Event(run, seq, kind, data, ts)


@contextmanager
def contract_value_error() -> Iterator[None]:
    """R3、R10 的合約只規定例外型別。"""
    with pytest.raises(ValueError):  # noqa: PT011  # R3、R10 允許實作自訂錯誤訊息
        yield
