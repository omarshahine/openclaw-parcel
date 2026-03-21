/**
 * Parcel API response types.
 *
 * Based on the Parcel API at https://api.parcel.app/external
 */

export interface ParcelDeliveryEvent {
  event: string;
  date: string;
  location?: string;
}

export interface ParcelDelivery {
  carrier_code: string;
  description: string;
  status_code: number;
  tracking_number: string;
  extra_information?: string;
  date_expected?: string;
  date_expected_end?: string;
  events?: ParcelDeliveryEvent[];
}

export interface ParcelDeliveriesResponse {
  success: boolean;
  error_message?: string;
  deliveries: ParcelDelivery[];
}

export interface ParcelAddDeliveryResponse {
  success: boolean;
  error_message?: string;
}

/** Formatted delivery for tool output. */
export interface FormattedDelivery {
  tracking_number: string;
  carrier: string;
  carrier_name: string;
  description: string;
  status_code: number;
  status: string;
  date_expected: string | null;
  latest_event: ParcelDeliveryEvent | null;
}

/** Result shape returned by all handler actions. */
export interface HandlerResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}
