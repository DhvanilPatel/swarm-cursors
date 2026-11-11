# Configuration reference

All option properties are optional. Values below are the defaults applied by `createSwarm`. Options are validated before use; invalid ranges throw `RangeError` or `TypeError` rather than silently falling back.

| Group | Option | Default | Description |
|---|---|---:|---|
| `target` | `Element` | `document.body` at `start()` | Root subtree to capture. |
| `cursors` | `count` | `18` | Preferred starting and runtime agent count. |
| | `minCount` | `8` | Minimum adaptive agent count. |
| | `maxCount` | `48` | Maximum adaptive agent count. |
| | `size` | `16` | Cursor SVG size in CSS pixels; valid range 4–64. |
| | `colors` | Source palette | Non-empty list of CSS colors cycled across cursors. |
| | `opacity` | `1` | Cursor opacity from 0 to 1. |
| | `movementSpeed` | `1` | Movement physics multiplier from greater than 0 through 5. |
| `animation` | `autoplay` | `true` | Start after capture and preparation. |
| | `duration` | `0` | Optional automatic-tour pacing goal in milliseconds; zero disables timed tours. Task completion can take longer. |
| | `delay` | `1500` | Milliseconds between capture readiness and autoplay. |
| | `speed` | `1` | Multiplier for task animation timing; valid range greater than 0 through 5. |
| | `loop` | `false` | Start a new capture after completion. |
| `reconstruction` | `text` | `true` | Styled text blocks and typing effects. |
| | `images` | `true` | Images, SVG, and image-like media. |
| | `shapes` | `true` | Filled rectangles, backgrounds, and shape layers. |
| | `borders` | `true` | Border and horizontal-rule pen-tool tasks. |
| | `media` | `true` | Canvas, video, and embedded media. |
| `appearance` | `background` | Target page background | Solid overlay background CSS value. |
| | `backgroundGradient` | unset | CSS `background-image` value. |
| | `showGuides` | `true` | Rulers and alignment guides. |
| | `showMeasurements` | `true` | Size badges, spacing guides, and measurement lines. |
| `interaction` | `scrollAware` | `true` | Start from scroll gestures; task availability is also unlocked as the user scrolls. |
| | `mouseInteraction` | `true` | Flock around mouse/pointer movement. |
| | `touchInteraction` | `true` | Include touch pointers in pointer interaction. |
| | `keyboardControls` | `true` | Enable Escape to stop and M to toggle audio. |
| `performance` | `maxFps` | `60` | Render cap, clamped to 1–120. |
| | `pauseWhenHidden` | `true` | Pause work while `document.hidden` and resume when visible. |
| `audio` | `enabled` | `false` | Synthesize sound with Web Audio. Browsers may require a user gesture. |
| | `volume` | `0.35` | Master volume from 0 to 1. |
| | `onSound` | unset | Optional observer for sound-event names and numeric/string arguments. |
| `behavior` | `restoreOnComplete` | `false` | Fade out the overlay and reveal the original page when all tasks finish. |
| `media` | `capture` | unset | Optional asynchronous screenshot adapter returning a data URL. |

Example:

```ts
const swarm = createSwarm({
  target: document.querySelector("#demo") ?? document.body,
  cursors: { count: 24, minCount: 8, maxCount: 48, size: 16 },
  animation: { autoplay: true, delay: 500, speed: 1.2, duration: 12_000 },
  reconstruction: { text: true, images: true, media: true },
  appearance: { background: "#fff", showGuides: false },
});
```

`setOptions` validates and applies runtime controls such as appearance, audio, cursor styling, speed and count. Capture/reconstruction switches apply on the next `replay()` because they affect the blueprint; changing `target` also takes effect on the next run. `setSpeed`, `setCursorCount`, and `setBackground` are shortcuts for common live changes. Add `data-swarm-ignore` to an element to exclude that element and its descendants from capture.

For vanilla integrations, calling `start()` is an explicit request to capture and run, even if `animation.autoplay` is `false`. Framework adapters use `autoplay` to decide whether to call `start()` automatically; with autoplay disabled, obtain the instance through `useSwarm()` and start it when appropriate.

Cursor trails, custom cursor shapes/labels, grid/crosshair overlays, custom easing, and per-element reconstruction plugins are not exposed because the migrated renderer does not implement them.
