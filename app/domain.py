"""Pure install-progress logic (SPEC v1.0 R4-R10, R19, R20, R22).

No FastAPI imports and no I/O; the public names match ``contracts/domain.pyi``.
"""

import json
import re
from collections.abc import Mapping
from dataclasses import dataclass, replace
from types import MappingProxyType
from typing import Final, Literal

__all__ = [
    "PING_COMMENT",
    "PLAN",
    "RETRY_BLOCK",
    "SCENARIOS",
    "Event",
    "EventType",
    "JsonValue",
    "LogLevel",
    "RunStatus",
    "Scenario",
    "ScriptStep",
    "Snapshot",
    "StageDef",
    "StageState",
    "Status",
    "TaskDef",
    "TaskError",
    "TaskState",
    "apply_event",
    "format_event",
    "format_event_id",
    "initial_snapshot",
    "parse_event_id",
    "script_for",
]

# Plain runtime unions (not PEP 695 ``type`` statements) so that ``mypy.stubtest`` can verify
# them against contracts/domain.pyi; stubtest only accepts a runtime Union for a union alias.
JsonValue = str | int | float | bool | list["JsonValue"] | dict[str, "JsonValue"] | None
EventType = (
    Literal["run_started"]
    | Literal["stage_started"]
    | Literal["stage_succeeded"]
    | Literal["stage_failed"]
    | Literal["task_started"]
    | Literal["task_succeeded"]
    | Literal["task_failed"]
    | Literal["log"]
    | Literal["run_finished"]
)
Status = Literal["pending"] | Literal["running"] | Literal["succeeded"] | Literal["failed"]
RunStatus = Literal["running"] | Literal["succeeded"] | Literal["failed"]
LogLevel = Literal["info"] | Literal["error"]


@dataclass(frozen=True, slots=True)
class TaskDef:
    """R4: one task of the fixed plan."""

    id: str
    name: str
    log_lines: int


@dataclass(frozen=True, slots=True)
class StageDef:
    """R4: one stage of the fixed plan."""

    id: str
    name: str
    tasks: tuple[TaskDef, ...]


@dataclass(frozen=True, slots=True)
class Scenario:
    """R5: a simulation scenario. All failure fields are None for ``success``."""

    id: str
    label: str
    fail_task_id: str | None
    fail_after_lines: int | None
    error_code: str | None
    message: str | None
    hint: str | None


@dataclass(frozen=True, slots=True)
class ScriptStep:
    """R6: one scripted event, without ``seq`` and without the log ``ts``."""

    type: EventType
    data: Mapping[str, JsonValue]


@dataclass(frozen=True, slots=True)
class Event:
    """R7/R8: a persisted event. For ``log`` events ``data`` includes ``ts``."""

    run_id: int
    seq: int
    type: EventType
    data: Mapping[str, JsonValue]
    ts: str


@dataclass(frozen=True, slots=True)
class TaskError:
    """R13: failure details of a task."""

    error_code: str
    message: str
    hint: str


@dataclass(frozen=True, slots=True)
class TaskState:
    """R13: task part of the snapshot."""

    id: str
    name: str
    status: Status
    error: TaskError | None


@dataclass(frozen=True, slots=True)
class StageState:
    """R13: stage part of the snapshot."""

    id: str
    name: str
    status: Status
    tasks: tuple[TaskState, ...]


@dataclass(frozen=True, slots=True)
class Snapshot:
    """R13: full state of one run after applying events ``1..last_seq``."""

    run_id: int
    scenario: str
    status: RunStatus
    last_seq: int
    stages: tuple[StageState, ...]


def _stage(stage_id: str, name: str, *tasks: tuple[str, str, int]) -> StageDef:
    return StageDef(stage_id, name, tuple(TaskDef(t_id, t_name, n) for t_id, t_name, n in tasks))


PLAN: Final[tuple[StageDef, ...]] = (
    _stage(
        "prepare",
        "準備環境",
        ("check_os", "檢查作業系統", 8),
        ("check_disk", "檢查磁碟空間", 6),
        ("check_deps", "檢查相依套件", 12),
    ),
    _stage(
        "download",
        "下載套件",
        ("fetch_manifest", "取得套件清單", 6),
        ("download_packages", "下載套件", 30),
        ("verify_checksum", "驗證雜湊", 10),
    ),
    _stage(
        "install",
        "安裝",
        ("extract", "解壓縮", 20),
        ("copy_files", "複製檔案", 40),
        ("register", "註冊元件", 8),
    ),
    _stage(
        "configure",
        "設定",
        ("write_config", "寫入設定", 10),
        ("set_permissions", "設定權限", 6),
        ("start_service", "啟動服務", 12),
    ),
)
"""R4: the fixed install plan, in order."""

