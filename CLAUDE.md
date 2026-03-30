# openclaw-parcel

OpenClaw plugin for Parcel package delivery tracking. Published to ClawHub as `parcel-cli`.

## Project Structure

- `src/index.ts` — Plugin entry using `definePluginEntry` from OpenClaw SDK
- `lib/schema.ts` — TypeBox parameter schemas for all 6 tools
- `lib/handler.ts` — Tool handler implementations (API, browser, static)
- `lib/api-client.ts` — Parcel REST API client
- `lib/carriers.ts` — Static carrier and status code data
- `lib/types.ts` — TypeScript interfaces
- `skills/parcel-tracking/SKILL.md` — Skill definition for OpenClaw discovery
- `openclaw.plugin.json` — Plugin manifest (id: `parcel-cli`)
- `marketplace.json` — ClawHub marketplace metadata

## Publishing to ClawHub

### Prerequisites

- `clawhub` CLI installed: `npm install -g clawhub`
- Authenticated: `clawhub login` (browser OAuth flow)
- Verify: `clawhub whoami`
- `package.json` must have `openclaw.compat.pluginApi` and `openclaw.build.openclawVersion` fields

### Publish Script (preferred)

```bash
./publish-clawhub.sh --changelog "summary of changes"
```

The script extracts the version from `package.json`, gets the current git SHA, and calls `clawhub package publish` with all required flags. If `--changelog` is omitted, it prompts interactively.

### Manual Publish Command

```bash
clawhub package publish . \
  --family code-plugin \
  --name parcel-cli \
  --display-name Parcel \
  --version <version from package.json> \
  --changelog "<summary of changes>" \
  --tags "latest" \
  --source-repo omarshahine/openclaw-parcel \
  --source-commit $(git rev-parse HEAD) \
  --source-ref main
```

Both `--source-repo` and `--source-commit` are required together.

### Verify Publication

```bash
clawhub package inspect parcel-cli
```

### Install (end user)

```bash
openclaw plugins install parcel-cli
```

## SDK Patterns

- Entry point uses `definePluginEntry` from `openclaw/plugin-sdk/plugin-entry`
- Parameter schemas use `@sinclair/typebox` `Type.Object()` (not plain JSON Schema)
- Tool results must include `details: null` (not `undefined`, which `JSON.stringify` drops)
- `openclaw` is a `peerDependency` (provided by host runtime), not a regular dependency
- Tool `label` field should be human-readable (e.g. "Parcel List", not "parcel_list")
- Manifest `configSchema` must include `additionalProperties: false`
