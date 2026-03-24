/**
 * OpenClaw plugin entry for Parcel package tracking.
 *
 * Registers 6 individual tools for delivery management:
 * - parcel_list, parcel_add (API-based)
 * - parcel_edit, parcel_remove (browser-based)
 * - parcel_carriers, parcel_status_codes (static reference)
 */

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { ParcelAPIClient } from "../lib/api-client.js";
import {
  listSchema,
  addSchema,
  editSchema,
  removeSchema,
  carriersSchema,
  statusCodesSchema,
} from "../lib/schema.js";
import {
  handleList,
  handleAdd,
  handleEdit,
  handleRemove,
  handleCarriers,
  handleStatusCodes,
} from "../lib/handler.js";
import { execFileSync } from "child_process";

interface SecretRef {
  source: "env" | "file" | "exec";
  provider: string;
  id: string;
}

interface PluginConfig {
  apiKey?: string | SecretRef;
}

function keychainLookup(service: string): string | undefined {
  try {
    return execFileSync(
      "security",
      ["find-generic-password", "-s", service, "-w"],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim() || undefined;
  } catch {
    return undefined;
  }
}

function isSecretRef(value: unknown): value is SecretRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "source" in value &&
    "provider" in value &&
    "id" in value
  );
}

function resolveSecretRef(ref: SecretRef): string | undefined {
  switch (ref.source) {
    case "env":
      return process.env[ref.id] || undefined;
    case "exec":
      if (ref.provider === "keychain" || ref.provider === "security") {
        return keychainLookup(ref.id);
      }
      return undefined;
    default:
      return undefined;
  }
}

function resolveApiKey(config?: PluginConfig): string | undefined {
  const configValue = config?.apiKey;
  if (isSecretRef(configValue)) {
    const resolved = resolveSecretRef(configValue);
    if (resolved) return resolved;
  }
  if (typeof configValue === "string" && configValue) return configValue;
  if (process.env.PARCEL_API_KEY) return process.env.PARCEL_API_KEY;
  return keychainLookup("env/PARCEL_API_KEY");
}

/** Helper to wrap a handler result as tool output. */
function toolResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    details: undefined,
  };
}

function toToolResult(result: Record<string, unknown>) {
  return toolResult(JSON.stringify(result, null, 2));
}

function errorResult(message: string) {
  return toToolResult({ success: false, error: message });
}

export default definePluginEntry({
  id: "parcel-cli",
  name: "Parcel",
  description: "Track, add, edit, and remove package deliveries via the Parcel app",

  register(api) {
    const config = api.pluginConfig as PluginConfig | undefined;

    // Helper: get API client or return error
    function getApiClient(): ParcelAPIClient | null {
      const apiKey = resolveApiKey(config);
      return apiKey ? new ParcelAPIClient(apiKey) : null;
    }

    // --- parcel_list ---
    api.registerTool({
      name: "parcel_list",
      label: "parcel_list",
      description:
        "List active and recent package deliveries from Parcel. Returns tracking info, status, carrier, and estimated delivery dates.",
      parameters: listSchema,
      async execute(_toolCallId: string, params: Record<string, unknown>) {
        const client = getApiClient();
        if (!client) return errorResult("No Parcel API key configured.");
        try {
          return toToolResult(await handleList(params as { include_delivered?: boolean; limit?: number }, client));
        } catch (e: unknown) {
          return errorResult(e instanceof Error ? e.message : String(e));
        }
      },
    });

    // --- parcel_add ---
    api.registerTool({
      name: "parcel_add",
      label: "parcel_add",
      description:
        "Add a new package to Parcel for tracking. Requires tracking number, carrier code, and description. Use parcel_carriers to look up carrier codes.",
      parameters: addSchema,
      async execute(_toolCallId: string, params: Record<string, unknown>) {
        const client = getApiClient();
        if (!client) return errorResult("No Parcel API key configured.");
        try {
          return toToolResult(await handleAdd(params as { tracking_number: string; carrier_code: string; description: string }, client));
        } catch (e: unknown) {
          return errorResult(e instanceof Error ? e.message : String(e));
        }
      },
    });

    // --- parcel_edit ---
    api.registerTool({
      name: "parcel_edit",
      label: "parcel_edit",
      description:
        "Edit a delivery's description on web.parcelapp.net. Returns browser automation instructions for OpenClaw's browser tool.",
      parameters: editSchema,
      async execute(_toolCallId: string, params: Record<string, unknown>) {
        try {
          return toToolResult(handleEdit(params as { tracking_number: string; description: string }));
        } catch (e: unknown) {
          return errorResult(e instanceof Error ? e.message : String(e));
        }
      },
    });

    // --- parcel_remove ---
    api.registerTool({
      name: "parcel_remove",
      label: "parcel_remove",
      description:
        "Remove a delivery from Parcel on web.parcelapp.net. Returns browser automation instructions for OpenClaw's browser tool.",
      parameters: removeSchema,
      async execute(_toolCallId: string, params: Record<string, unknown>) {
        try {
          return toToolResult(handleRemove(params as { tracking_number: string }));
        } catch (e: unknown) {
          return errorResult(e instanceof Error ? e.message : String(e));
        }
      },
    });

    // --- parcel_carriers ---
    api.registerTool({
      name: "parcel_carriers",
      label: "parcel_carriers",
      description:
        "List supported carrier codes for adding deliveries to Parcel (ups, fedex, usps, dhl, amazon, etc.).",
      parameters: carriersSchema,
      async execute() {
        return toToolResult(handleCarriers());
      },
    });

    // --- parcel_status_codes ---
    api.registerTool({
      name: "parcel_status_codes",
      label: "parcel_status_codes",
      description:
        "Reference for Parcel delivery status codes and their meanings (0=Delivered, 2=In transit, etc.).",
      parameters: statusCodesSchema,
      async execute() {
        return toToolResult(handleStatusCodes());
      },
    });
  },
});
