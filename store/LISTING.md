# Chrome Web Store listing

Copy-paste material for the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Store listing tab

**Name:** Swarm Rebuild

**Summary** (132 characters max):

> Wipe any page to a blank canvas and watch a swarm of multiplayer cursors rebuild it, live.

**Category:** Fun (alternative: Developer Tools)

**Language:** English

**Description:**

> Click the icon on any website and the page fades to nothing. A swarm of colorful multiplayer cursors gathers around the site's logo, then gets to work rebuilding it piece by piece, the way a design team would in a design tool:
>
> • Boxes dragged out with a crosshair and a live size badge, then filled in
> • Headlines and paragraphs typed out with a blinking caret
> • Borders drawn with the pen tool
> • Ruler guides dragged in, with text snapping onto them
> • Cards, nav links and list rows ⌥-dragged into place and retyped
>
> Scroll and the swarm chases you, calling in more agents the faster you go. Hit Tour to auto-scroll for a perfect screen recording. When it's done, the cursors flock to your mouse and "Go live" fades back to the real page.
>
> Inspired by Joel Califa's "Swarm" (califa.github.io/swarm-site).
>
> Privacy: nothing is collected or sent anywhere. The extension only runs on the tab you click, when you click it.

**Graphics:**

| Asset | File |
| --- | --- |
| Store icon (128×128) | `../swarm-rebuild/icons/icon128.png` |
| Screenshots (1280×800) | `screenshot-1.png`, `screenshot-2.png`, `screenshot-3.png` |
| Small promo tile (440×280) | `promo-tile-440x280.png` |
| Video (optional, YouTube link) | upload `../media/demo.mp4` to YouTube |

## Privacy practices tab

**Single purpose:**

> Animate a rebuild of the current web page: when the user clicks the icon, the page is replaced by a canvas on which animated cursors redraw its layout, text and images.

**Permission justifications:**

- `activeTab`: Needed to run on the page the user explicitly invokes the extension on, and to capture that tab once so canvases, videos and iframes can be redrawn. No access to any other tab or site.
- `scripting`: Needed to inject the bundled animation script into the active tab, and to briefly apply CSS that leaves only media visible for the one screenshot.

**Remote code:** No. All JavaScript is included in the package.

**Data usage:** Collects no user data. Tick none of the data-type boxes and certify the three disclosures (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** `https://github.com/DhvanilPatel/swarm-cursors/blob/main/PRIVACY.md`

## Distribution tab

Visibility: Public (or Unlisted to share by link first). Regions: all.
