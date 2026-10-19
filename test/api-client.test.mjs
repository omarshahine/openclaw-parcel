import assert from "node:assert/strict";
import test from "node:test";

import {
  ParcelAPIClient,
  ParcelAPIError,
  ParcelAPIValidationError,
} from "../dist/lib/api-client.js";
import { STATUS_CODES } from "../dist/lib/carriers.js";

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("active delivery requests use Parcel's active filter and validate data", async () => {
  let requestedUrl;
  const client = new ParcelAPIClient("test-key", {
    fetch: async (url) => {
      requestedUrl = String(url);
      return jsonResponse({
        success: true,
        deliveries: [
          {
            carrier_code: "ups",
            tracking_number: "SYNTHETIC-1",
            description: "Synthetic fixture",
            status_code: 4,
            events: [{ event: "Vehicle for delivery", date: "2026-01-02T12:00:00Z" }],
          },
        ],
      });
    },
  });

  const response = await client.getDeliveries("active");
  assert.match(requestedUrl, /\/deliveries\/\?filter_mode=active$/);
  assert.equal(response.deliveries[0].tracking_number, "SYNTHETIC-1");
});

test("HTTP errors preserve status and Retry-After without retrying", async () => {
  let calls = 0;
  const client = new ParcelAPIClient("test-key", {
    fetch: async () => {
      calls += 1;
      return new Response("rate limited", {
        status: 429,
        headers: { "retry-after": "120" },
      });
    },
  });

  await assert.rejects(
    client.getDeliveries(),
    (error) =>
      error instanceof ParcelAPIError &&
      error.status === 429 &&
      error.retryAfterSeconds === 120
  );
  assert.equal(calls, 1);
});

test("malformed successful responses fail validation", async () => {
  const client = new ParcelAPIClient("test-key", {
    fetch: async () => jsonResponse({ success: true, deliveries: [{}] }),
  });
  await assert.rejects(client.getDeliveries(), ParcelAPIValidationError);
});

test("status code reference matches Parcel's documented meanings", () => {
  assert.deepEqual(STATUS_CODES, {
    0: "Delivered",
    1: "Frozen",
    2: "In transit",
    3: "Pickup by recipient",
    4: "Out for delivery",
    5: "Not found",
    6: "Failed delivery attempt",
    7: "Exception",
    8: "Information received",
  });
});
