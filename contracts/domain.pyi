"""Contract for ``app/domain.py`` (SPEC v1.1.1).

Pure logic only: no FastAPI imports, no I/O. Tests may import exactly the names in ``__all__``.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Final, Literal, TypeAlias

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

JsonValue: TypeAlias = (
    str | int | float | bool | list["JsonValue"] | dict[str, "JsonValue"] | None
)
EventType: TypeAlias = Literal[
    "run_started",
    "stage_started",
    "stage_succeeded",
    "stage_failed",
    "task_started",
    "task_succeeded",
    "task_failed",
    "log",
    "run_finished",
]
Status: TypeAlias = Literal["pending", "running", "succeeded", "failed"]
RunStatus: TypeAlias = Literal["running", "succeeded", "failed"]
LogLevel: TypeAlias = Literal["info", "error"]

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
    """R6: one scripted event, without ``seq``, without the log ``ts`` and without ``run_id``.

    The ``run_started`` step's ``data`` is ``{"scenario": <id>}`` only.
    """

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

PLAN: Final[tuple[StageDef, ...]]
"""R4: the fixed install plan, in order."""

SCENARIOS: Final[Mapping[str, Scenario]]
"""R5: scenarios keyed by id; iteration order equals the R5 table order."""

RETRY_BLOCK: Final[str]
"""R20: exactly ``"retry: 3000\\n\\n"``."""

PING_COMMENT: Final[str]
"""R22: exactly ``": ping\\n\\n"``."""

def format_event_id(run_id: int, seq: int) -> str:
    """R9: ``(3, 57) -> "3.57"``."""

def parse_event_id(raw: str | None) -> tuple[int, int] | None:
    """R9: strip, then require ``^[0-9]+\\.[0-9]+$``; ``"3.57" -> (3, 57)``.

    Returns None for None or any invalid input; never raises.
    """

def script_for(scenario_id: str) -> tuple[ScriptStep, ...]:
    """R6: the full deterministic event script of a scenario.

    The script has no run id: the first step is ``run_started`` with ``data`` equal to
    ``{"scenario": scenario_id}``. The persisted/streamed ``run_started`` event additionally
    carries ``run_id`` (R8), added when the run is written.

    Raises KeyError for an unknown scenario id.
    """

def initial_snapshot(run_id: int, scenario_id: str) -> Snapshot:
    """R10: state before any event: run ``running``, ``last_seq`` 0, everything ``pending``.

    Raises KeyError for an unknown scenario id.
    """

def apply_event(state: Snapshot, event: Event) -> Snapshot:
    """R10: return the new snapshot after applying one event; ``state`` is not modified.

    Raises ValueError if ``event.run_id != state.run_id``, ``event.seq != state.last_seq + 1``,
    the transition is not allowed by the state machine, or any other case listed in SPEC R10:
    the first event is not ``run_started`` or ``run_started`` appears later; any event after
    ``run_finished``; an unknown stage id; a ``task_*``/``log`` event whose
    ``(stage_id, task_id)`` pair is not in the plan (R4), including a task id that exists but
    belongs to a different stage; a ``task_*``/``log`` event whose stage is not ``running``; a
    ``log`` event whose task is not ``running``; ``data`` missing a field or having a field of
    the wrong type.

    Not required (tests must not assert either way): checking that all tasks of a stage are
    finished when the stage finishes; checking that ``run_started``'s ``data.run_id`` or
    ``data.scenario`` matches the snapshot or ``event.run_id``; enforcing that stages/tasks
    start in plan order, or that only one stage/task is ``running`` at a time.
    """

def format_event(event: Event) -> str:
    """R19: one SSE block ending with a blank line.

    Fields: ``id: <run_id>.<seq>``, ``event: <type>``, ``data: <one-line JSON>``.
    """