_SCENARIO_LIST: Final[tuple[Scenario, ...]] = (
    Scenario("success", "全部成功", None, None, None, None, None),
    Scenario(
        "network_unreachable",
        "無法連線到套件伺服器",
        "fetch_manifest",
        0,
        "E_NETWORK",
        "無法連線到套件伺服器 packages.example.com:443",
        "請檢查網路、Proxy 與防火牆設定後重新安裝",
    ),
    Scenario(
        "dependency_missing",
        "缺少相依套件",
        "check_deps",
        7,
        "E_DEPENDENCY",
        "缺少相依套件 libssl（需要 >= 3.0）",  # noqa: RUF001  SPEC R5 原文的全形標點
        "請先安裝 libssl 3.0 以上版本後重新安裝",
    ),
    Scenario(
        "checksum_mismatch",
        "套件雜湊值不符",
        "verify_checksum",
        9,
        "E_CHECKSUM",
        "套件 core-2.4.1.pkg 的 SHA-256 雜湊值不符",
        "請清除下載快取後重新下載，或改用其他鏡像站",  # noqa: RUF001  SPEC R5 原文的全形標點
    ),
    Scenario(
        "disk_full",
        "磁碟空間不足",
        "copy_files",
        23,
        "E_DISK_FULL",
        "磁碟空間不足，/opt 剩餘 0 MB",  # noqa: RUF001  SPEC R5 原文的全形標點
        "請釋放至少 2 GB 空間後重新安裝",
    ),
    Scenario(
        "permission_denied",
        "權限不足",
        "set_permissions",
        3,
        "E_PERMISSION",
        "無法寫入 /etc/app：權限不足",  # noqa: RUF001  SPEC R5 原文的全形標點
        "請以系統管理員權限執行安裝",
    ),
    Scenario(
        "service_timeout",
        "服務啟動逾時",
        "start_service",
        12,
        "E_SERVICE_TIMEOUT",
        "服務 app-daemon 在 30 秒內沒有回應",
        "請查看服務 log，並確認連接埠 8443 沒有被佔用",  # noqa: RUF001  SPEC R5 原文的全形標點
    ),
)

SCENARIOS: Final[Mapping[str, Scenario]] = MappingProxyType({s.id: s for s in _SCENARIO_LIST})
"""R5: scenarios keyed by id; iteration order equals the R5 table order."""

RETRY_BLOCK: Final[str] = "retry: 3000\n\n"
"""R20: exactly ``"retry: 3000\\n\\n"``."""

PING_COMMENT: Final[str] = ": ping\n\n"
"""R22: exactly ``": ping\\n\\n"``."""

_EVENT_ID_RE: Final = re.compile(r"[0-9]+\.[0-9]+")


def format_event_id(run_id: int, seq: int) -> str:
    """R9: ``(3, 57) -> "3.57"``."""
    return f"{run_id}.{seq}"


def parse_event_id(raw: str | None) -> tuple[int, int] | None:
    """R9: strip, then require ``^[0-9]+\\.[0-9]+$``; ``"3.57" -> (3, 57)``.

    Returns None for None or any invalid input; never raises.
    """
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    if _EVENT_ID_RE.fullmatch(text) is None:
        return None
    run_part, seq_part = text.split(".")
    return int(run_part), int(seq_part)


def _log_text(task: TaskDef, line_no: int) -> str:
    return f"[{task.id}] ({line_no}/{task.log_lines}) {task.name} - 處理第 {line_no} 項"


def script_for(scenario_id: str) -> tuple[ScriptStep, ...]:
    """R6: the full deterministic event script of a scenario.

    The ``run_started`` step carries only ``scenario``; the ``run_id`` is assigned when the
    run is persisted. Raises KeyError for an unknown scenario id.
    """
    scenario = SCENARIOS[scenario_id]
    steps: list[ScriptStep] = [ScriptStep("run_started", {"scenario": scenario.id})]
    for stage in PLAN:
        steps.append(ScriptStep("stage_started", {"stage_id": stage.id}))
        for task in stage.tasks:
            ids: dict[str, JsonValue] = {"stage_id": stage.id, "task_id": task.id}
            steps.append(ScriptStep("task_started", dict(ids)))
            if task.id == scenario.fail_task_id:
                steps.extend(_failure_steps(scenario, task, ids))
                steps.append(ScriptStep("stage_failed", {"stage_id": stage.id}))
                steps.append(ScriptStep("run_finished", {"result": "failed"}))
                return tuple(steps)
            steps.extend(_log_step(ids, n, "info", _log_text(task, n)) for n in _lines(task))
            steps.append(ScriptStep("task_succeeded", dict(ids)))
        steps.append(ScriptStep("stage_succeeded", {"stage_id": stage.id}))
    steps.append(ScriptStep("run_finished", {"result": "succeeded"}))
    return tuple(steps)


