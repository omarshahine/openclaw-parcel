/**
 * Common carrier codes supported by the Parcel API.
 *
 * The API supports 450+ carriers total. These are the most commonly used ones.
 * Use the full list from the Parcel app for less common carriers.
 */

export const CARRIERS: Record<string, string> = {
  ups: "UPS",
  fedex: "FedEx",
  usps: "USPS",
  dhl: "DHL",
  "dhl-express": "DHL Express",
  ontrac: "OnTrac",
  lasership: "LaserShip",
  amazon: "Amazon Logistics",
  amzlus: "Amazon US",
  cdl: "CDL Last Mile",
  "ups-mi": "UPS Mail Innovations",
  "fedex-smartpost": "FedEx SmartPost",
  "dhl-global-mail": "DHL Global Mail",
  newgistics: "Newgistics/Pitney Bowes",
  veho: "Veho",
  "ups-surepost": "UPS SurePost",
  pholder: "Placeholder (manual tracking)",
};

export const STATUS_CODES: Record<number, string> = {
  0: "Delivered",
  1: "Attempted delivery",
  2: "In transit",
  3: "Out for delivery",
  4: "Info received / Label created",
  5: "Exception / Problem",
  6: "Expired / Unknown",
};
