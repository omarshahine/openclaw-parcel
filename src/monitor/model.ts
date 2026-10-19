import { createHash } from "node:crypto";

import type { ParcelDelivery, ParcelDeliveryEvent } from "../lib/types.js";

export const MONITOR_STATE_SCHEMA_VERSION = 1;

export interface CanonicalParcelEvent {
  description: string;
  occurredAt: string;
  location: string | null;
}

export interface ParcelObservation {
  parcelKey: string;
  carrierCode: string;
  trackingNumber: string;
  description: string;
  statusCode: number;
  expectedAt: string | null;
  expectedEndAt: string | null;
  latestEvent: CanonicalParcelEvent | null;
  observedAt: string;
  observationHash: string;
}

export interface StoredParcel {
  parcelKey: string;
  firstSeenAt: string;
  lastSeenAt: string;
  active: boolean;
  consecutiveMissingPolls: number;
  latest: ParcelObservation;
  inactiveAt?: string;
}

export type ParcelChangeKind =
  | "first_seen"
  | "status_changed"
  | "expected_changed"
  | "latest_event_changed"
  | "inactive"
  | "reactivated";

export interface ParcelChange {
  changeId: string;
  parcelKey: string;
  kind: ParcelChangeKind;
  occurredAt: string;
  before: unknown;
  after: unknown;
}

export interface PollControlState {
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastFailure?: string;
  nextAllowedAt?: string;
  requestAttempts: string[];
}

export interface NotificationRecord {
  notificationId: string;
  status: "pending" | "acknowledged";
  createdAt: string;
  acknowledgedAt?: string;
  attemptCount: number;
  lastAttemptAt?: string;
  changeIds: string[];
  payload: Record<string, unknown>;
}

export interface UnifiEventRecord {
  eventId: string;
  receivedAt: string;
  updatedAt: string;
  stage: string;
  expiresAt: string;
  data: Record<string, unknown>;
}

export interface MonitorState {
  schemaVersion: 1;
  revision: number;
  createdAt: string;
  updatedAt: string;
  baselineEstablished: boolean;
  pollControl: PollControlState;
  parcels: Record<string, StoredParcel>;
  changes: Record<string, ParcelChange>;
  notifications: Record<string, NotificationRecord>;
  unifiEvents: Record<string, UnifiEventRecord>;
}

export function createEmptyMonitorState(now = new Date().toISOString()): MonitorState {
  return {
    schemaVersion: MONITOR_STATE_SCHEMA_VERSION,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    baselineEstablished: false,
    pollControl: { requestAttempts: [] },
    parcels: {},
    changes: {},
    notifications: {},
    unifiEvents: {},
  };
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function stableId(namespace: string, value: unknown): string {
  return `${namespace}_${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

export function parcelKey(carrierCode: string, trackingNumber: string): string {
  return `${carrierCode.trim().toLowerCase()}:${trackingNumber.trim().toUpperCase()}`;
}

function normalizeEvent(event: ParcelDeliveryEvent): CanonicalParcelEvent {
  return {
    description: event.event.trim(),
    occurredAt: event.date,
    location: event.location?.trim() || null,
  };
}

function latestEvent(events: ParcelDeliveryEvent[] | undefined): CanonicalParcelEvent | null {
  if (!events?.length) return null;
  const sorted = events.map(normalizeEvent).sort((left, right) => {
    const dateOrder = right.occurredAt.localeCompare(left.occurredAt);
    return dateOrder || stableJson(left).localeCompare(stableJson(right));
  });
  return sorted[0] ?? null;
}

export function normalizeDelivery(
  delivery: ParcelDelivery,
  observedAt: string
): ParcelObservation {
  const semantic = {
    parcelKey: parcelKey(delivery.carrier_code, delivery.tracking_number),
    carrierCode: delivery.carrier_code.trim().toLowerCase(),
    trackingNumber: delivery.tracking_number.trim(),
    description: delivery.description.trim(),
    statusCode: delivery.status_code,
    expectedAt: delivery.date_expected ?? null,
    expectedEndAt: delivery.date_expected_end ?? null,
    latestEvent: latestEvent(delivery.events),
  };
  return {
    ...semantic,
    observedAt,
    observationHash: stableId("observation", semantic),
  };
}
