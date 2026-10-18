# Just Following

Instagram’s Following feed by default. Hide Explore, the Reels feed, and labeled suggestions and ads. Keep native posts, profiles, search, Stories, and messages.

Click the toolbar button for settings. Preferences stay in your browser. No analytics or backend.

## Try it

Requires Firefox 142+ or a compatible Zen version.

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…** and select `manifest.json`.
3. Open or refresh Instagram.

The extension is unsigned. Reload it after restarting the browser.

## Development

Node 26+.

```sh
npm ci
npm test
npm run lint
npm run build
```

Package output: `artifacts/`. See [AGENTS.md](AGENTS.md) for contribution requirements.

### Development dependency advisory

Reviewed 18 October 2026: `npm audit` reports three high-severity entries from one
[node-forge signature-verification advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv),
through `web-ext@10.8.0` → `@devicefarmer/adbkit@3.3.9` → `node-forge@1.4.0`.
These are development dependencies and are absent from the extension ZIP.
The affected verification is used by adbkit's TCP/USB authentication bridge;
our test, lint, and build commands do not invoke that bridge. `npm audit --omit=dev`
reports no vulnerabilities. This scope assessment does not fix the upstream issue.

All three packages are at their latest published versions as of that review, with
no patched node-forge release available. Keep the current tooling and recheck when
upstream publishes a fix. Avoid `npm audit fix --force`: its proposed web-ext 5.1.0
downgrade is not an appropriate update for this Manifest V3 project.

## License

[MIT](LICENSE). Copyright (c) 2026 Arun Sasidharan.
