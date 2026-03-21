---
name: parcel-tracking
description: |
  Knowledge about Parcel package tracking operations.
  Use when:
  - User asks about package deliveries or tracking
  - User wants to add, edit, or remove a tracked package
  - User asks about carrier codes or delivery status meanings
  - User says "track a package", "check my deliveries", "add tracking"
---

# Parcel Tracking

Track package deliveries via the Parcel app API and web interface.

## Tools

| Tool | Description | Needs API Key |
|------|-------------|:---:|
| `parcel_list` | List active/recent deliveries with status filtering | Yes |
| `parcel_add` | Add new tracking number | Yes |
| `parcel_edit` | Update delivery description (via browser) | No |
| `parcel_remove` | Delete a delivery (via browser) | No |
| `parcel_carriers` | List supported carrier codes | No |
| `parcel_status_codes` | Status code reference | No |

## Browser Tools (edit/remove)

`parcel_edit` and `parcel_remove` return structured instructions with `requires_browser: true`. When you receive this response, use OpenClaw's built-in browser tool to:

1. Navigate to `https://web.parcelapp.net`
2. Log in if needed
3. Follow the step-by-step instructions in the response

## Rate Limits

- **parcel_list**: ~20 requests/hour
- **parcel_add**: ~20 requests/day
- **parcel_edit/remove**: Browser-based, no API rate limit

## Common Carrier Codes

| Code | Carrier |
|------|---------|
| `ups` | UPS |
| `fedex` | FedEx |
| `usps` | USPS |
| `dhl` | DHL |
| `amazon` | Amazon Logistics |
| `ontrac` | OnTrac |
| `pholder` | Placeholder (manual) |

## Status Codes

| Code | Meaning |
|------|---------|
| 0 | Delivered |
| 1 | Attempted delivery |
| 2 | In transit |
| 3 | Out for delivery |
| 4 | Info received / Label created |
| 5 | Exception / Problem |
| 6 | Expired / Unknown |

## Configuration

Requires a **Parcel API key** for list/add. Supports plain string, `${ENV_VAR}` interpolation, or SecretRef objects in plugin config.
