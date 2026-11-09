# Swarm Cursors

Swarm Cursors snapshots a live DOM into styled reconstruction layers, plans dependencies between those layers, then uses coordinated cursors to draw boxes, type text, trace borders, duplicate repeated components, and rebuild media. This is the browser-library migration of the Swarm Rebuild Chrome extension; it retains the source reconstruction engine instead of substituting a cursor-only animation.

> **Licensing hold:** the source repository has no license and credits motion/reconstruction work adapted from Joel Califa's unlicensed Swarm website. This workspace is marked `UNLICENSED`. Do not publish, redistribute, or use it commercially until the relevant rights and attribution terms are cleared.

## Install

The proposed names were checked on the npm registry on 2026-11-09 and returned `E404` (not found) at that time:

```sh
npm install swarm-cursors
# Optional framework entry points are included in the core package:
npm install react
```

For framework package imports, install the peer framework normally. The separate adapter packages are also built in this workspace:

```sh
npm install @swarm-cursors/react
npm install @swarm-cursors/next
```

The package names are unclaimed at the time checked, but can change before publication. No package is published by this repository.

## Quick start (vanilla)

```ts
import { createSwarm } from "swarm-cursors";

const swarm = createSwarm({
  target: document.body,
  cursors: { count: 24, colors: ["#ff4d4d", "#377dff", "#19c37d"] },
  animation: { autoplay: true, speed: 1 },
  audio: { enabled: false },
});

swarm.on("progress", ({ progress }) => {
  console.log(`${Math.round(progress * 100)}%`);
});

swarm.start();
```

`createSwarm` itself does not read browser globals. Call `start()` in the browser, after the target exists. A `Swarm` instance creates an isolated shadow-DOM overlay; stopping or destroying it removes that overlay and reveals the untouched original page.

## Lifecycle and events

```ts
swarm.start();
swarm.pause();
swarm.resume();
swarm.setSpeed(2);
swarm.setCursorCount(32);
swarm.setBackground("#fff");
swarm.setOptions({ appearance: { showGuides: false } });
swarm.replay();
swarm.stop();
swarm.destroy();

const unsubscribe = swarm.on("complete", () => console.log("done"));
unsubscribe();
```

Events: `ready`, `start`, `pause`, `resume`, `progress`, `complete`, `stop`, `error`, and `warning`. `on` returns an unsubscribe function; `off` is also available.

## Framework adapters

React:

```tsx
import { SwarmRebuild } from "swarm-cursors/react";

export function App() {
  return <SwarmRebuild options={{ cursors: { count: 24 } }} />;
}
```

The adapter also exports `SwarmProvider`, `useSwarm`, and `useSwarmEvents`. The Next.js entry point at `swarm-cursors/next` is a client component and does not access `window` or `document` during module evaluation or server rendering.

See [`examples/vanilla/index.html`](./examples/vanilla/index.html), [`examples/react/App.tsx`](./examples/react/App.tsx), and [`examples/nextjs/app/page.tsx`](./examples/nextjs/app/page.tsx) for runnable integration patterns.

## Configuration and limits

See [configuration reference](./docs/configuration.md), [API reference](./docs/api.md), [media limitations](./docs/media.md), and [troubleshooting](./docs/troubleshooting.md).

Capture includes computed text and box styles, open shadow roots/slots, SVG, pseudo-elements, forms, repeated sibling groups, fixed/sticky layers, floats, clipping, and detected inner scroll containers. A page scan temporarily scrolls to trigger lazy-loaded content and then restores the original scroll position. Capture is capped at roughly 4,000 layers and 40,000 CSS pixels of document height, as in the source engine.

Normal web pages cannot screenshot arbitrary tabs. A caller may provide a consented, user-gesture-driven `media.capture` adapter; without one, inaccessible canvas/video/frame content uses a placeholder or the best available DOM pixels. Cross-origin frames are never read. Protected video, tainted canvases, WebGL, DRM, `blob:`/MediaSource streams, and browser-protected pages may not be faithfully reconstructed.

## Workspace development

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm playground
```

Open `http://localhost:4173/playground/` after building. The playground includes live controls, a JSON options preview, and an example snippet. Package tarball checks can be run with `pnpm pack:core`.

## Build and publication

The core package builds ESM and CommonJS bundles, source maps, minified output, and TypeScript declarations. React and Next.js adapters are optional peer-integrated subpaths and standalone workspace packages. Before any release:

1. Clear the upstream Swarm adaptation and source-code licensing with the relevant rights holders.
2. Replace `UNLICENSED` with the approved license and attribution.
3. Confirm npm name availability and version policy.
4. Build, test, inspect `npm pack --dry-run`, then publish only after explicit approval.

No publishing command has been run.

After licensing and name clearance, build and test with `pnpm build && pnpm typecheck && pnpm test`. Publish in dependency order, explicitly and only after approval:

```sh
pnpm --filter swarm-cursors publish --access public
pnpm --filter @swarm-cursors/react publish --access public
pnpm --filter @swarm-cursors/next publish --access public
```
