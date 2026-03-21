/**
 * OpenClaw plugin entry for Parcel package tracking.
 *
 * Registers a single consolidated `parcel` tool with actions for
 * listing, adding, editing, and removing deliveries.
 *
 * API operations (list, add) use the Parcel REST API directly.
 * Browser operations (edit, remove) return instructions for
 * OpenClaw's built-in browser tool to execute.
 */

import { ParcelAPIClient } from "../lib/api-client.js";
import { parcelSchema } from "../lib/schema.js";
import { handleParcel } from "../lib/handler.js";
import { execFileSync } from "child_process";

// OpenClaw plugin types (matching pi-agent-core conventions)

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

interface PluginConfig {
  apiKey?: string;
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

/**
 * Try to read a secret from the macOS Keychain.
 * Returns undefined if not found or not on macOS.
 */
function keychainLookup(service: string): string | undefined {
  try {
    const result = execFileSync(
      "security",
      ["find-generic-password", "-s", service, "-w"],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
    return result || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve API key using priority chain:
 * 1. OpenClaw config (set during plugin setup)
 * 2. PARCEL_API_KEY environment variable
 * 3. macOS Keychain entry "env/PARCEL_API_KEY"
 */
function resolveApiKey(config?: PluginConfig): string | undefined {
  return (
    config?.apiKey ||
    process.env.PARCEL_API_KEY ||
    keychainLookup("env/PARCEL_API_KEY")
  );
}

/**
 * OpenClaw plugin activation function.
 * Called by the OpenClaw gateway when the plugin is loaded.
 *
 * API key is resolved lazily at tool call time (not here) because
 * OpenClaw may call activate() during plugin discovery before the
 * full config is available.
 */
export default function activate(context: OpenClawContext): void {
  // Store config reference; actual key resolution happens in execute()
  const config = context.config || context.pluginConfig;

  context.registerTool((_ctx: OpenClawPluginToolContext) => ({
    name: "parcel",
    label: "Parcel Tracking",
    description:
      "Manage package deliveries via Parcel. Actions: list (get deliveries with status filtering), add (track new package), edit (update description via browser), remove (delete via browser), carriers (list carrier codes), status_codes (status reference).",
    parameters: parcelSchema as Record<string, unknown>,

    async execute(
      _toolCallId: string,
      params: Record<string, unknown>,
      _signal?: AbortSignal,
      _onUpdate?: (partialResult: unknown) => void
    ) {
      if (typeof params.action !== "string" || !params.action) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: false, error: "Missing required 'action' parameter" },
                null,
                2
              ),
            },
          ],
        };
      }

      // Static actions don't need an API key
      if (params.action === "carriers" || params.action === "status_codes") {
        try {
          const result = await handleParcel(
            params as { action: string; [key: string]: unknown },
            null as unknown as ParcelAPIClient
          );
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(result, null, 2) },
            ],
          };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ success: false, error: message }, null, 2),
              },
            ],
          };
        }
      }

      // Browser actions don't need an API key either
      if (params.action === "edit" || params.action === "remove") {
        try {
          const result = await handleParcel(
            params as { action: string; [key: string]: unknown },
            null as unknown as ParcelAPIClient
          );
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(result, null, 2) },
            ],
          };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ success: false, error: message }, null, 2),
              },
            ],
          };
        }
      }

      // API actions (list, add) need an API key
      const apiKey = resolveApiKey(config);
      if (!apiKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  error:
                    "No Parcel API key found. Set it via: openclaw config set plugins.entries.openclaw-parcel.config.apiKey YOUR_KEY",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const apiClient = new ParcelAPIClient(apiKey);

      try {
        const result = await handleParcel(
          params as { action: string; [key: string]: unknown },
          apiClient
        );

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: false, error: message }, null, 2),
            },
          ],
        };
      }
    },
  }));
}
