# openclaw-parcel

OpenClaw plugin for [Parcel](https://parcelapp.net) package delivery tracking.

Track, add, edit, and remove package deliveries through a single consolidated tool.

## Install

```bash
openclaw plugins install openclaw-parcel
```

## Configuration

The plugin requires a **Parcel API Key**. Get yours from:

1. Open the Parcel app on your Mac
2. Go to Settings > Integrations
3. Enable API access and copy your API key

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

## Usage

The plugin registers a single `parcel` tool with these actions:

### List deliveries

```
parcel { action: "list" }
parcel { action: "list", include_delivered: false }
parcel { action: "list", limit: 10 }
```

### Add a delivery

```
parcel { action: "add", tracking_number: "1Z999AA10123456784", carrier_code: "ups", description: "New headphones" }
```

### Edit a delivery (via browser)

```
parcel { action: "edit", tracking_number: "1Z999AA10123456784", description: "Updated name" }
```

Returns browser automation instructions. The LLM uses OpenClaw's built-in browser tool to execute the edit on web.parcelapp.net.

### Remove a delivery (via browser)

```
parcel { action: "remove", tracking_number: "1Z999AA10123456784" }
```

Returns browser automation instructions. The LLM uses OpenClaw's built-in browser tool to execute the removal on web.parcelapp.net.

### Reference data

```
parcel { action: "carriers" }
parcel { action: "status_codes" }
```

## Architecture

- **List/Add**: Direct REST API calls to `https://api.parcel.app/external`
- **Edit/Remove**: Returns structured browser instructions with `requires_browser: true`; the LLM uses OpenClaw's native browser tool to execute them on `web.parcelapp.net`
- Zero external dependencies beyond TypeScript (no Playwright or browser binaries)

## Rate Limits

- List: ~20 requests/hour
- Add: ~20 requests/day
- Edit/Remove: Browser-based, no API limit

## License

MIT
