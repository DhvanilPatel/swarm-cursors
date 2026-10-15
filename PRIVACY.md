# Privacy policy: Swarm Rebuild

_Last updated: October 15, 2026 (v1.1.0)_

Swarm Rebuild does not collect, store, sell or transmit any personal data.

- **Nothing runs until you click.** The extension uses Chrome's `activeTab` permission, so it can only touch the tab you clicked the icon on, and only at that moment.
- **Everything stays on your device.** To rebuild a page, the extension reads the page's layout and styles in your browser. For WebGL canvases, playing videos and embedded frames, it takes one screenshot of the visible tab and crops those regions out. The page snapshot and the screenshot live only in that tab's memory and are discarded when you exit or leave the page.
- **No network requests.** The extension doesn't contact any server, use analytics, or load remote code. The only network activity comes from the page's own images and videos, which the browser may load again (usually from its cache) while rebuilding.
- **Sound is generated, not recorded.** The music and effects are synthesized in your browser. The extension never uses your microphone.
- **No accounts, cookies or storage.** Nothing is written to `localStorage`, cookies, `chrome.storage` or anywhere else.

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab` | Lets the extension run on the current tab when you click its icon or press its shortcut, and take a screenshot of that tab. |
| `scripting` | Injects the animation script into that tab and briefly hides non-media elements for the media screenshot. |

## Contact

Questions: open an issue at <https://github.com/DhvanilPatel/swarm-cursors/issues>.
