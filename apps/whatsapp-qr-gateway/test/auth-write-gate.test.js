import test from "node:test";
import assert from "node:assert/strict";
import { createAuthWriteGate } from "../src/auth-write-gate.js";

test("logout drains pending writes then prevents credential resurrection", async () => {
  const gate = createAuthWriteGate();
  let finish;
  const calls = [];
  const task = gate.run(async () => { await new Promise(resolve => { finish = resolve; }); calls.push("write"); });
  await Promise.resolve();
  const closing = gate.close(() => calls.push("clear"));
  await gate.run(() => calls.push("late write"));
  finish(); await task; await closing;
  assert.deepEqual(calls, ["write", "clear"]);
});

test("failed pending writes cannot prevent local credential deletion", async () => {
  const gate = createAuthWriteGate();
  const task = gate.run(() => { throw new Error("storage failed"); });
  let cleared = false;
  const closing = gate.close(() => { cleared = true; });
  await assert.rejects(task, /storage failed/); await closing;
  assert.equal(cleared, true);
});
