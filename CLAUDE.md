# openclaw-parcel

OpenClaw plugin for Parcel package delivery tracking. Published to ClawHub as `openclaw-parcel` (renamed from `parcel-cli` in v2.0.0).

## Project Structure

- `src/index.ts` — Plugin entry using `definePluginEntry` from OpenClaw SDK
- `lib/schema.ts` — TypeBox parameter schemas for all 6 tools
- `lib/handler.ts` — Tool handler implementations (API, browser, static)
- `lib/api-client.ts` — Parcel REST API client
- `lib/carriers.ts` — Static carrier and status code data
- `lib/types.ts` — TypeScript interfaces
- `skills/parcel-tracking/SKILL.md` — Skill definition for OpenClaw discovery
- `openclaw.plugin.json` — Plugin manifest (id: `openclaw-parcel`)
- `marketplace.json` — ClawHub marketplace metadata

## Publishing to ClawHub

### Automated (CI)

Publishing is automated via GitHub Actions (`.github/workflows/publish-clawhub.yml`). To publish a new version:

```bash
# 1. Bump version in package.json
# 2. Commit and push
# 3. Tag and push the tag
git tag -a v1.3.0 -m "Description of changes"
git push origin v1.3.0
```

The workflow extracts the version from the tag name and the changelog from the tag annotation. It authenticates with the `CLAWHUB_TOKEN` repository secret.

### Manual (fallback)

```bash
./publish-clawhub.sh --changelog "summary of changes"
```

Requires `clawhub` CLI installed (`npm install -g clawhub`) and authenticated (`clawhub login`).

### Verify / Install

```bash
clawhub package inspect openclaw-parcel
openclaw plugins install openclaw-parcel
```

## History: rename from parcel-cli → openclaw-parcel (v2.0.0)

The plugin was originally published to ClawHub as `parcel-cli`, but the npm
package name has always been `openclaw-parcel`. ClawHub's validator
eventually enforced a rule requiring these to match, breaking the grandfathered
publish in 2026-04-19. v2.0.0 aligned both on `openclaw-parcel`.

**Breaking for existing installs:** OpenClaw config namespace shifted from
`plugins.entries.parcel-cli` → `plugins.entries.openclaw-parcel`. Migration:

```bash
openclaw config set plugins.entries.openclaw-parcel.config.apiKey \
  "$(openclaw config get plugins.entries.parcel-cli.config.apiKey)"
openclaw config unset plugins.entries.parcel-cli
openclaw plugins uninstall parcel-cli
openclaw plugins install openclaw-parcel
```

The old `parcel-cli` ClawHub listing is a tombstone — ClawHub has no
`deprecate` command, so it remains at 1.3.0 indefinitely.

## SDK Patterns

- Entry point uses `definePluginEntry` from `openclaw/plugin-sdk/plugin-entry`
- Parameter schemas use `@sinclair/typebox` `Type.Object()` (not plain JSON Schema)
- Tool results must include `details: null` (not `undefined`, which `JSON.stringify` drops)
- `openclaw` is a `peerDependency` (provided by host runtime), not a regular dependency
- Tool `label` field should be human-readable (e.g. "Parcel List", not "parcel_list")
- Manifest `configSchema` must include `additionalProperties: false`
