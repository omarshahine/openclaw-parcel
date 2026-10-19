/**
 * Typed Parcel HTTP API client.
 *
 * The client deliberately does not retry: unsuccessful requests may consume
 * Parcel's rate limit. Callers can use retryAfterSeconds for scheduling.
 */

import type {
  ParcelAddDeliveryResponse,
  ParcelDeliveriesResponse,
  ParcelDelivery,
  ParcelDeliveryEvent,
} from "./types.js";

const PARCEL_API_BASE = "https://api.parcel.app/external";
const DEFAULT_TIMEOUT_MS = 15_000;

export type ParcelDeliveryFilter = "recent" | "active";

export interface ParcelAPIClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class ParcelAPIError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly responseBody?: string;

  constructor(
    message: string,
    options: { status: number; retryAfterSeconds?: number; responseBody?: string }
  ) {
    super(message);
    this.name = "ParcelAPIError";
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.responseBody = options.responseBody;
  }
}

export class ParcelAPIValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParcelAPIValidationError";
  }
}

export class ParcelAPITimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Parcel API request timed out after ${timeoutMs}ms`);
    this.name = "ParcelAPITimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new ParcelAPIValidationError(`Parcel API field ${field} must be a string`);
  }
  return value;
}

function parseEvent(value: unknown, index: number): ParcelDeliveryEvent {
  if (!isRecord(value)) {
    throw new ParcelAPIValidationError(`Parcel API event ${index} must be an object`);
  }
  if (typeof value.event !== "string" || typeof value.date !== "string") {
    throw new ParcelAPIValidationError(
      `Parcel API event ${index} must include string event and date fields`
    );
  }
  return {
    event: value.event,
    date: value.date,
    location: optionalString(value.location, `events[${index}].location`),
  };
}

function parseDelivery(value: unknown, index: number): ParcelDelivery {
  if (!isRecord(value)) {
    throw new ParcelAPIValidationError(`Parcel API delivery ${index} must be an object`);
  }
  const requiredStrings = ["carrier_code", "tracking_number"] as const;
  for (const field of requiredStrings) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      throw new ParcelAPIValidationError(
        `Parcel API delivery ${index} must include a non-empty ${field}`
      );
    }
  }
  if (!Number.isInteger(value.status_code)) {
    throw new ParcelAPIValidationError(
      `Parcel API delivery ${index} must include an integer status_code`
    );
  }
  if (value.events !== undefined && !Array.isArray(value.events)) {
    throw new ParcelAPIValidationError(`Parcel API delivery ${index} events must be an array`);
  }

  return {
    carrier_code: value.carrier_code as string,
    tracking_number: value.tracking_number as string,
    description: optionalString(value.description, `deliveries[${index}].description`) ?? "",
    status_code: value.status_code as number,
    extra_information: optionalString(
      value.extra_information,
      `deliveries[${index}].extra_information`
    ),
    date_expected: optionalString(value.date_expected, `deliveries[${index}].date_expected`),
    date_expected_end: optionalString(
      value.date_expected_end,
      `deliveries[${index}].date_expected_end`
    ),
    events: (value.events as unknown[] | undefined)?.map(parseEvent),
  };
}

function parseDeliveriesResponse(value: unknown): ParcelDeliveriesResponse {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    throw new ParcelAPIValidationError("Parcel API response must include boolean success");
  }
  if (!Array.isArray(value.deliveries)) {
    throw new ParcelAPIValidationError("Parcel API response must include deliveries array");
  }
  return {
    success: value.success,
    error_message: optionalString(value.error_message, "error_message"),
    deliveries: value.deliveries.map(parseDelivery),
  };
}

function parseAddResponse(value: unknown): ParcelAddDeliveryResponse {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    throw new ParcelAPIValidationError("Parcel API response must include boolean success");
  }
  return {
    success: value.success,
    error_message: optionalString(value.error_message, "error_message"),
  };
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return undefined;
}

export class ParcelAPIClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(apiKey: string, options: ParcelAPIClientOptions = {}) {
    if (!apiKey) throw new Error("Parcel API key is required");
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? PARCEL_API_BASE).replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Fetch recent deliveries, or only active deliveries for monitor polling. */
  async getDeliveries(
    filterMode: ParcelDeliveryFilter = "recent"
  ): Promise<ParcelDeliveriesResponse> {
    const query = filterMode === "active" ? "?filter_mode=active" : "";
    return parseDeliveriesResponse(await this.request(`/deliveries/${query}`));
  }

  /** Add a new delivery. Parcel documents a 20 requests/day limit. */
  async addDelivery(
    trackingNumber: string,
    carrierCode: string,
    description: string
  ): Promise<ParcelAddDeliveryResponse> {
    return parseAddResponse(
      await this.request("/add-delivery/", "POST", {
        tracking_number: trackingNumber,
        carrier_code: carrierCode.toLowerCase(),
        description: description || "Package",
      })
    );
  }

  private async request(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body?: unknown
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          "api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseBody = (await response.text()).slice(0, 2_000);
        throw new ParcelAPIError(`Parcel API returned HTTP ${response.status}`, {
          status: response.status,
          retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
          responseBody,
        });
      }

      try {
        return await response.json();
      } catch (error) {
        throw new ParcelAPIValidationError(
          `Parcel API returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } catch (error) {
      if (controller.signal.aborted) throw new ParcelAPITimeoutError(this.timeoutMs);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
