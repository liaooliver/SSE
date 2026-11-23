import { expect, test } from "vitest";
import {
  PLAN,
  SCENARIOS,
  KeyError,
  ValueError,
  applyEvent,
  initialSnapshot,
  scriptFor,
  formatEventId,
  parseEventId,
  formatEvent,
  RETRY_BLOCK,
  PING_COMMENT,
  type Event as InstallEvent,
  type EventType,
  type TaskError,
  type Scenario,
  type ScriptStep,
  type Status,
} from "../../src/domain";
import { cases, stages } from "../helpers/catalog";
import { decodeEvent } from "../helpers/stream";

const stamp = "2026-01-01T12:00:00Z";
const run = 17;
function persisted(step: ScriptStep, seq: number): InstallEvent {
  const data = { ...step.data };
  if (step.type === "run_started") data.run_id = run;
  if (step.type === "log") data.ts = stamp;
  return { run_id: run, seq, ts: stamp, type: step.type, data };
}

test("R4 R5 計畫與情境逐欄符合規格順序", () => {
  expect(PLAN).toEqual(stages);
  expect([...SCENARIOS]).toEqual(cases.map((item) => [item.id, item]));
});

function expectedScript(scenario: Scenario): unknown[] {
  const steps: unknown[] = [];
  function add(type: EventType, data: Record<string, unknown>) {
    steps.push({ type, data });
  }
  add("run_started", { scenario: scenario.id });
  for (const stage of stages) {
    const parent = { stage_id: stage.id };
    add("stage_started", parent);
    for (const task of stage.tasks) {
      const target = { ...parent, task_id: task.id };
      add("task_started", target);
      const fails = task.id === scenario.fail_task_id;
      const lines = fails ? (scenario.fail_after_lines ?? 0) : task.log_lines;
      for (let line = 1; line <= lines; line++) {
        const prefix = "[" + task.id + "] (" + String(line) + "/" + String(task.log_lines) + ") ";
        const text: unknown = expect.stringMatching(
          new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ".+"),
        );
        add("log", { ...target, level: "info", line_no: line, text });
      }
      if (fails) {
        add("log", { ...target, level: "error", line_no: lines + 1, text: scenario.message });
        add("task_failed", {
          ...target,
          error_code: scenario.error_code,
          message: scenario.message,
          hint: scenario.hint,
        });
        add("stage_failed", parent);
        add("run_finished", { result: "failed" });
        return steps;
      }
      add("task_succeeded", target);
    }
    add("stage_succeeded", parent);
  }
  add("run_finished", { result: "succeeded" });
  return steps;
}

test("R6 七種劇本的順序、行數、訊息與終點", () => {
  for (const scenario of cases) {
    const first = structuredClone(scriptFor(scenario.id));
    expect(first).toEqual(expectedScript(scenario));
    expect(scriptFor(scenario.id)).toEqual(first);
    if (scenario.id === "success") expect(first).toHaveLength(202);
  }
  expect(() => scriptFor("不存在")).toThrow(KeyError);
  expect(() => initialSnapshot(run, "不存在")).toThrow(KeyError);
});

test("R9 事件 ID 僅接受安全的 ASCII 十進位整數對", () => {
  const max = Number.MAX_SAFE_INTEGER;
  expect(formatEventId(3, 57)).toBe("3.57");
  expect(parseEventId(" \t000.003\n")).toEqual([0, 3]);
  expect(parseEventId(formatEventId(max, max))).toEqual([max, max]);
  for (const id of [
    null,
    "",
    "3",
    "1.2.3",
    "１.２",
    "+1.2",
    "1.-2",
    "1 .2",
    "1.2e2",
    "9007199254740992.0",
    "0.9007199254740992",
  ])
    expect(parseEventId(id)).toBeNull();
});

interface ExpectedTask {
  id: string;
  name: string;
  status: Status;
  error: TaskError | null;
}

test("R10 每一筆合法轉移都回傳正確快照並保留舊值", () => {
  for (const scenario of cases) {
    const initial = {
      run_id: run,
      scenario: scenario.id,
      status: "running",
      last_seq: 0,
      stages: stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        status: "pending",
        tasks: stage.tasks.map((task): ExpectedTask => ({
          id: task.id,
          name: task.name,
          status: "pending",
          error: null,
        })),
      })),
    };
    let state = initialSnapshot(run, scenario.id);
    expect(state).toEqual(initial);
    for (const step of scriptFor(scenario.id)) {
      const previous = state;
      const preserved = structuredClone(previous);
      const event = persisted(step, ++initial.last_seq);
      state = applyEvent(state, event);
      expect(previous).toEqual(preserved);
      const stage = initial.stages.find((item) => item.id === step.data.stage_id);
      const task = stage?.tasks.find((item) => item.id === step.data.task_id);
      const transitions: Readonly<Record<string, Status>> = {
        started: "running",
        succeeded: "succeeded",
        failed: "failed",
      };
      const [kind, verb] = step.type.split("_");
      const target = kind === "stage" ? stage : kind === "task" ? task : undefined;
      const status = transitions[verb ?? ""];
      if (target && status) target.status = status;
      if (
        task &&
        step.type === "task_failed" &&
        scenario.error_code &&
        scenario.message &&
        scenario.hint
      )
        task.error = {
          error_code: scenario.error_code,
          message: scenario.message,
          hint: scenario.hint,
        };
      if (step.type === "run_finished")
        initial.status = scenario.id === "success" ? "succeeded" : "failed";
      expect(state).toEqual(initial);
    }
  }
});

