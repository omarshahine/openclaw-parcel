/**
 * Tool parameter schema for the consolidated `parcel` tool.
 *
 * Uses raw JSON Schema (not TypeBox) since OpenClaw accepts either format
 * and JSON Schema avoids a runtime dependency.
 */

export const parcelSchema = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "add", "edit", "remove", "carriers", "status_codes"],
      description:
        "Operation to perform: list (get deliveries), add (new tracking), edit (update description), remove (delete delivery), carriers (list carrier codes), status_codes (status reference)",
    },
    include_delivered: {
      type: "boolean",
      description: "Include delivered packages in list results (default: true)",
    },
    limit: {
      type: "number",
      description: "Maximum number of deliveries to return (default: 50)",
    },
    tracking_number: {
      type: "string",
      description: "Tracking number (required for add, edit, remove)",
    },
    carrier_code: {
      type: "string",
      description:
        "Carrier code e.g. ups, fedex, usps, dhl, amazon (required for add). Use carriers action to see all codes.",
    },
    description: {
      type: "string",
      description: "Package description (required for add, optional for edit)",
    },
  },
  required: ["action"],
} as const;
