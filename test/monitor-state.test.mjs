import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { applyObservations } from "../dist/monitor/diff.js";
import { createEmptyMonitorState, normalizeDelivery } from "../dist/monitor/model.js";
import {
  FileMonitorStateStore,
  MonitorStateBusyError,
  MonitorStateCorruptError,
} from "../dist/monitor/state-store.js";

const firstTime = "2026-01-01T00:00:00.000Z";
const secondTime = "2026-01-01T01:00:00.000Z";

function delivery(statusCode = 2) {
  return {
    carrier_code: "ups",
    tracking_number: "SYNTHETIC-42",
    description: "Synthetic parcel",
    status_code: statusCode,
    events: [{ event: "Synthetic event", date: firstTime }],
  };
}

test("normalization and changes are deterministic", () => {
  const observation = normalizeDelivery(delivery(), firstTime);
  const baseline = applyObservations(createEmptyMonitorState(firstTime), [observation], firstTime);
  assert.equal(baseline.changes[0].kind, "first_seen");

  const changed = normalizeDelivery(delivery(4), secondTime);
  const update = applyObservations(baseline.state, [changed], secondTime);
  assert.deepEqual(update.changes.map((item) => item.kind), ["status_changed"]);
  assert.equal(
    applyObservations(baseline.state, [changed], secondTime).changes[0].changeId,
    update.changes[0].changeId
  );
});

test("a parcel requires two successful omissions before becoming inactive", () => {
  const observation = normalizeDelivery(delivery(), firstTime);
  const baseline = applyObservations(createEmptyMonitorState(firstTime), [observation], firstTime);
  const once = applyObservations(baseline.state, [], secondTime);
  assert.equal(once.changes.length, 0);
  assert.equal(Object.values(once.state.parcels)[0].active, true);
  const twice = applyObservations(once.state, [], "2026-01-01T02:00:00.000Z");
  assert.equal(twice.changes[0].kind, "inactive");
});

test("state writes atomically and lock rejects concurrent work", async () => {
  const directory = await mkdtemp(join(tmpdir(), "parcel-state-test-"));
  const store = new FileMonitorStateStore(directory);
  const state = createEmptyMonitorState(firstTime);
  await store.save(state);
  const saved = JSON.parse(await readFile(store.statePath, "utf8"));
  assert.equal(saved.revision, 1);

  const release = await store.acquireLock();
  await assert.rejects(store.acquireLock(), MonitorStateBusyError);
  await release();
});

test("corrupt state is quarantined and never treated as empty", async () => {
  const directory = await mkdtemp(join(tmpdir(), "parcel-corrupt-test-"));
  const store = new FileMonitorStateStore(directory);
  await writeFile(store.statePath, "not-json", "utf8");
  await assert.rejects(store.load(), MonitorStateCorruptError);
});
