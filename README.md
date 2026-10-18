# Just Following

A quieter Instagram for Firefox and Zen. Home opens Instagram's native **Following** feed, including Reels. On Following, only the suggested-account sidebar and dedicated Reels navigation are hidden; feed posts and Instagram's empty state stay native. The left sidebar's Reels link is hidden on profile pages too; profile content, account suggestions, suggestion controls, and profile Reels tabs stay visible. The dedicated Reels feed and Explore recommendations remain blocked elsewhere. Stories, Story highlights, search, profiles, photo carousels, comments, saves, notifications, and messages keep their native interface.

No backend, telemetry, account scraping, stored credentials, or private Instagram API. The extension only modifies Instagram pages in your browser. It makes no account changes and does not fetch account data or send telemetry. Firefox asks for access to Instagram so the content script can run there.

## Popup settings

Click **Just Following** in Zen's extensions menu to open the settings popup. Its minimal light/dark appearance follows the browser's color-scheme preference. Changes save automatically in local extension storage and apply to open Instagram tabs without reloading.

| Setting | Default |
| --- | --- |
| Hide Explore recommendations | On |
| Block the Reels feed | On |
| Hide suggested accounts | On |
| Hide Stories | Off |

Home always opens Following. **Reset to defaults** restores the four settings. Reels blocking preserves videos in Following and profile posts. Suggested-account hiding covers the Following sidebar; native profile content and controls remain available. Story hiding removes native Story rails and highlight links and redirects Story viewer URLs to Following.

The `storage` permission stores these four preferences only. No account data or following list is saved, and settings are not synced to another browser.

## Try it

1. Open `about:debugging#/runtime/this-firefox` in Firefox or Zen.
2. Choose **Load Temporary Add-on…**, then select this project's `manifest.json`.
3. Open or refresh Instagram. Home opens `https://www.instagram.com/?variant=following`.

Firefox 142 or newer is required. Temporary add-ons disappear when the browser restarts; load the manifest again to continue testing. In the debugging page, use **Reload** after editing the extension. This MVP is unsigned and has not been published to Firefox Add-ons.

Search shares Instagram's `/explore/` page. Its search box and account results remain usable, while its recommended post grid is hidden. The dedicated Reels feed, hashtag discovery, location discovery, and suggested-account URLs return to Following. Photos on intentionally opened profiles remain available.

Profile Posts, Reels, Reposts, and Tagged pages keep all native content and controls without checking follow status or hiding suggestions. Posts opened from a profile or the Following feed keep their native viewer and video playback. This source context stays in memory for the current page session; a direct video URL in a new tab or after a full reload returns to Following when its source cannot be confirmed. No following list is fetched or stored. Collaboration posts remain available even when their URL names another author.

The extension does not filter suggested or sponsored feed posts on Following, replace its empty state, or fetch another feed. Its account-sidebar filter uses Instagram's suggested-account discovery link rather than matching recommendation or ad labels in posts.

## Development

Use Node 26 or newer (verified with Node 26.7.0).

```sh
npm ci
npm test
npm run lint
npm run build
```

The unsigned package is written to `artifacts/just_following-0.1.0.zip`. Packaging includes only the extension runtime files.

`settings.js` defines shared defaults. `popup.html`, `popup.css`, and `popup.js` provide the toolbar settings interface. `content.js` listens for local preference changes and owns route guards and dynamic-page filtering. `content.css` hides known distraction surfaces as the page renders. Tests use real jsdom documents and events; only full-page navigation and native media playback need test substitutes. Each behavior was introduced through a failing test before its implementation.

## Verification and limits

On 18 October 2026, verified that clicking **Just Following** in Zen's extensions menu opens the minimal settings popup with exactly four toggles and the agreed defaults. Tested live Reels-navigation and suggested-sidebar toggles and reset on the final build. The four filters were also verified during popup development: Explore recommendations appear/disappear while search stays available; Story highlights and native Story rails hide/restore; preferences persist after reopening/reloading. Home always opens Following. Final console inspection found no Just Following errors; native Instagram cookie, CSP, and connection messages remain. All 76 tests, lint, and build passed. Live popup visual review covered the light theme; dark styling follows the browser's color-scheme preference.

Verified `zhenwei.film` in Zen after hiding the left sidebar's Reels link: the profile Reels tab, header, highlights, native account suggestions, and all 24 loaded tiles remained visible. No profile elements were marked hidden by the extension. The console showed no Just Following errors; all 57 tests, lint, and build passed.

On 18 October 2026, reproduced nine hidden Reel links leaving blank cells among 24 loaded posts on the unfollowed `kodakfilm.reto` profile. After removing the follow-status gate, Zen showed all 24 thumbnails with zero hidden tiles or blank cells caused by the extension. A previously hidden collaboration Reel opened in Instagram's native viewer with video playback. The profile's Reels tab retained 18 visible tiles after a full reload, while dedicated Reels navigation remained hidden. The account still showed **Follow**, and console inspection found no errors from Just Following. All 53 automated tests passed.

Earlier on 18 October 2026, compared Following in Zen with the extension enabled and disabled. Instagram supplied one carousel and a sidebar with five suggested accounts; no suggested feed posts or sponsored posts appeared, including after scrolling to the bottom. uBlock Origin already exempted Instagram. After narrowing the filters, reloaded the extension from this workspace and verified the sidebar and Reels navigation were hidden, the account switcher remained visible, and native video playback and carousel navigation worked. Console inspection found no errors from Just Following. Native empty-state preservation is fixture-tested because this live feed was populated.

Initial testing in the user's existing Zen session on 17 October 2026 covered temporary installation, Home to Following, Search without the Explore grid, account search results, profile photos, native carousel navigation, hidden suggestion controls, and dedicated Reel-feed redirects. Automated tests also cover follow-status changes, direct distraction URLs, history navigation, dynamic rendering, captions, native empty-state preservation, Story access, and video playback.

Stories are enabled. Verified `zhenwei.film`'s visible highlights, native Story viewer, video playback, and pause control in Zen. Instagram's native Following feed did not include a Stories rail in this session; the extension preserves one when Instagram supplies it.

Verified restored Reel thumbnails in `zhenwei.film`'s Posts grid and all 15 loaded tiles in its Reels tab, including after a full reload. A Reel opened in the native post viewer remained visible with advancing video playback. Home still opened Following with the Reel exception enabled and the dedicated Reels navigation hidden. Only the mixed carousel was available in the live Following feed; standalone feed-Reel playback is covered by automated fixtures. Console inspection found native cookie and interrupted-WebSocket messages, with no extension errors.

After following `zhenwei.film`, verified its five-slide mixed photo/video carousel in the populated Following feed, later slides, and the native post viewer. A regression fix prevents preloaded video slides from hiding the entire carousel. Live sampling recorded 98 frames with no collapsed frames and a constant post height. Console monitoring showed no errors from the extension; Instagram can still emit a media deprecation warning when a video is initialized. Only one followed post was available, so live pagination remains unverified. The extension preserves Instagram's native pagination.

Instagram changes its markup frequently. Some fallback selectors use English labels, matching the tested session; other interface languages are not verified. This is a focus aid, not a security boundary or a network blocker: Instagram can still request hidden recommendations. Disable or remove the add-on through Firefox's add-on manager to restore the unmodified site.
