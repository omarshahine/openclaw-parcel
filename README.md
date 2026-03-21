# openclaw-parcel

OpenClaw plugin for [Parcel](https://parcelapp.net) package delivery tracking.

## Install

```bash
openclaw plugins install openclaw-parcel
```

## Configuration

The plugin requires a **Parcel API Key** for list and add operations. Get yours from the Parcel macOS app: Settings > Integrations > Enable API access.

### Option A: Environment variable with `.env` file (recommended)

```bash
# Add to ~/.openclaw/.env (chmod 600)
PARCEL_API_KEY=your-api-key

# Reference via env interpolation in config
openclaw config set plugins.entries.openclaw-parcel.config.apiKey '${PARCEL_API_KEY}'
```

### Option B: SecretRef object (env source)

The plugin's `apiKey` config field accepts a SecretRef object directly:

```bash
# Set PARCEL_API_KEY in your environment or ~/.openclaw/.env
openclaw config set plugins.entries.openclaw-parcel.config.apiKey \
  '{"source":"env","provider":"env","id":"PARCEL_API_KEY"}' --strict-json
```

### Option C: SecretRef object (exec source, macOS Keychain)

```bash
# Store key in Keychain
security add-generic-password -s 'env/PARCEL_API_KEY' -a "$USER" -w 'your-api-key'

# Configure SecretRef to read from Keychain
openclaw config set plugins.entries.openclaw-parcel.config.apiKey \
  '{"source":"exec","provider":"keychain","id":"env/PARCEL_API_KEY"}' --strict-json
```

### Option D: Interactive setup

```bash
openclaw secrets configure
```

See [OpenClaw Secrets Management](https://docs.openclaw.ai/gateway/secrets) for full documentation.

### Plaintext fallback

The plugin also resolves the API key from these sources (checked in order):

| Source | Details |
|--------|---------|
| Plugin config (string) | `plugins.entries.openclaw-parcel.config.apiKey` |
| Plugin config (SecretRef) | Resolved via env, file, or exec provider |
| Env var | `PARCEL_API_KEY` |
| macOS Keychain | `env/PARCEL_API_KEY` |

## Tools

### parcel_list

List active and recent deliveries with status filtering.

```
parcel_list {}
parcel_list { include_delivered: false }
parcel_list { limit: 10 }
```

### parcel_add

Add a new package to track. Use `parcel_carriers` to look up carrier codes.

```
parcel_add { tracking_number: "1Z999AA10123456784", carrier_code: "ups", description: "New headphones" }
```

### parcel_edit

Edit a delivery's description via browser automation on web.parcelapp.net.

```
parcel_edit { tracking_number: "1Z999AA10123456784", description: "Updated name" }
```

### parcel_remove

Remove a delivery via browser automation on web.parcelapp.net.

```
parcel_remove { tracking_number: "1Z999AA10123456784" }
```

### parcel_carriers

List supported carrier codes.

```
parcel_carriers {}
```

### parcel_status_codes

Reference for delivery status codes and their meanings.

```
parcel_status_codes {}
```

## Architecture

- **parcel_list / parcel_add**: Direct REST API calls to `https://api.parcel.app/external`
- **parcel_edit / parcel_remove**: Returns browser instructions with `requires_browser: true` for OpenClaw's browser tool
- **parcel_carriers / parcel_status_codes**: Static reference data, no network calls

## Rate Limits

- parcel_list: ~20 requests/hour
- parcel_add: ~20 requests/day
- parcel_edit / parcel_remove: Browser-based, no API limit

## License

MIT
