# Swarm Rebuild

A Chrome extension that wipes any web page to a blank canvas and lets a swarm of multiplayer cursors build it back, live: crosshair-drawn boxes, typed text, pen-tool lines, ruler guides and ⌥-drag duplicates, until the page looks just like it did before.

![Swarm Rebuild rebuilding a page](media/demo.gif)

[Full demo video (36s)](media/demo.mp4)

## Credit

This is a tribute to **[Swarm](https://califa.github.io/swarm-site/)** by **[Joel Califa](https://joelcalifa.com)** ([@califa](https://github.com/califa), [source](https://github.com/califa/swarm-site)), a website that builds itself as you scroll.

The motion design is his: the cursor set, the swarm and flocking physics, the build choreography (rects, typing, guides, duplicates), the rulers and the overall look. Large parts of the animation engine here are adapted directly from his site. What this project adds is the part that points it at *any* page: snapshotting a live DOM into a blueprint the swarm can rebuild, plus the extension around it.

Go look at the original. It's better than this.

## Install

It isn't on the Chrome Web Store yet, so load it unpacked:

1. Clone or download this repo.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the [`swarm-rebuild/`](swarm-rebuild) folder.
4. Pin it (puzzle icon → pin).

## Use

- Click the toolbar icon or press **Alt+Shift+S** on any page.
- The page fades out and the cursors orbit the site's favicon, then fan out and start building.
- **Scroll** and the swarm chases you, with more agents joining the faster you go.
- **Tour** auto-scrolls at the pace the swarm can keep up with. Good for screen recordings.
- **1× / 2× / 3×** changes build speed.
- When it's done, the cursors flock to your mouse. **Go live** fades back to the real, clickable page; **Replay** builds it again.
- **Esc**, **✕**, or clicking the icon again exits at any time.

There's a self-contained test page in [`demo/index.html`](demo/index.html) (an inner-scrolling app shell with floats, forms, cards and media). Opening local files needs **Allow access to file URLs** enabled for the extension.

## How it works

1. **Snapshot.** [`swarm.js`](swarm-rebuild/swarm.js) walks the live DOM, including open shadow roots, and turns it into a blueprint:
   - boxes with fills, borders, radii, shadows, gradients, masks and backdrop blur → **rects**
   - text blocks → **text layers**, cloned with their computed styles (fonts, links, inline code, icons, `::before`/`::after`)
   - single-side borders and `<hr>` → **pen-tool lines**
   - `<img>`, `<svg>`, `<video>`, `<canvas>`, iframes → **media**. WebGL canvases, playing video and cross-origin iframes are cropped from a screenshot taken at click time while only those elements are visible.
   - repeated siblings (nav links, cards, list rows, logos) → one **master** plus **duplicates**
   - shared left edges and baselines → **ruler guides** that text snaps to
2. **Blank.** A full-viewport layer, isolated from the page's CSS in a shadow root, covers the page with its own background color. A quick hidden scroll pass first triggers lazy images and reveal-on-scroll content.
3. **Rebuild.** Each cursor runs a small generator script per task. Tasks unlock top-down as you scroll, children wait for their parent box, and duplicates wait for their master:
   - **rect / media:** crosshair drag with a live `W × H` badge and a gray placeholder, then the real fill fades in (images sweep top to bottom)
   - **text:** drag a text box, type with an I-beam and a blinking caret; big headings start at 18px and step up
   - **lines:** pen tool, anchor points, rubber band to the cursor
   - **guides:** Figma-style rulers slide in, a red guide is dragged out, and text snaps onto it
   - **duplicates:** select the master, ⌥-drag a copy with red spacing measurements, then retype its text, swap its image or restyle it
   - **swarm physics:** orbiting, alignment and mouse-avoiding flocking for the intro and the finale

### Files

| Path | What it is |
| --- | --- |
| `swarm-rebuild/manifest.json` | Manifest V3; permissions are `activeTab` and `scripting` only |
| `swarm-rebuild/background.js` | Toolbar click → media-only screenshot → inject `swarm.js` (or toggle off) |
| `swarm-rebuild/swarm.js` | Snapshot, renderer and swarm engine (one dependency-free content script) |
| `demo/index.html` | Edge-case test page |
| `store/` | Chrome Web Store listing copy, screenshots and promo tile |
| `scripts/package.sh` | Builds the zip to upload to the Web Store |

## Limits

- Chrome doesn't let extensions run on `chrome://` pages, the Web Store or the PDF viewer. The icon shows a red × there.
- It's a visual rebuild, not a clone. Animations freeze at the moment you click, decorative pseudo-elements are skipped when their position can't be worked out, and canvases, videos and iframes below the first screen become placeholders.
- Web components are rebuilt as plain styled elements, so none of the page's scripts run inside the swarm's layer.
- Very long pages are capped at about 4,000 layers / 40,000px.

## Publishing

`./scripts/package.sh` writes `dist/swarm-rebuild-<version>.zip` for the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Listing text, permission justifications and assets are in [`store/`](store), and the privacy policy is [`PRIVACY.md`](PRIVACY.md).

## License

None yet. The original Swarm site is published without a license and this project adapts parts of it, so please don't reuse this code without checking with [Joel Califa](https://joelcalifa.com) as well.
