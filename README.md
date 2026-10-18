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

Package output: `artifacts/`

## License

[MIT](LICENSE). Copyright (c) 2026 Arun Sasidharan.
