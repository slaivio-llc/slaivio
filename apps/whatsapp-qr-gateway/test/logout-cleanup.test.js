import test from "node:test";
import assert from "node:assert/strict";
import { logoutWithCleanup } from "../src/logout-cleanup.js";

test("logout cleans only the selected session after remote success", async () => {
  const calls = [];
  const session = { status: "CONNECTED", socket: { logout: async () => calls.push("logout"), end: () => calls.push("end") } };
  const result = await logoutWithCleanup(session, { clearAuth: async () => calls.push("clear"), removeSession: () => calls.push("remove") });
  assert.equal(result.remote_logout_confirmed, true);
  assert.equal(session.status, "LOGGED_OUT");
  assert.deepEqual(calls, ["logout", "end", "clear", "remove"]);
});

test("closed remote socket cannot prevent cleanup or pretend confirmed logout", async () => {
  const calls = [];
  const session = { socket: { logout: async () => { throw new Error("private upstream details"); }, end: () => calls.push("end") } };
  await assert.rejects(logoutWithCleanup(session, { clearAuth: async () => calls.push("clear"), removeSession: () => calls.push("remove") }),
    error => error.statusCode === 503 && error.message === "whatsapp_qr_remote_logout_unconfirmed");
  assert.deepEqual(calls, ["end", "clear", "remove"]);
});

test("logout timeout still closes the socket and clears local auth", async () => {
  const calls = [];
  await assert.rejects(logoutWithCleanup({ socket: { logout: () => new Promise(() => {}), end: () => calls.push("end") } },
    { timeoutMs: 5, clearAuth: async () => calls.push("clear"), removeSession: () => calls.push("remove") }), /remote_logout_unconfirmed/);
  assert.deepEqual(calls, ["end", "clear", "remove"]);
});

test("missing in-memory session clears persisted auth without claiming remote confirmation", async () => {
  let cleared = false;
  const result = await logoutWithCleanup(undefined, { clearAuth: async () => { cleared = true; }, removeSession: () => {} });
  assert.equal(cleared, true);
  assert.equal(result.remote_logout_confirmed, false);
});

test("storage failure is not presented as success but the socket is removed", async () => {
  let removed = false;
  await assert.rejects(logoutWithCleanup(undefined, { clearAuth: async () => { throw new Error("storage failed"); }, removeSession: () => { removed = true; } }), /storage failed/);
  assert.equal(removed, true);
});