test("R10 拒絕錯誤序號、輪次、目標、狀態與資料欄位", () => {
  for (const scenario of ["success", "dependency_missing"]) {
    let state = initialSnapshot(run, scenario);
    const checked = new Set<EventType>();
    for (const step of scriptFor(scenario)) {
      const event = persisted(step, state.last_seq + 1);
      if (checked.has(step.type)) {
        state = applyEvent(state, event);
        continue;
      }
      checked.add(step.type);
      const bad = (overrides: Partial<InstallEvent>) => {
        expect(() => applyEvent(state, { ...event, ...overrides })).toThrow(ValueError);
      };
      bad({ seq: event.seq + 1 });
      bad({ run_id: run + 1 });
      if (state.last_seq === 0) bad({ type: "stage_started", data: { stage_id: "prepare" } });
      else bad({ type: "run_started", data: { run_id: run, scenario } });
      for (const [key, value] of Object.entries(event.data)) {
        const data = Object.fromEntries(
          Object.entries(event.data).filter(([name]) => name !== key),
        );
        bad({ data });
        bad({ data: { ...event.data, [key]: false } });
        if (typeof value === "number") {
          for (const wrong of [1.5, Number.MAX_SAFE_INTEGER + 1])
            bad({ data: { ...event.data, [key]: wrong } });
        }
      }
      if (step.type === "log") bad({ data: { ...event.data, level: "debug" } });
      if (step.type === "run_finished") bad({ data: { result: "running" } });
      if ("stage_id" in step.data) bad({ data: { ...event.data, stage_id: "不存在" } });
      if ("task_id" in step.data) {
        bad({ data: { ...event.data, task_id: "不存在" } });
        bad({
          data: {
            ...event.data,
            task_id: step.data.stage_id === "prepare" ? "extract" : "check_os",
          },
        });
        bad({
          data: {
            ...event.data,
            stage_id: step.data.stage_id === "prepare" ? "install" : "prepare",
          },
        });
        for (const inactiveStatus of ["pending", "succeeded", "failed"] as const) {
          const wrong = {
            ...state,
            stages: state.stages.map((stage) =>
              stage.id !== step.data.stage_id ? stage : { ...stage, status: inactiveStatus },
            ),
          };
          expect(() => applyEvent(wrong, event)).toThrow(ValueError);
        }
      }
      const allowed = step.type.endsWith("_started") ? "pending" : "running";
      for (const status of ["pending", "running", "succeeded", "failed"] as const) {
        if (status === allowed || !("stage_id" in step.data)) continue;
        const wrong = {
          ...state,
          stages: state.stages.map((stage) =>
            stage.id !== step.data.stage_id
              ? stage
              : "task_id" in step.data
                ? {
                    ...stage,
                    tasks: stage.tasks.map((task) =>
                      task.id === step.data.task_id ? { ...task, status } : task,
                    ),
                  }
                : { ...stage, status },
          ),
        };
        expect(() => applyEvent(wrong, event)).toThrow(ValueError);
      }
      const before = structuredClone(state);
      const next = applyEvent(state, event);
      expect(state).toEqual(before);
      state = next;
    }
    const finalEvent = persisted(
      { type: "run_finished", data: { result: "failed" } },
      state.last_seq + 1,
    );
    expect(() => applyEvent(state, finalEvent)).toThrow(ValueError);
    if (scenario === "dependency_missing") {
      const later = persisted(
        { type: "stage_started", data: { stage_id: "install" } },
        state.last_seq + 1,
      );
      expect(() => applyEvent(state, later)).toThrow(ValueError);
    }
  }
});

test("R19 R20 R22 SSE 欄位、跳脫字元與控制區塊", () => {
  expect(RETRY_BLOCK).toBe("retry: 3000\n\n");
  expect(PING_COMMENT).toBe(": ping\n\n");
  const log = persisted(
    {
      type: "log",
      data: {
        stage_id: "prepare",
        task_id: "check_os",
        level: "info",
        line_no: 1,
        text: '引號"、換行\n與反斜線\\',
      },
    },
    4,
  );
  expect(decodeEvent(formatEvent(log), run)).toEqual(log);
});
