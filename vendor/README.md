# Temporary npm security bundle

This is a local, reproducible npm 12.2.1 security rebuild, not an official npm
release. It preserves the prior ip-address 10.7.4 and undici 6.29.1 fixes, and
adds upstream glob 14.0.3, minimatch 11.0.3, path-scurry 3.0.0 and
@isaacs/nonrecursive-glob-match 1.0.3. These resolve the glob cancellation and
minimatch amplification advisories. The result is 12.2.1+security.20261031.

Official npm 12.2.1 still bundles the affected packages as of 2026-11-01.
Root overrides cannot replace npm's bundled files. The rebuild replaces only
the pinned package directories and updates bundled consumers' declared ranges.
All other code and license notices remain unchanged. The sources, every changed
path, range edits, and archive hashes are recorded in the provenance JSON.

The root devDependency pins the archive, and OpenClaw references it using
`"npm": "$npm"`. Consumers do not inherit these root overrides, and this does
not patch an unrelated globally installed OpenClaw host. The archive and scripts
are included in the package so an extracted package can resolve the dev file
reference during a production-only root install.

The root minimatch override also fixes OpenClaw's non-bundled copy. Minimatch 11
returns matcher objects instead of RegExp for some patterns. The postinstall
script updates OpenClaw's environment-file wildcard consumer to use its `test`
method. It accepts only the reviewed OpenClaw 2026.10.5 and 2026.10.8 files with
exact before/after SHA-256 hashes, is idempotent, refuses external symlinks and
unknown host versions, and skips when the dev host is absent. Re-review this
patch for any SDK upgrade. Disabling scripts requires manually running
`node scripts/patch-openclaw-minimatch.mjs` before using the dev host.

Regenerate and verify from the repository root:

```sh
python3 scripts/rebuild-security-npm.py
python3 scripts/rebuild-security-npm.py --check
npm ci
npm test
npm audit
npm run plugin:ci
```

The rebuild verifies every official tarball against pinned SHA-512 integrity,
checks all unpatched bytes and executable modes, and produces a deterministic
archive. CI verifies this provenance, clean-installs, runs the regression suite,
and audits the complete tree. Tests exercise cancellation, bounded hostile glob
patterns, actual installed OpenClaw wildcard expansion, patch drift rejection,
and offline npm workspace discovery/install/packing.

Archive SHA-256:
`30da6d0a20b463c82c85023420643b15f4ab7a8963ac1742bdebf18deb829610`

Keep the tarball, sources, provenance and scripts together. Remove this temporary
rebuild and compatibility hook once official npm/OpenClaw releases bundle fixed,
compatible dependencies. Before replacing pins, clean-install and audit both
full and production-only trees, test packed-artifact consumption, and rerun
security and plugin tests. Preserve platform-optional lock entries when refreshing
bundled metadata; npm can retain stale bundle metadata when only the file tarball
reference changes.
