import {
  mkdir,
  open,
  readFile,
  rename,
  rmdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  MONITOR_STATE_SCHEMA_VERSION,
  createEmptyMonitorState,
  type MonitorState,
} from "./model.js";

export class MonitorStateCorruptError extends Error {
  readonly quarantinePath: string;

  constructor(message: string, quarantinePath: string) {
    super(message);
    this.name = "MonitorStateCorruptError";
    this.quarantinePath = quarantinePath;
  }
}

export class MonitorStateBusyError extends Error {
  constructor(message = "Parcel monitor state is locked by another process") {
    super(message);
    this.name = "MonitorStateBusyError";
  }
}

export interface StateRetention {
  inactiveParcelDays: number;
  changeDays: number;
  acknowledgedNotificationDays: number;
  unifiEventDays: number;
}

export const DEFAULT_RETENTION: StateRetention = {
  inactiveParcelDays: 180,
  changeDays: 365,
  acknowledgedNotificationDays: 90,
  unifiEventDays: 7,
};

function validateState(value: unknown): MonitorState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("state root must be an object");
  }
  const state = value as Partial<MonitorState>;
  if (state.schemaVersion !== MONITOR_STATE_SCHEMA_VERSION) {
    throw new Error(`unsupported schema version ${String(state.schemaVersion)}`);
  }
  if (
    typeof state.revision !== "number" ||
    typeof state.createdAt !== "string" ||
    typeof state.updatedAt !== "string" ||
    typeof state.baselineEstablished !== "boolean" ||
    !state.pollControl ||
    !Array.isArray(state.pollControl.requestAttempts) ||
    !state.parcels ||
    !state.changes ||
    !state.notifications ||
    !state.unifiEvents
  ) {
    throw new Error("state is missing required fields");
  }
  return state as MonitorState;
}

function olderThan(value: string | undefined, cutoffMs: number): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && parsed < cutoffMs;
}

export function applyRetention(
  state: MonitorState,
  now = new Date(),
  retention: StateRetention = DEFAULT_RETENTION
): MonitorState {
  const result = structuredClone(state);
  const dayMs = 86_400_000;
  for (const [key, parcel] of Object.entries(result.parcels)) {
    if (!parcel.active && olderThan(parcel.inactiveAt, now.getTime() - retention.inactiveParcelDays * dayMs)) {
      delete result.parcels[key];
    }
  }
  for (const [key, change] of Object.entries(result.changes)) {
    if (olderThan(change.occurredAt, now.getTime() - retention.changeDays * dayMs)) {
      delete result.changes[key];
    }
  }
  for (const [key, notification] of Object.entries(result.notifications)) {
    if (
      notification.status === "acknowledged" &&
      olderThan(
        notification.acknowledgedAt,
        now.getTime() - retention.acknowledgedNotificationDays * dayMs
      )
    ) {
      delete result.notifications[key];
    }
  }
  for (const [key, event] of Object.entries(result.unifiEvents)) {
    if (olderThan(event.expiresAt, now.getTime())) delete result.unifiEvents[key];
  }
  return result;
}

export class FileMonitorStateStore {
  readonly statePath: string;
  readonly lockPath: string;
  private readonly staleLockMs: number;

  constructor(stateDirectory: string, staleLockMs = 5 * 60_000) {
    this.statePath = join(stateDirectory, "monitor-state.v1.json");
    this.lockPath = join(stateDirectory, "monitor-state.v1.lock");
    this.staleLockMs = staleLockMs;
  }

  async load(): Promise<MonitorState> {
    try {
      return validateState(JSON.parse(await readFile(this.statePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return createEmptyMonitorState();
      const quarantinePath = `${this.statePath}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      try {
        await rename(this.statePath, quarantinePath);
      } catch {
        // Retain the intended quarantine path even if preservation itself fails.
      }
      throw new MonitorStateCorruptError(
        `Parcel monitor state is corrupt: ${error instanceof Error ? error.message : String(error)}`,
        quarantinePath
      );
    }
  }

  async save(state: MonitorState): Promise<MonitorState> {
    await mkdir(dirname(this.statePath), { recursive: true });
    const next = applyRetention(
      { ...state, revision: state.revision + 1 },
      new Date(state.updatedAt)
    );
    const temporaryPath = `${this.statePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
    const handle = await open(temporaryPath, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, this.statePath);
    const directory = await open(dirname(this.statePath), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
    return next;
  }

  async acquireLock(): Promise<() => Promise<void>> {
    await mkdir(dirname(this.lockPath), { recursive: true });
    try {
      await mkdir(this.lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const lockStat = await stat(this.lockPath);
      if (Date.now() - lockStat.mtimeMs <= this.staleLockMs) throw new MonitorStateBusyError();
      const stalePath = `${this.lockPath}.stale-${Date.now()}`;
      await rename(this.lockPath, stalePath);
      await mkdir(this.lockPath);
    }
    const ownerPath = join(this.lockPath, "owner.json");
    await writeFile(ownerPath, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }), {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    return async () => {
      try {
        await unlink(ownerPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await rmdir(this.lockPath);
    };
  }

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const release = await this.acquireLock();
    try {
      return await operation();
    } finally {
      await release();
    }
  }
}
