---
name: firefox-addons-release
description: Prepare, submit, and update Just Following on Firefox Add-ons using the repository's web-ext signing command and AMO listing helper.
---

# Firefox Add-ons release

Run commands from the repository root. Use the same tooling as Watchbox:
`npm run sign` invokes `web-ext sign`, and `npm run amo` invokes `scripts/amo.mjs`.
Preparing a release does not authorize uploading, submitting, or changing the live
listing; perform those actions when the user's request authorizes them.

## Prepare

Use the existing AMO credentials in the ignored `.env`. If credentials are missing,
use `.env.example` for setup. Never print or commit credential values. Credentials
and submission state must remain excluded from Git and extension packages.

Read `extension/manifest.json` and the store files before changing release metadata:

- `store/firefox/listing.json`: editable listing text, categories, and repository/support links.
- `store/firefox/submission.json`: the same listing plus MIT license, desktop Firefox compatibility, release notes, and reviewer instructions.
- `store/firefox/icons/just-following-128.png`: PNG store icon rendered from the extension SVG.

Keep listing fields in both JSON files aligned with the manifest and actual behavior.
Preserve the extension ID. Describe Reels in Following and deliberately opened
profiles accurately, disclose English-interface filtering and direct-video-link
behavior, and request only verified platform compatibility. The current submission
targets desktop Firefox.

Run the release checks and rebuild:

```sh
npm test
npm run lint
npm run build
```

Inspect the resulting ZIP in `artifacts/`. It should contain only runtime files,
the manifest, SVG icon, and license; exclude credentials, store assets, tests,
CLI tooling, and agent skills. Follow the project's Zen and console verification
requirements for browser behavior changes.

## Submit

For an authorized public submission:

```sh
npm run sign -- --channel listed --amo-metadata store/firefox/submission.json --approval-timeout 0
```

This uploads the extension and creates/submits the public listing; it is not a dry
run. Signing builds from the current source with the same exclusions as
`npm run build`. An approval timeout of zero skips waiting for Mozilla's review;
it does not bypass review or establish approval.

After submission, upload the icon and re-fetch the listing:

```sh
npm run amo -- icon store/firefox/icons/just-following-128.png
npm run amo -- get
```

Verify the persisted listing and report the actual review/signing status.

## Update or retry

For authorized listing changes, keep both JSON files aligned, then run:

```sh
npm run amo -- update store/firefox/listing.json
npm run amo -- get
```

The listing helper changes metadata without submitting a new extension version.
If an upload's outcome is uncertain, inspect the ignored `.amo-upload-uuid` state
and AMO before retrying or changing the version.
