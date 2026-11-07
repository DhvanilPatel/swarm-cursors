# AMO (addons.mozilla.org) listing

Copy-paste material for the [AMO Developer Hub](https://addons.mozilla.org/developers/) upload of the same zip as the Chrome Web Store (`dist/swarm-rebuild-<version>.zip`, see `scripts/package.sh`).

## Listing tab

**Name:** Swarm Rebuild

**Summary** (250 characters max):

> Wipe any page to a blank canvas and watch a swarm of multiplayer cursors rebuild it, live.

**Categories:** Fun (alternative: Developer Tools)

**Language:** English

**Description** (markdown allowed):

> Click the icon on any website and the page fades to nothing. A swarm of colorful multiplayer cursors gathers around the site's logo, then gets to work rebuilding it piece by piece, the way a design team would in a design tool:
>
> • Boxes dragged out with a crosshair and a live size badge, then filled in
> • Headlines and paragraphs typed out with a blinking caret
> • Borders drawn with the pen tool
> • Ruler guides dragged in, with text snapping onto them
> • Cards, nav links and list rows ⌥-dragged into place and retyped
>
> With sound: a clicky-clacky soundtrack of keyboard typing and mouse clicks, with soft glass-piano notes as pieces land and a ringing chord when the page is done (press M to mute).
>
> Scroll and the swarm chases you, calling in more agents the faster you go. Hit Tour to auto-scroll for a perfect screen recording. When it's done, the cursors flock to your mouse and "Go live" fades back to the real page.
>
> Works in Firefox and Firefox-based browsers (Zen, Waterfox, etc.). Inspired by Joel Califa's "Swarm" (califa.github.io/swarm-site).
>
> Privacy: nothing is collected or sent anywhere. The extension only runs on the tab you click, when you click it.

**Graphics:**

AMO accepts the same assets as the Chrome store listing (`store/`):

| Asset | File |
| --- | --- |
| Icon (128×128) | `../store/store-icon-128.png` |
| Screenshots | `../store/screenshot-1.png`, `../store/screenshot-2.png`, `../store/screenshot-3.png` |
| Banner/marquee (if needed, 1400×560) | `../store/marquee-1400x560.png` |

## Required upload decisions

- **License:** the repo currently ships none (see the README's credit note about the original Swarm site), but AMO requires selecting one at upload. This needs to be decided with Joel Califa (see the README credit section) before listing publicly; for a review-only upload, choose accordingly.
- **Add-on ID:** taken from the manifest's `browser_specific_settings.gecko.id`. If the maintainer prefers a different ID (e.g. a reverse-domain or different domain suffix), change the manifest before submission — it's ignored on Chromium.

## Linter notes (informational, not blocking)

- `BACKGROUND_SERVICE_WORKER_IGNORED`: the manifest deliberately contains both `background.scripts` (Firefox's event page) and `background.service_worker` (Chromium's background). Firefox ignores the latter, Chrome ignores the former; this is the cross-browser pattern documented by MDN.
- The `innerHTML` warnings come from `swarm.js` and are identical to the Chrome store build. Submitting the full source as the review source is recommended.

## Privacy tab

**Add-on privacy:**

> Collects no browsing history, personal data or communications. The extension never sends data anywhere — no network requests out of the package.

**Permission justifications:**

- `activeTab`: Needed to run on the page the user explicitly invokes the extension on (toolbar click or Alt+Shift+S), and to capture that tab once so canvases, videos and cross-origin iframes can be redrawn (Firefox grants `captureVisibleTab` under `activeTab` since Firefox 126). No access to any other tab or site beyond that.
- `scripting`: Needed to inject the bundled animation script into the active tab, and to briefly apply CSS that leaves only media visible for the one screenshot.

**Total data collection:** Does not collect data.