def _lines(task: TaskDef) -> range:
    return range(1, task.log_lines + 1)


def _log_step(ids: dict[str, JsonValue], line_no: int, level: LogLevel, text: str) -> ScriptStep:
    return ScriptStep("log", {**ids, "line_no": line_no, "level": level, "text": text})


def _failure_steps(
    scenario: Scenario, task: TaskDef, ids: dict[str, JsonValue]
) -> list[ScriptStep]:
    ok_lines = scenario.fail_after_lines or 0
    message = scenario.message or ""
    steps = [_log_step(ids, n, "info", _log_text(task, n)) for n in range(1, ok_lines + 1)]
    steps.append(_log_step(ids, ok_lines + 1, "error", message))
    failure: dict[str, JsonValue] = {
        **ids,
        "error_code": scenario.error_code or "",
        "message": message,
        "hint": scenario.hint or "",
    }
    steps.append(ScriptStep("task_failed", failure))
    return steps


def initial_snapshot(run_id: int, scenario_id: str) -> Snapshot:
    """R10: state before any event: run ``running``, ``last_seq`` 0, everything ``pending``.

    Raises KeyError for an unknown scenario id.
    """
    scenario = SCENARIOS[scenario_id]
    stages = tuple(
        StageState(
            stage.id,
            stage.name,
            "pending",
            tuple(TaskState(task.id, task.name, "pending", None) for task in stage.tasks),
        )
        for stage in PLAN
    )
    return Snapshot(run_id, scenario.id, "running", 0, stages)


def _str_field(data: Mapping[str, JsonValue], key: str) -> str:
    value = data.get(key)
    if not isinstance(value, str):
        raise ValueError(f"event data field {key!r} must be a string")
    return value


def _find_stage(state: Snapshot, stage_id: str) -> int:
    for index, stage in enumerate(state.stages):
        if stage.id == stage_id:
            return index
    raise ValueError(f"unknown stage {stage_id!r}")


def _find_task(stage: StageState, task_id: str) -> int:
    for index, task in enumerate(stage.tasks):
        if task.id == task_id:
            return index
    raise ValueError(f"unknown task {task_id!r} in stage {stage.id!r}")


def _require(current: Status, expected: Status, what: str) -> None:
    if current != expected:
        raise ValueError(f"{what} is {current!r}, expected {expected!r}")


def _set_stage(state: Snapshot, index: int, stage: StageState) -> tuple[StageState, ...]:
    return (*state.stages[:index], stage, *state.stages[index + 1 :])


def _apply_stage_event(state: Snapshot, event: Event) -> tuple[StageState, ...]:
    index = _find_stage(state, _str_field(event.data, "stage_id"))
    stage = state.stages[index]
    if event.type == "stage_started":
        _require(stage.status, "pending", f"stage {stage.id}")
        return _set_stage(state, index, replace(stage, status="running"))
    _require(stage.status, "running", f"stage {stage.id}")
    new_status: Status = "succeeded" if event.type == "stage_succeeded" else "failed"
    return _set_stage(state, index, replace(stage, status=new_status))


def _apply_task_event(state: Snapshot, event: Event) -> tuple[StageState, ...]:
    stage_index = _find_stage(state, _str_field(event.data, "stage_id"))
    stage = state.stages[stage_index]
    _require(stage.status, "running", f"stage {stage.id}")
    task_index = _find_task(stage, _str_field(event.data, "task_id"))
    task = stage.tasks[task_index]
    if event.type == "task_started":
        _require(task.status, "pending", f"task {task.id}")
        new_task = replace(task, status="running")
    else:
        _require(task.status, "running", f"task {task.id}")
        if event.type == "log":
            _validate_log(event.data)
            return state.stages
        if event.type == "task_succeeded":
            new_task = replace(task, status="succeeded")
        else:
            error = TaskError(
                _str_field(event.data, "error_code"),
                _str_field(event.data, "message"),
                _str_field(event.data, "hint"),
            )
            new_task = replace(task, status="failed", error=error)
    tasks = (*stage.tasks[:task_index], new_task, *stage.tasks[task_index + 1 :])
    return _set_stage(state, stage_index, replace(stage, tasks=tasks))


