"""R4-R10、R19 的純公開介面測試。"""

import json
from dataclasses import replace

import pytest

from .public_api import (
    PING_COMMENT,
    PLAN,
    RETRY_BLOCK,
    SCENARIOS,
    Event,
    EventType,
    JsonValue,
    ScriptStep,
    Snapshot,
    apply_event,
    format_event,
    format_event_id,
    initial_snapshot,
    parse_event_id,
    script_for,
)
from .reference import CASES, PLAN_ROWS, STAMP, contract_value_error, snapshot_json
from .wire import PING, RETRY, Block


def test_r4_r5_tables() -> None:
    """R4、R5 的內容、順序、行數和失敗細節。"""
    assert (
        tuple((s.id, s.name, tuple((t.id, t.name, t.log_lines) for t in s.tasks)) for s in PLAN)
        == PLAN_ROWS
    )
    assert list(SCENARIOS) == list(CASES)
    for key, case in CASES.items():
        actual = SCENARIOS[key]
        assert (
            actual.id,
            actual.label,
            actual.fail_task_id,
            actual.fail_after_lines,
            actual.error_code,
            actual.message,
            actual.hint,
        ) == (key, case.label, case.task, case.lines, case.code, case.message, case.hint)


def _check_script(scenario: str, steps: tuple[ScriptStep, ...]) -> None:
    case = CASES[scenario]
    remaining = iter(steps)
    start = next(remaining)
    assert start.type == "run_started"
    assert start.data == {"scenario": scenario}

    def take(kind: str, data: dict[str, JsonValue]) -> None:
        step = next(remaining)
        assert (step.type, dict(step.data)) == (kind, data)

    for sid, _, tasks in PLAN_ROWS:
        stage: dict[str, JsonValue] = {"stage_id": sid}
        take("stage_started", stage)
        for tid, _, total in tasks:
            task: dict[str, JsonValue] = {**stage, "task_id": tid}
            take("task_started", task)
            count = case.lines if case.task == tid else total
            assert count is not None
            for number in range(1, count + 1):
                step = next(remaining)
                text = step.data["text"]
                assert isinstance(text, str)
                prefix = f"[{tid}] ({number}/{total}) "
                assert text.startswith(prefix)
                assert text[len(prefix) :].strip()
                assert (step.type, step.data) == (
                    "log",
                    {**task, "line_no": number, "level": "info", "text": text},
                )
            if tid == case.task:
                take("log", {**task, "line_no": count + 1, "level": "error", "text": case.message})
                take(
                    "task_failed",
                    {**task, "error_code": case.code, "message": case.message, "hint": case.hint},
                )
                take("stage_failed", stage)
                take("run_finished", {"result": "failed"})
                assert next(remaining, None) is None
                return
            take("task_succeeded", task)
        take("stage_succeeded", stage)
    take("run_finished", {"result": "succeeded"})
    assert next(remaining, None) is None
    assert len(steps) == 202


@pytest.mark.parametrize("scenario", CASES)
def test_r6_script(scenario: str) -> None:
    """R6、R8、AC5 每個情境的完整事件與資料符合規格表。"""
    steps = script_for(scenario)
    assert isinstance(steps, tuple)
    assert steps == script_for(scenario)
    _check_script(scenario, steps)


def test_r6_r10_unknown_scenario() -> None:
    """R6、R10 對不存在的情境拋出 KeyError。"""
    with pytest.raises(KeyError):
        script_for("unknown")
    with pytest.raises(KeyError):
        initial_snapshot(1, "unknown")


def test_r9_ids() -> None:
    """R9 的 ASCII 語法、外圍空白以及 round trip。"""
    for run, seq in ((1, 0), (3, 57), (12345678901234567890, 999999)):
        raw = format_event_id(run, seq)
        assert raw == f"{run}.{seq}"
        assert parse_event_id(raw) == (run, seq)
    assert parse_event_id(" \t0003.057\n") == (3, 57)
    assert parse_event_id("0.0") == (0, 0)
    for invalid in (
        None,
        "",
        " ",
        "1",
        ".1",
        "1.",
        "1.2.3",
        "+1.2",
        "1.-2",
        "1e2.3",
        "1 .2",
        "1. 2",
        "1.2x",
        "\uff11.\uff12",
        "\u0661.\u0662",
        "1\n.2",
        "1_0.2",
    ):
        assert parse_event_id(invalid) is None, invalid


