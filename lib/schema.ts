/**
 * Tool parameter schemas for individual parcel tools.
 *
 * Each tool has its own focused schema with explicit required fields.
 */

export const listSchema = {
  type: "object",
  properties: {
    include_delivered: {
      type: "boolean",
      description: "Include delivered packages in results (default: true)",
    },
    limit: {
      type: "number",
      description: "Maximum number of deliveries to return (default: 50)",
    },
  },
} as const;

export const addSchema = {
  type: "object",
  properties: {
    tracking_number: {
      type: "string",
      description: "Tracking number from the carrier",
    },
    carrier_code: {
      type: "string",
      description:
        "Carrier code e.g. ups, fedex, usps, dhl, amazon. Use parcel_carriers to see all codes.",
    },
    description: {
      type: "string",
      description: "Package description e.g. 'Amazon order - headphones'",
    },
  },
  required: ["tracking_number", "carrier_code", "description"],
} as const;

export const editSchema = {
  type: "object",
  properties: {
    tracking_number: {
      type: "string",
      description: "Tracking number of the delivery to edit",
    },
    description: {
      type: "string",
      description: "New description for the delivery",
    },
  },
  required: ["tracking_number", "description"],
} as const;

export const removeSchema = {
  type: "object",
  properties: {
    tracking_number: {
      type: "string",
      description: "Tracking number of the delivery to remove",
    },
  },
  required: ["tracking_number"],
} as const;

export const carriersSchema = {
  type: "object",
  properties: {},
} as const;

export const statusCodesSchema = {
  type: "object",
  properties: {},
} as const;
