"""Pydantic request/response models (contracts/openapi.yaml)."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain import SCENARIOS

type Status = Literal["pending", "running", "succeeded", "failed"]
# Plain aliases (not PEP 695 ``type``) so pydantic inlines the constraints instead of
# emitting separate ``$ref`` components.
_Positive = Annotated[int, Field(ge=1)]
_NonEmpty = Annotated[str, Field(min_length=1)]


class _Out(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlanTask(_Out):
    """R11."""

    id: str
    name: str


class PlanStage(_Out):
    """R11."""

    id: str
    name: str
    tasks: list[PlanTask]


class Plan(_Out):
    """R11."""

    stages: list[PlanStage]


class ScenarioInfo(_Out):
    """R12."""

    id: str
    label: str
    fail_task_id: str | None


class TaskError(_Out):
    """R13."""

    error_code: _NonEmpty
    message: _NonEmpty
    hint: _NonEmpty


class TaskOut(_Out):
    """R13."""

    id: str
    name: str
    status: Status
    error: TaskError | None


class StageOut(_Out):
    """R13."""

    id: str
    name: str
    status: Status
    tasks: list[TaskOut]


class Snapshot(_Out):
    """R13."""

    run_id: _Positive
    scenario: str
    status: Literal["running", "succeeded", "failed"]
    last_seq: _Positive
    stages: list[StageOut]


class InstallRequest(BaseModel):
    """R14: extra fields are ignored."""

    scenario: str

    @field_validator("scenario")
    @classmethod
    def _known_scenario(cls, value: str) -> str:
        if value not in SCENARIOS:
            raise ValueError(f"unknown scenario {value!r}")
        return value


class InstallStarted(_Out):
    """R14."""

    run_id: _Positive
    scenario: str


class LogItem(_Out):
    """R15."""

    seq: _Positive
    stage_id: str
    task_id: str
    line_no: _Positive
    level: Literal["info", "error"]
    text: str
    ts: Annotated[str, Field(json_schema_extra={"format": "date-time"})]


class LogPageOut(_Out):
    """R15."""

    run_id: int
    items: list[LogItem]
    next_after: int | None


class Stats(_Out):
    """R16."""

    subscribers: Annotated[int, Field(ge=0)]


class Health(_Out):
    """R17."""

    status: Literal["ok"]
