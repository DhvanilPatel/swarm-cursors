# Troubleshooting

### Nothing happens after `createSwarm`

Call `start()` in a client-side effect or after the target element exists. `createSwarm` is intentionally inert and SSR-safe.

### The target looks blank or incomplete

Listen for `error` and `warning`. The engine omits hidden/unsupported nodes and caps capture at about 4,000 layers and 40,000 CSS pixels. Cross-origin frames, protected video, tainted/WebGL canvases, and closed shadow roots cannot be read as ordinary page DOM.

### Audio is silent

Audio is disabled by default. Enable `audio.enabled` and call `start()` from a user gesture if the browser blocks AudioContext autoplay. The M key toggles audio when keyboard controls are enabled.

### The page is not restored

`stop()` removes the overlay immediately; `destroy()` also removes event listeners. `restoreOnComplete` fades back to the original page on successful completion. The engine does not mutate or replace the source DOM.

### The React or Next.js import fails

Install React (and for Next.js, Next) in the host app. Use `"use client"` for App Router components. Keep `SwarmRebuild` mounted in the browser and do not call `start()` during server rendering.

### Package publication is blocked

The workspace is marked `UNLICENSED` because source and upstream derivative rights are unresolved. Do not publish until licensing and attribution are cleared.
