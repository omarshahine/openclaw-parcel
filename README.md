# openclaw-parcel

OpenClaw plugin for [Parcel](https://parcelapp.net) package delivery tracking.

Track, add, edit, and remove package deliveries through a single consolidated tool.

## Install

```bash
openclaw plugins install openclaw-parcel
```

## Configuration

During setup, you'll be prompted for your **Parcel API Key**:

1. Open the Parcel app on your Mac
2. Go to Settings > Integrations
3. Enable API access and copy your API key

### Environment Variable Fallbacks

| Config Field | Env Var | Keychain Entry |
|-------------|---------|----------------|
| `apiKey` | `PARCEL_API_KEY` | `env/PARCEL_API_KEY` |

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