@pytest.mark.parametrize("scenario", CASES)
def test_r10_every_transition(scenario: str) -> None:
    """R10 逐事件核對整棵狀態樹。確保輸入快照保持原值。"""
    run = 41
    state = initial_snapshot(run, scenario)
    stages = [
        {
            "id": sid,
            "name": name,
            "status": "pending",
            "tasks": [
                {"id": tid, "name": title, "status": "pending", "error": None}
                for tid, title, _ in tasks
            ],
        }
        for sid, name, tasks in PLAN_ROWS
    ]
    expected = {
        "run_id": run,
        "scenario": scenario,
        "status": "running",
        "last_seq": 0,
        "stages": stages,
    }
    assert snapshot_json(state) == expected
    stages_by_id = {stage["id"]: stage for stage in stages}
    tasks_by_id = {task["id"]: task for stage in stages for task in stage["tasks"]}
    for seq, step in enumerate(script_for(scenario), 1):
        data = dict(step.data)
        if step.type == "run_started":
            data["run_id"] = run
        elif step.type == "log":
            data["ts"] = STAMP
        elif step.type == "run_finished":
            expected["status"] = data["result"]
        else:
            category, outcome = step.type.split("_")
            target = (
                stages_by_id[data["stage_id"]]
                if category == "stage"
                else tasks_by_id[data["task_id"]]
            )
            target["status"] = "running" if outcome == "started" else outcome
            if step.type == "task_failed":
                target["error"] = {key: data[key] for key in ("error_code", "message", "hint")}
        previous = snapshot_json(state)
        new = apply_event(state, Event(run, seq, step.type, data, STAMP))
        assert snapshot_json(state) == previous
        expected["last_seq"] = seq
        assert snapshot_json(new) == expected
        state = new


def test_r10_invalid_events() -> None:
    """R10 拒絕跨輪、錯誤序號、錯置的 run_started、非法轉換及終止後的事件。"""
    run = 7
    state = initial_snapshot(run, "success")
    start = Event(run, 1, "run_started", {"run_id": run, "scenario": "success"}, STAMP)
    stage = {"stage_id": "prepare"}
    begin_stage = Event(run, 2, "stage_started", stage, STAMP)
    for event in (
        replace(start, seq=0),
        replace(start, seq=2),
        replace(begin_stage, seq=1),
        Event(run, 1, "run_finished", {"result": "succeeded"}, STAMP),
    ):
        with contract_value_error():
            apply_event(state, event)
    state = apply_event(state, start)
    for event in (
        replace(begin_stage, run_id=8),
        replace(begin_stage, seq=1),
        replace(start, seq=2),
    ):
        with contract_value_error():
            apply_event(state, event)
    task = {**stage, "task_id": "check_os"}
    # 此時 stage 本身仍是 pending。R10 第 1 項禁止直接進入終態。
    for kind in ("stage_failed", "stage_succeeded"):
        with contract_value_error():
            apply_event(state, Event(run, 2, kind, stage, STAMP))
    state = apply_event(state, Event(run, 2, "stage_started", stage, STAMP))
    for invalid in (
        Event(run, 3, "stage_started", stage, STAMP),
        Event(run, 3, "task_succeeded", task, STAMP),
    ):
        with contract_value_error():
            apply_event(state, invalid)
    state = apply_event(state, Event(run, 3, "task_started", task, STAMP))
    with contract_value_error():
        apply_event(state, Event(run, 4, "task_started", task, STAMP))
    for seq, step in enumerate(script_for("success")[3:], 4):
        data = dict(step.data)
        if step.type == "log":
            data["ts"] = STAMP
        state = apply_event(state, Event(run, seq, step.type, data, STAMP))
    for invalid in (
        Event(run, 203, "run_finished", {"result": "failed"}, STAMP),
        Event(run, 203, "stage_started", stage, STAMP),
        Event(run, 203, "task_started", task, STAMP),
    ):
        with contract_value_error():
            apply_event(state, invalid)


@pytest.fixture
def r10_examples() -> dict[EventType, tuple[Snapshot, Event]]:
    """R10 取每種事件及其合法的前一個快照。此劇本包含全部九種事件。"""
    run = 31
    state = initial_snapshot(run, "network_unreachable")
    examples: dict[EventType, tuple[Snapshot, Event]] = {}
    for seq, step in enumerate(script_for("network_unreachable"), 1):
        data = dict(step.data)
        if step.type == "run_started":
            data["run_id"] = run
        elif step.type == "log":
            data["ts"] = STAMP
        event = Event(run, seq, step.type, data, STAMP)
        examples.setdefault(step.type, (state, event))
        state = apply_event(state, event)
    return examples


@pytest.mark.parametrize(
    "kind",
    [
        "run_started",
        "stage_started",
        "stage_succeeded",
        "stage_failed",
        "task_started",
        "task_succeeded",
        "task_failed",
        "log",
        "run_finished",
    ],
)
def test_r10_payload_fields(
    kind: EventType, r10_examples: dict[EventType, tuple[Snapshot, Event]]
) -> None:
    """R8、R10 所有事件逐欄驗證必填與型別。"""
    state, event = r10_examples[kind]
    for field, original in event.data.items():
        missing = dict(event.data)
        del missing[field]
        with contract_value_error():
            apply_event(state, replace(event, data=missing))
        wrong_values = (str(original), True) if type(original) is int else (17,)
        for value in wrong_values:
            with contract_value_error():
                apply_event(state, replace(event, data={**event.data, field: value}))
    if kind in {"log", "run_finished"}:
        field = "level" if kind == "log" else "result"
        with contract_value_error():
            apply_event(state, replace(event, data={**event.data, field: "unknown"}))


