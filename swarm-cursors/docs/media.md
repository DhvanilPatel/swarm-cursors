# Media and browser limitations

The engine never assumes that a normal site can call `chrome.tabs.captureVisibleTab`. `media.capture` is an explicit opt-in integration hook:

```ts
const swarm = createSwarm({
  media: {
    capture: async () => {
      // Implement only with a user-authorized browser API or a trusted host adapter.
      // Return a data URL whose pixels match the visible viewport at capture time.
      return null;
    },
  },
});
```

The callback must return a screenshot data URL captured with the user's consent. Do not fetch arbitrary tab screenshots or relay page content to a server. Capture failures raise a `warning` and reconstruction continues with available DOM pixels/fallback tiles.

- Same-origin and readable 2D canvases can be serialized. A tainted canvas, WebGL context, or inaccessible canvas receives a placeholder unless the adapter supplies a screenshot.
- Videos may be represented by a reusable public media URL, poster, visible screenshot crop, or placeholder. DRM, cross-origin restrictions, live streams, `blob:` and MediaSource URLs prevent faithful restoration.
- Cross-origin iframes are not inspected. A screenshot adapter may provide visible pixels; otherwise the frame is represented by a host label.
- Protected elements, browser chrome, PDF viewers, and extension-internal pages cannot be captured by page JavaScript.
- CSS backgrounds, filters, pseudo-elements, SVG references, forms, text, fixed/sticky UI, and shadow roots are reconstructed as visual layers only. Site scripts, accessibility semantics, event handlers, and interactivity are not cloned.
- Off-screen video, animated content, and canvas frames are snapshots, not synchronized playback.

Only screenshots and captured nodes are held in page memory. No analytics, account, storage, network upload, or remote script is included.
