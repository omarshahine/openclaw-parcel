/**
 * OpenClaw plugin entry for Parcel package tracking.
 *
 * Registers 6 individual tools for delivery management:
 * - parcel_list, parcel_add (API-based)
 * - parcel_edit, parcel_remove (browser-based)
 * - parcel_carriers, parcel_status_codes (static reference)
 */

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

// OpenClaw plugin types

interface TextContent {
  type: "text";
  text: string;
}

interface OpenClawToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
    onUpdate?: (partialResult: unknown) => void
  ) => Promise<{ content: TextContent[]; details?: unknown }>;
}

interface SecretRef {
  source: "env" | "file" | "exec";
  provider: string;
  id: string;
}

interface PluginConfig {
  apiKey?: string | SecretRef;
}

interface OpenClawPluginToolContext {
  config?: Record<string, unknown>;
  workspaceDir?: string;
  agentId?: string;
  sessionKey?: string;
}

type OpenClawPluginToolFactory = (
  ctx: OpenClawPluginToolContext
) => OpenClawToolDefinition | OpenClawToolDefinition[] | null | undefined;

interface OpenClawContext {
  config?: PluginConfig;
  pluginConfig?: PluginConfig;
  registerTool(toolOrFactory: OpenClawToolDefinition | OpenClawPluginToolFactory): void;
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
function toToolResult(result: Record<string, unknown>): { content: TextContent[] } {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

function errorResult(message: string): { content: TextContent[] } {
  return toToolResult({ success: false, error: message });
}

export default function activate(context: OpenClawContext): void {
  const config = context.config || context.pluginConfig;

  // Helper: get API client or return error
  function getApiClient(): ParcelAPIClient | null {
    const apiKey = resolveApiKey(config);
    return apiKey ? new ParcelAPIClient(apiKey) : null;
  }

  // --- parcel_list ---
  context.registerTool((_ctx: OpenClawPluginToolContext) => ({
    name: "parcel_list",
    label: "Parcel List",
    description:
      "List active and recent package deliveries from Parcel. Returns tracking info, status, carrier, and estimated delivery dates.",
    parameters: listSchema as Record<string, unknown>,
    async execute(_toolCallId, params) {
      const client = getApiClient();
      if (!client) return errorResult("No Parcel API key configured.");
      try {
        return toToolResult(await handleList(params as { include_delivered?: boolean; limit?: number }, client));
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
    },
  }));

  // --- parcel_add ---
  context.registerTool((_ctx: OpenClawPluginToolContext) => ({
    name: "parcel_add",
    label: "Parcel Add",
    description:
      "Add a new package to Parcel for tracking. Requires tracking number, carrier code, and description. Use parcel_carriers to look up carrier codes.",
    parameters: addSchema as Record<string, unknown>,
    async execute(_toolCallId, params) {
      const client = getApiClient();
      if (!client) return errorResult("No Parcel API key configured.");
      try {
        return toToolResult(await handleAdd(params as { tracking_number: string; carrier_code: string; description: string }, client));
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
    },
  }));

  // --- parcel_edit ---
  context.registerTool((_ctx: OpenClawPluginToolContext) => ({
    name: "parcel_edit",
    label: "Parcel Edit",
    description:
      "Edit a delivery's description on web.parcelapp.net. Returns browser automation instructions for OpenClaw's browser tool.",
    parameters: editSchema as Record<string, unknown>,
    async execute(_toolCallId, params) {
      try {
        return toToolResult(handleEdit(params as { tracking_number: string; description: string }));
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
    },
  }));

  // --- parcel_remove ---
  context.registerTool((_ctx: OpenClawPluginToolContext) => ({
    name: "parcel_remove",
    label: "Parcel Remove",
    description:
      "Remove a delivery from Parcel on web.parcelapp.net. Returns browser automation instructions for OpenClaw's browser tool.",
    parameters: removeSchema as Record<string, unknown>,
    async execute(_toolCallId, params) {
      try {
        return toToolResult(handleRemove(params as { tracking_number: string }));
      } catch (e: unknown) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
    },
  }));

  // --- parcel_carriers ---
  context.registerTool((_ctx: OpenClawPluginToolContext) => ({
    name: "parcel_carriers",
    label: "Parcel Carriers",
    description:
      "List supported carrier codes for adding deliveries to Parcel (ups, fedex, usps, dhl, amazon, etc.).",
    parameters: carriersSchema as Record<string, unknown>,
    async execute() {
      return toToolResult(handleCarriers());
    },
  }));

  // --- parcel_status_codes ---
  context.registerTool((_ctx: OpenClawPluginToolContext) => ({
    name: "parcel_status_codes",
    label: "Parcel Status Codes",
    description:
      "Reference for Parcel delivery status codes and their meanings (0=Delivered, 2=In transit, etc.).",
    parameters: statusCodesSchema as Record<string, unknown>,
    async execute() {
      return toToolResult(handleStatusCodes());
    },
  }));
}
