import type {
  MonitorState,
  ParcelChange,
  ParcelChangeKind,
  ParcelObservation,
} from "./model.js";
import { stableId, stableJson } from "./model.js";

export interface ApplyObservationsResult {
  state: MonitorState;
  changes: ParcelChange[];
}

function makeChange(
  parcelKey: string,
  kind: ParcelChangeKind,
  occurredAt: string,
  before: unknown,
  after: unknown
): ParcelChange {
  const semantic = { parcelKey, kind, before, after };
  return {
    changeId: stableId("change", semantic),
    parcelKey,
    kind,
    occurredAt,
    before,
    after,
  };
}

export function applyObservations(
  input: MonitorState,
  observations: ParcelObservation[],
  observedAt: string,
  missingPollThreshold = 2
): ApplyObservationsResult {
  const state = structuredClone(input);
  const emitted: ParcelChange[] = [];
  const seen = new Set<string>();

  for (const observation of observations.sort((a, b) => a.parcelKey.localeCompare(b.parcelKey))) {
    seen.add(observation.parcelKey);
    const stored = state.parcels[observation.parcelKey];
    if (!stored) {
      state.parcels[observation.parcelKey] = {
        parcelKey: observation.parcelKey,
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
        active: true,
        consecutiveMissingPolls: 0,
        latest: observation,
      };
      emitted.push(makeChange(observation.parcelKey, "first_seen", observedAt, null, observation));
      continue;
    }

    if (!stored.active) {
      emitted.push(makeChange(observation.parcelKey, "reactivated", observedAt, false, true));
    }
    if (stored.latest.statusCode !== observation.statusCode) {
      emitted.push(
        makeChange(
          observation.parcelKey,
          "status_changed",
          observedAt,
          stored.latest.statusCode,
          observation.statusCode
        )
      );
    }
    const previousExpected = [stored.latest.expectedAt, stored.latest.expectedEndAt];
    const nextExpected = [observation.expectedAt, observation.expectedEndAt];
    if (stableJson(previousExpected) !== stableJson(nextExpected)) {
      emitted.push(
        makeChange(observation.parcelKey, "expected_changed", observedAt, previousExpected, nextExpected)
      );
    }
    if (stableJson(stored.latest.latestEvent) !== stableJson(observation.latestEvent)) {
      emitted.push(
        makeChange(
          observation.parcelKey,
          "latest_event_changed",
          observedAt,
          stored.latest.latestEvent,
          observation.latestEvent
        )
      );
    }

    stored.active = true;
    stored.consecutiveMissingPolls = 0;
    stored.lastSeenAt = observedAt;
    stored.latest = observation;
    delete stored.inactiveAt;
  }

  for (const stored of Object.values(state.parcels)) {
    if (seen.has(stored.parcelKey) || !stored.active) continue;
    stored.consecutiveMissingPolls += 1;
    if (stored.consecutiveMissingPolls >= missingPollThreshold) {
      stored.active = false;
      stored.inactiveAt = observedAt;
      emitted.push(makeChange(stored.parcelKey, "inactive", observedAt, true, false));
    }
  }

  for (const change of emitted) state.changes[change.changeId] = change;
  state.baselineEstablished = true;
  state.updatedAt = observedAt;
  return { state, changes: emitted };
}
