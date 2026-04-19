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
clawhub package inspect parcel-cli
openclaw plugins install parcel-cli
```

## Known issue: ClawHub name mismatch (grandfathered)

The ClawHub plugin name is `parcel-cli`, but the npm package name is
`openclaw-parcel`. ClawHub's current validator requires these to match —
new plugins are rejected with `package.json name must match published
package name`. This repo predates the rule and is grandfathered, so
publishes still succeed.

**Risk:** on any future release, ClawHub may revalidate and `publish-clawhub`
starts failing. If that happens, the fix is a rename to align both names on
`openclaw-parcel`:

1. `openclaw.plugin.json` — `id` → `openclaw-parcel`
2. `marketplace.json` — `name` and `plugins[0].name` → `openclaw-parcel`
3. `src/index.ts` — `definePluginEntry({ id: "openclaw-parcel" })`
4. `.github/workflows/publish-clawhub.yml` — `--name openclaw-parcel`, inspect target
5. `publish-clawhub.sh` — same
6. `README.md` + this file — install commands + `plugins.entries.<name>` config refs
7. Bump `package.json` version and tag a release

**Breaking:** shifts the OpenClaw config namespace from
`plugins.entries.parcel-cli` → `plugins.entries.openclaw-parcel`. Existing
users (including the maintainer's own install) must migrate:

```bash
openclaw config set plugins.entries.openclaw-parcel.config.apiKey \
  "$(openclaw config get plugins.entries.parcel-cli.config.apiKey)"
openclaw config unset plugins.entries.parcel-cli
```

The old `parcel-cli` ClawHub listing becomes a tombstone — ClawHub has no
`deprecate` command.

Tracked: see the open GitHub issue in this repo for the rename plan. Do not
execute preemptively; wait for a publish failure or a deliberate decision to
stop straddling names.

## SDK Patterns

- Entry point uses `definePluginEntry` from `openclaw/plugin-sdk/plugin-entry`
- Parameter schemas use `@sinclair/typebox` `Type.Object()` (not plain JSON Schema)
- Tool results must include `details: null` (not `undefined`, which `JSON.stringify` drops)
- `openclaw` is a `peerDependency` (provided by host runtime), not a regular dependency
- Tool `label` field should be human-readable (e.g. "Parcel List", not "parcel_list")
- Manifest `configSchema` must include `additionalProperties: false`
