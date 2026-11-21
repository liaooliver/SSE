"""HTTP endpoints for the install run (R11-R18)."""

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status

from app.domain import PLAN, SCENARIOS, parse_event_id
from app.domain import Snapshot as RunSnapshot
from app.runtime import Runtime
from app.schemas import (
    InstallRequest,
    InstallStarted,
    LogItem,
    LogPageOut,
    Plan,
    PlanStage,
    PlanTask,
    ScenarioInfo,
    Snapshot,
    StageOut,
    TaskError,
    TaskOut,
)
from app.sse import EventStreamResponse, event_stream, reset_stream

router = APIRouter()

_NO_RUN = "No run has been started on this database"


def get_runtime(request: Request) -> Runtime:
    """Dependency: the runtime created by the lifespan."""
    runtime: Runtime = request.app.state.runtime
    return runtime


RuntimeDep = Annotated[Runtime, Depends(get_runtime)]


@router.get("/install/plan")
async def get_plan() -> Plan:
    """R11: the fixed plan in R4 order."""
    return Plan(
        stages=[
            PlanStage(
                id=stage.id,
                name=stage.name,
                tasks=[PlanTask(id=task.id, name=task.name) for task in stage.tasks],
            )
            for stage in PLAN
        ]
    )


@router.get("/install/scenarios")
async def list_scenarios() -> list[ScenarioInfo]:
    """R12: scenarios in R5 order."""
    return [
        ScenarioInfo(id=s.id, label=s.label, fail_task_id=s.fail_task_id)
        for s in SCENARIOS.values()
    ]


def _snapshot_out(state: RunSnapshot) -> Snapshot:
    return Snapshot(
        run_id=state.run_id,
        scenario=state.scenario,
        status=state.status,
        last_seq=state.last_seq,
        stages=[
            StageOut(
                id=stage.id,
                name=stage.name,
                status=stage.status,
                tasks=[
                    TaskOut(
                        id=task.id,
                        name=task.name,
                        status=task.status,
                        error=None
                        if task.error is None
                        else TaskError(
                            error_code=task.error.error_code,
                            message=task.error.message,
                            hint=task.error.hint,
                        ),
                    )
                    for task in stage.tasks
                ],
            )
            for stage in state.stages
        ],
    )


@router.get("/install", responses={status.HTTP_404_NOT_FOUND: {"description": _NO_RUN}})
async def get_snapshot(runtime: RuntimeDep) -> Snapshot:
    """R13: atomic snapshot of the current run."""
    state = await asyncio.to_thread(runtime.store.snapshot)
    if state is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NO_RUN)
    return _snapshot_out(state)


@router.post(
    "/install",
    status_code=status.HTTP_202_ACCEPTED,
    responses={status.HTTP_409_CONFLICT: {"description": "A run is already in progress."}},
)
async def start_install(body: InstallRequest, runtime: RuntimeDep) -> InstallStarted:
    """R14: start a new run; 409 while another run is running."""
    event = await runtime.start_install(body.scenario)
    if event is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A run is already in progress")
    return InstallStarted(run_id=event.run_id, scenario=body.scenario)


@router.get(
    "/install/logs",
    responses={
        status.HTTP_404_NOT_FOUND: {"description": "No run exists."},
        status.HTTP_409_CONFLICT: {"description": "run_id is not the current run."},
    },
)
async def get_logs(
    runtime: RuntimeDep,
    run_id: Annotated[int, Query(ge=1)],
    after: Annotated[int, Query(ge=0)] = 0,
    until: Annotated[int | None, Query(ge=0)] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 500,
) -> LogPageOut:
    """R15: cursor-paged log events with ``after < seq <= until``."""
    page = await asyncio.to_thread(runtime.store.read_logs, after, until, limit)
    if page is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No run exists")
    if page.run.run_id != run_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "run_id is not the current run")
    items = [LogItem.model_validate({"seq": e.seq, **e.data}) for e in page.items]
    next_after = items[-1].seq if page.has_more and items else None
    return LogPageOut(run_id=page.run.run_id, items=items, next_after=next_after)


@router.get(
    "/install/events",
    status_code=status.HTTP_200_OK,
    response_class=EventStreamResponse,
    responses={
        status.HTTP_200_OK: {
            "description": "SSE stream.",
            "content": {"text/event-stream": {"schema": {"type": "string"}}},
        },
        status.HTTP_204_NO_CONTENT: {"description": "Run finished and client is up to date."},
        status.HTTP_404_NOT_FOUND: {"description": "No run exists."},
        status.HTTP_422_UNPROCESSABLE_CONTENT: {"description": "Malformed last_event_id."},
    },
)
async def stream_events(
    runtime: RuntimeDep,
    last_event_id: Annotated[str | None, Query()] = None,
    last_event_id_header: Annotated[str | None, Header(alias="Last-Event-ID")] = None,
) -> Response:
    """R18-R24: SSE stream of the current run starting after the given event id."""
    query_start = parse_event_id(last_event_id)
    if last_event_id is not None and query_start is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Malformed last_event_id")
    start = parse_event_id(last_event_id_header) or query_start
    subscriber = runtime.broker.subscribe()
    try:
        loaded = await asyncio.to_thread(runtime.store.read_after, start[1] if start else 0)
    except BaseException:
        runtime.broker.unsubscribe(subscriber)
        raise
    if loaded is None:
        runtime.broker.unsubscribe(subscriber)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No run exists")
    run, replay = loaded

    def close() -> None:
        runtime.broker.unsubscribe(subscriber)

    if start is not None:
        start_run, start_seq = start
        if start_run != run.run_id or (start_seq > run.last_seq and run.running):
            close()
            return EventStreamResponse(reset_stream(run.run_id))
        if not run.running and start_seq >= run.last_seq:
            close()
            return Response(status_code=status.HTTP_204_NO_CONTENT)
    chunks = event_stream(
        subscriber,
        run.run_id,
        start[1] if start else 0,
        replay,
        runtime.settings.heartbeat_interval,
    )
    return EventStreamResponse(chunks, subscriber=subscriber, on_close=close)