@pytest.mark.parametrize(
    "kind",
    [
        "stage_started",
        "stage_succeeded",
        "stage_failed",
        "task_started",
        "task_succeeded",
        "task_failed",
        "log",
    ],
)
def test_r10_unknown_identifiers(
    kind: EventType, r10_examples: dict[EventType, tuple[Snapshot, Event]]
) -> None:
    """R4、R10 驗證 stage id 與完整的 stage、task 配對。"""
    state, event = r10_examples[kind]
    invalid = [{"stage_id": "missing"}]
    if "task_id" in event.data:
        other = "fetch_manifest" if event.data["stage_id"] == "prepare" else "check_os"
        invalid.extend(({"task_id": "missing"}, {"task_id": other}))
    for change in invalid:
        with contract_value_error():
            apply_event(state, replace(event, data={**event.data, **change}))


def test_r10_inactive_targets(r10_examples: dict[EventType, tuple[Snapshot, Event]]) -> None:
    """R10 只有執行中的 stage 能接收 task 事件。只有執行中的 task 能接收 log。"""
    before_stage, _ = r10_examples["stage_started"]
    before_task, start_task = r10_examples["task_started"]
    _, log = r10_examples["log"]
    for kind in ("task_started", "task_succeeded", "task_failed", "log"):
        _, event = r10_examples[kind]
        with contract_value_error():
            apply_event(before_stage, replace(event, seq=before_stage.last_seq + 1))
    with contract_value_error():
        apply_event(before_task, replace(log, seq=before_task.last_seq + 1))
    _, failure = r10_examples["task_failed"]
    with contract_value_error():
        apply_event(
            before_task,
            replace(failure, seq=start_task.seq, data={**failure.data, **start_task.data}),
        )

    for kind in ("task_succeeded", "task_failed"):
        before, finish = r10_examples[kind]
        after = apply_event(before, finish)
        task = {key: finish.data[key] for key in ("stage_id", "task_id")}
        with contract_value_error():
            apply_event(after, replace(log, seq=after.last_seq + 1, data={**log.data, **task}))

    before, failed = r10_examples["stage_failed"]
    ended_stage = apply_event(before, failed)
    next_task = {"stage_id": "download", "task_id": "download_packages"}
    with contract_value_error():
        apply_event(ended_stage, replace(start_task, seq=ended_stage.last_seq + 1, data=next_task))


def test_r10_terminal_states(r10_examples: dict[EventType, tuple[Snapshot, Event]]) -> None:
    """R10 已結束的 stage 與 task 不能再次轉移。輪次結束後拒絕所有事件。"""
    _, start_stage = r10_examples["stage_started"]
    for kinds in (
        ("stage_started", "stage_succeeded", "stage_failed"),
        ("task_started", "task_succeeded", "task_failed"),
    ):
        for terminal in kinds[1:]:
            before, finish = r10_examples[terminal]
            after = apply_event(before, finish)
            ids = {key: finish.data[key] for key in ("stage_id", "task_id") if key in finish.data}
            for kind in kinds:
                _, attempt = r10_examples[kind]
                with contract_value_error():
                    apply_event(
                        after,
                        replace(attempt, seq=after.last_seq + 1, data={**attempt.data, **ids}),
                    )
    before, finish = r10_examples["run_finished"]
    ended_run = apply_event(before, finish)
    for _, attempt in r10_examples.values():
        with contract_value_error():
            apply_event(ended_run, replace(attempt, seq=ended_run.last_seq + 1))
    with contract_value_error():
        apply_event(
            ended_run,
            replace(start_stage, seq=ended_run.last_seq + 1, data={"stage_id": "install"}),
        )


def test_r19_r20_r22_wire_format() -> None:
    """R19、R20、R22 驗證單行 JSON 的跳脫與兩種控制區塊。"""
    data = {
        "stage_id": "prepare",
        "task_id": "check_os",
        "level": "info",
        "line_no": 1,
        "text": '第一行\n第二行 "引號" \\ 路徑',
        "ts": STAMP,
    }
    event = Event(3, 57, "log", data, STAMP)
    raw = format_event(event).encode()
    assert raw.endswith(b"\n\n")
    assert raw.count(b"\n\n") == 1
    assert b"\r" not in raw
    fields = Block(raw, 0).fields()
    assert fields.keys() == {"id", "event", "data"}
    assert fields["id"] == "3.57"
    assert fields["event"] == "log"
    assert json.loads(fields["data"]) == data
    for seq, step in enumerate(script_for("network_unreachable"), 1):
        payload = dict(step.data)
        if step.type == "run_started":
            payload["run_id"] = 3
        if step.type == "log":
            payload["ts"] = STAMP
        item = Event(3, seq, step.type, payload, STAMP)
        encoded = format_event(item).encode()
        assert encoded.endswith(b"\n\n")
        assert Block(encoded, 0).event(3) == item
    assert RETRY_BLOCK.encode() == RETRY
    assert PING_COMMENT.encode() == PING
