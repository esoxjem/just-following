# Just Following

Instagram’s Following feed by default. Hide Explore, the Reels feed, and labeled suggestions and ads. Keep native posts, profiles, search, Stories, and messages.

Click the toolbar button for settings. Preferences stay in your browser. No analytics or backend.

## Firefox / Zen

Requires Firefox 142+ or a compatible Zen version.

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…** and select `extension/manifest.json`.
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

Package output: `artifacts/`

On macOS, `npm test` also checks that Safari's Copy Bundle Resources phase includes
every shared extension file and references the original source paths.

## Safari on iPhone / iPad

Open `safari/Just Following.xcodeproj`, select the **Just Following** scheme and an
iOS simulator, then run. The app explains how to enable the extension and allow
access to Instagram. This affects `instagram.com` in Safari.

To build with [asc](https://github.com/rorkai/App-Store-Connect-CLI):

```sh
asc xcode build --project 'safari/Just Following.xcodeproj' \
  --scheme 'Just Following' --configuration Debug \
  --destination 'generic/platform=iOS Simulator' --no-code-signing
```

The current minimum is iOS 16.0. A simulator build needs no signing team. Configure
your development team before running on a physical device or distributing the app.

## Project layout

- `extension/`: the single manifest, content scripts, settings, popup, and icons
  used by both browsers. `LICENSE` links to the repository license.
- `safari/`: the iOS containing app and Safari extension target. Xcode references
  `extension/` directly; edit shared web files there. Add new runtime files to the
  Safari extension target's **Copy Bundle Resources** phase too.
- `tests/`: shared behavior tests and Firefox package verification.
- `scripts/` and `store/firefox/`: Firefox Add-ons tooling and listing assets.

Before shipping, run the tests, inspect the Firefox ZIP, and verify Instagram in
Zen and mobile Safari, including settings, navigation, and the browser console.

Simulator validation (2026-10-18): built through `asc xcode build` and installed
on iPhone Air / iOS 26.0. With Instagram signed in:

- Home and direct `/reels/` navigation return to `/?variant=following`.
- Native feed videos play, and the dedicated Reels navigation is hidden.
- Explore recommendations are hidden; search and recent-account navigation remain.
- Profile details, grids, and the profile's own Reels tab remain available.
- The Stories preference hides profile highlights immediately; resetting restores
  them without removing profile posts. Preferences persist across popup reopening.
- Remote Web Inspector confirms the extension's document attributes; no extension
  errors were observed in the page console during these checks.

This is a simulator smoke check, not exhaustive coverage of ads, suggestions,
Story playback, or older iOS versions.

Zen validation (2026-10-18, 1.23.3b): loaded the temporary extension from
`extension/manifest.json` and refreshed signed-in Instagram. Home and direct Reels
navigation return to Following; native video playback, account search, and profile
Reels work. Stories settings persist after reload and update the open profile;
reset restores highlights. Original defaults were restored. The console showed
Instagram cookie, WebGL, and network messages; no extension-source errors were
observed. One malformed manual inspection query produced a console syntax error
and was corrected; it was not an extension error.

## License

[MIT](LICENSE). Copyright (c) 2026 Arun Sasidharan.