def _validate_log(data: Mapping[str, JsonValue]) -> None:
    line_no = data.get("line_no")
    if not isinstance(line_no, int) or isinstance(line_no, bool) or line_no < 1:
        raise ValueError("log line_no must be a positive integer")


_FieldKind = Literal["str", "int", "level", "result"]

_STAGE_FIELDS: Final[Mapping[str, _FieldKind]] = {"stage_id": "str"}
_TASK_FIELDS: Final[Mapping[str, _FieldKind]] = {"stage_id": "str", "task_id": "str"}

_DATA_SCHEMA: Final[Mapping[EventType, Mapping[str, _FieldKind]]] = MappingProxyType(
    {
        "run_started": {"run_id": "int", "scenario": "str"},
        "stage_started": _STAGE_FIELDS,
        "stage_succeeded": _STAGE_FIELDS,
        "stage_failed": _STAGE_FIELDS,
        "task_started": _TASK_FIELDS,
        "task_succeeded": _TASK_FIELDS,
        "log": {**_TASK_FIELDS, "line_no": "int", "level": "level", "text": "str", "ts": "str"},
        "task_failed": {**_TASK_FIELDS, "error_code": "str", "message": "str", "hint": "str"},
        "run_finished": {"result": "result"},
    }
)
"""R8: required ``data`` fields and their types for every event type."""


def _field_ok(value: JsonValue, kind: _FieldKind) -> bool:
    if kind == "str":
        return isinstance(value, str)
    if kind == "int":
        return isinstance(value, int) and not isinstance(value, bool)
    if kind == "level":
        return value in ("info", "error")
    return value in ("succeeded", "failed")


def _validate_data(event: Event) -> None:
    """R10 item 9: every R8 field must be present with the right type; extra fields are ignored."""
    schema = _DATA_SCHEMA.get(event.type)
    if schema is None:
        raise ValueError(f"unknown event type {event.type!r}")
    for key, kind in schema.items():
        if key not in event.data:
            raise ValueError(f"{event.type} data is missing field {key!r}")
        if not _field_ok(event.data[key], kind):
            raise ValueError(f"{event.type} data field {key!r} must be {kind}")


def apply_event(state: Snapshot, event: Event) -> Snapshot:
    """R10: return the new snapshot after applying one event; ``state`` is not modified.

    Raises ValueError if ``event.run_id != state.run_id``, ``event.seq != state.last_seq + 1``,
    a ``data`` field required by R8 is missing or has the wrong type, or the transition is not
    allowed by the state machine. Extra ``data`` fields are ignored.
    """
    if event.run_id != state.run_id:
        raise ValueError(f"event run_id {event.run_id} != snapshot run_id {state.run_id}")
    if event.seq != state.last_seq + 1:
        raise ValueError(f"event seq {event.seq} != last_seq + 1 ({state.last_seq + 1})")
    _validate_data(event)
    if event.type == "run_started":
        if state.last_seq != 0:
            raise ValueError("run_started must be the first event")
        return replace(state, last_seq=event.seq)
    if state.last_seq == 0:
        raise ValueError("the first event must be run_started")
    if state.status != "running":
        raise ValueError(f"run is already {state.status!r}")
    if event.type == "run_finished":
        final: RunStatus = "succeeded" if event.data["result"] == "succeeded" else "failed"
        return replace(state, status=final, last_seq=event.seq)
    if event.type in ("stage_started", "stage_succeeded", "stage_failed"):
        stages = _apply_stage_event(state, event)
    else:
        stages = _apply_task_event(state, event)
    return replace(state, stages=stages, last_seq=event.seq)


def format_event(event: Event) -> str:
    """R19: one SSE block ending with a blank line.

    Fields: ``id: <run_id>.<seq>``, ``event: <type>``, ``data: <one-line JSON>``.
    """
    payload = json.dumps(dict(event.data), ensure_ascii=False, separators=(",", ":"))
    return (
        f"id: {format_event_id(event.run_id, event.seq)}\nevent: {event.type}\ndata: {payload}\n\n"
    )
