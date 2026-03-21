/**
 * Parcel HTTP API client.
 *
 * Wraps the Parcel REST API at https://api.parcel.app/external.
 * Handles authentication, error checking, and response parsing.
 */

import type {
  ParcelDeliveriesResponse,
  ParcelAddDeliveryResponse,
} from "./types.js";

const PARCEL_API_BASE = "https://api.parcel.app/external";

export class ParcelAPIClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetch all deliveries from Parcel.
   */
  async getDeliveries(): Promise<ParcelDeliveriesResponse> {
    return this.request("/deliveries/") as Promise<ParcelDeliveriesResponse>;
  }

  /**
   * Add a new delivery to track.
   *
   * Rate limit: ~20 requests/day.
   */
  async addDelivery(
    trackingNumber: string,
    carrierCode: string,
    description: string
  ): Promise<ParcelAddDeliveryResponse> {
    return this.request("/add-delivery/", "POST", {
      tracking_number: trackingNumber,
      carrier_code: carrierCode.toLowerCase(),
      description: description || "Package",
    }) as Promise<ParcelAddDeliveryResponse>;
  }

  private async request(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body?: unknown
  ): Promise<unknown> {
    const url = `${PARCEL_API_BASE}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Parcel API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }
}
