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

## Tool: `parcel`

Single tool with 6 actions:

| Action | Method | Required Params |
|--------|--------|-----------------|
| `list` | API | none (optional: `include_delivered`, `limit`) |
| `add` | API | `tracking_number`, `carrier_code`, `description` |
| `edit` | Browser | `tracking_number`, `description` |
| `remove` | Browser | `tracking_number` |
| `carriers` | Static | none |
| `status_codes` | Static | none |

## Browser Actions (edit/remove)

The `edit` and `remove` actions return structured instructions with `requires_browser: true`. When you receive this response, use OpenClaw's built-in browser tool to:

1. Navigate to `https://web.parcelapp.net`
2. Log in if needed (ask user for credentials if not already known)
3. Follow the step-by-step instructions in the response
4. Report back the result

## Rate Limits

- **List**: ~20 requests/hour
- **Add**: ~20 requests/day
- **Edit/Remove**: Browser-based, no API rate limit

## Common Carrier Codes

| Code | Carrier |
|------|---------|
| `ups` | UPS |
| `fedex` | FedEx |
| `usps` | USPS |
| `dhl` | DHL |
| `amazon` | Amazon Logistics |
| `ontrac` | OnTrac |
| `lasership` | LaserShip |
| `pholder` | Placeholder (manual) |

Use `action: "carriers"` for the full list.

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

Requires a **Parcel API key** (set during install or via env var `PARCEL_API_KEY`).

API key source: Parcel macOS app → Settings → Integrations → Enable API access.

## Architecture

- **list/add**: Direct REST API calls to `https://api.parcel.app/external` (fast, reliable)
- **edit/remove**: Returns browser instructions; the LLM uses OpenClaw's browser tool to execute them on `web.parcelapp.net`
- No Playwright or browser dependencies bundled; leverages OpenClaw's native browser capability
