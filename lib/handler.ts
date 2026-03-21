/**
 * Handler functions for each parcel tool.
 *
 * API tools (list, add) call the Parcel REST API directly.
 * Browser tools (edit, remove) return instructions for OpenClaw's browser tool.
 * Reference tools (carriers, status_codes) return static data.
 */

import type { ParcelAPIClient } from "./api-client.js";
import type { HandlerResult, FormattedDelivery } from "./types.js";
import { CARRIERS, STATUS_CODES } from "./carriers.js";

interface ListArgs {
  include_delivered?: boolean;
  limit?: number;
}

interface AddArgs {
  tracking_number: string;
  carrier_code: string;
  description: string;
}

interface EditArgs {
  tracking_number: string;
  description: string;
}

interface RemoveArgs {
  tracking_number: string;
}

export async function handleList(
  args: ListArgs,
  apiClient: ParcelAPIClient
): Promise<HandlerResult> {
  const response = await apiClient.getDeliveries();

  if (!response.success) {
    return { success: false, error: response.error_message || "Unknown error" };
  }

  let deliveries = response.deliveries;
  const includeDelivered = args.include_delivered !== false;
  const limit = args.limit ?? 50;

  if (!includeDelivered) {
    deliveries = deliveries.filter((d) => d.status_code !== 0);
  }

  deliveries = deliveries.slice(0, limit);

  const formatted: FormattedDelivery[] = deliveries.map((d) => ({
    tracking_number: d.tracking_number,
    carrier: d.carrier_code,
    carrier_name: CARRIERS[d.carrier_code] || d.carrier_code,
    description: d.description || "No description",
    status_code: d.status_code,
    status: STATUS_CODES[d.status_code] || "Unknown",
    date_expected: d.date_expected || null,
    latest_event: d.events?.[0] || null,
  }));

  return {
    success: true,
    count: formatted.length,
    deliveries: formatted,
  };
}

export async function handleAdd(
  args: AddArgs,
  apiClient: ParcelAPIClient
): Promise<HandlerResult> {
  const result = await apiClient.addDelivery(
    args.tracking_number,
    args.carrier_code,
    args.description
  );

  if (!result.success) {
    return { success: false, error: result.error_message || "Failed to add delivery" };
  }

  return {
    success: true,
    message: `Added delivery: ${args.tracking_number} (${args.carrier_code}) - ${args.description}`,
    tracking_number: args.tracking_number,
    carrier_code: args.carrier_code,
    description: args.description,
  };
}

/**
 * Returns browser automation instructions for editing a delivery.
 */
export function handleEdit(args: EditArgs): HandlerResult {
  return {
    success: true,
    requires_browser: true,
    url: "https://web.parcelapp.net",
    tracking_number: args.tracking_number,
    new_description: args.description,
    instructions: [
      "Navigate to https://web.parcelapp.net",
      "If not logged in, sign in with the user's Parcel credentials",
      `Find the delivery with tracking number "${args.tracking_number}" in the delivery list`,
      "Click on the delivery to open it, or click the edit button",
      `Update the shipment name/description to "${args.description}"`,
      "Save the changes",
      "Confirm the update was successful",
    ],
    message: `Use the browser tool to edit delivery ${args.tracking_number} on web.parcelapp.net. Update the description to "${args.description}".`,
  };
}

/**
 * Returns browser automation instructions for removing a delivery.
 */
export function handleRemove(args: RemoveArgs): HandlerResult {
  return {
    success: true,
    requires_browser: true,
    url: "https://web.parcelapp.net",
    tracking_number: args.tracking_number,
    instructions: [
      "Navigate to https://web.parcelapp.net",
      "If not logged in, sign in with the user's Parcel credentials",
      `Find the delivery with tracking number "${args.tracking_number}" in the delivery list`,
      "Click on the delivery to open it",
      "Click the delete/remove button",
      "Confirm the deletion when prompted",
      "Verify the delivery has been removed from the list",
    ],
    message: `Use the browser tool to remove delivery ${args.tracking_number} from web.parcelapp.net.`,
  };
}

export function handleCarriers(): HandlerResult {
  const carrierList = Object.entries(CARRIERS).map(([code, name]) => ({
    code,
    name,
  }));

  return {
    success: true,
    count: carrierList.length,
    carriers: carrierList,
    note: "Use the code when adding deliveries. This is a subset of 450+ supported carriers.",
  };
}

export function handleStatusCodes(): HandlerResult {
  const statusList = Object.entries(STATUS_CODES).map(([code, meaning]) => ({
    code: Number(code),
    meaning,
  }));

  return {
    success: true,
    status_codes: statusList,
  };
}
