/**
 * Action dispatcher for the consolidated parcel tool.
 *
 * Routes each action to the appropriate method:
 * - list/add: Direct Parcel REST API calls
 * - edit/remove: Returns browser automation instructions for OpenClaw's browser tool
 * - carriers/status_codes: Static reference data
 */

import type { ParcelAPIClient } from "./api-client.js";
import type { HandlerResult, FormattedDelivery } from "./types.js";
import { CARRIERS, STATUS_CODES } from "./carriers.js";

interface ParcelArgs {
  action: string;
  include_delivered?: boolean;
  limit?: number;
  tracking_number?: string;
  carrier_code?: string;
  description?: string;
  [key: string]: unknown;
}

export async function handleParcel(
  args: ParcelArgs,
  apiClient: ParcelAPIClient
): Promise<HandlerResult> {
  switch (args.action) {
    case "list":
      return handleList(args, apiClient);
    case "add":
      return handleAdd(args, apiClient);
    case "edit":
      return handleEdit(args);
    case "remove":
      return handleRemove(args);
    case "carriers":
      return handleCarriers();
    case "status_codes":
      return handleStatusCodes();
    default:
      return { success: false, error: `Unknown action: ${args.action}` };
  }
}

async function handleList(
  args: ParcelArgs,
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

async function handleAdd(
  args: ParcelArgs,
  apiClient: ParcelAPIClient
): Promise<HandlerResult> {
  if (!args.tracking_number) {
    return { success: false, error: "tracking_number is required for add action" };
  }
  if (!args.carrier_code) {
    return { success: false, error: "carrier_code is required for add action" };
  }
  if (!args.description) {
    return { success: false, error: "description is required for add action" };
  }

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
 * The LLM should use OpenClaw's browser tool to execute these steps.
 */
function handleEdit(args: ParcelArgs): HandlerResult {
  if (!args.tracking_number) {
    return { success: false, error: "tracking_number is required for edit action" };
  }
  if (!args.description) {
    return { success: false, error: "description is required for edit action" };
  }

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
 * The LLM should use OpenClaw's browser tool to execute these steps.
 */
function handleRemove(args: ParcelArgs): HandlerResult {
  if (!args.tracking_number) {
    return { success: false, error: "tracking_number is required for remove action" };
  }

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

function handleCarriers(): HandlerResult {
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

function handleStatusCodes(): HandlerResult {
  const statusList = Object.entries(STATUS_CODES).map(([code, meaning]) => ({
    code: Number(code),
    meaning,
  }));

  return {
    success: true,
    status_codes: statusList,
  };
}
