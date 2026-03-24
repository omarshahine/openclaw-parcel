/**
 * Tool parameter schemas for individual parcel tools.
 *
 * Uses TypeBox for SDK-compliant type-safe schemas.
 */

import { Type } from "@sinclair/typebox";

export const listSchema = Type.Object({
  include_delivered: Type.Optional(
    Type.Boolean({ description: "Include delivered packages in results (default: true)" })
  ),
  limit: Type.Optional(
    Type.Number({ description: "Maximum number of deliveries to return (default: 50)" })
  ),
});

export const addSchema = Type.Object({
  tracking_number: Type.String({ description: "Tracking number from the carrier" }),
  carrier_code: Type.String({
    description:
      "Carrier code e.g. ups, fedex, usps, dhl, amazon. Use parcel_carriers to see all codes.",
  }),
  description: Type.String({
    description: "Package description e.g. 'Amazon order - headphones'",
  }),
});

export const editSchema = Type.Object({
  tracking_number: Type.String({ description: "Tracking number of the delivery to edit" }),
  description: Type.String({ description: "New description for the delivery" }),
});

export const removeSchema = Type.Object({
  tracking_number: Type.String({ description: "Tracking number of the delivery to remove" }),
});

export const carriersSchema = Type.Object({});

export const statusCodesSchema = Type.Object({});
