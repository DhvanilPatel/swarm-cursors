# Privacy policy: Swarm Rebuild

_Last updated: November 11, 2026_

Swarm Rebuild does not collect, store, sell or transmit any personal data.

- **Nothing runs until you click, unless you ask it to.** By default the extension uses Chrome's `activeTab` permission, so it can only touch the tab you clicked the icon on, and only at that moment. If you turn on automatic play in its options, Chrome first asks you to give it access to every site or to the sites you list, and the animation then starts by itself when those pages load. Switching back to "Only when I click" gives that access up.
- **Everything stays on your device.** To rebuild a page, the extension reads the page's layout and styles in your browser. For WebGL canvases, playing videos and embedded frames, it takes one screenshot of the visible tab and crops those regions out. The page snapshot and the screenshot live only in that tab's memory and are discarded when you exit or leave the page.
- **No network requests.** The extension doesn't contact any server, use analytics, or load remote code. The only network activity comes from the page's own images and videos, which the browser may load again (usually from its cache) while rebuilding.
- **Sound is generated, not recorded.** The music and effects are synthesized in your browser. The extension never uses your microphone.
- **No accounts or cookies.** The only thing stored is your automatic-play choice, in `chrome.storage.local` on your device. Nothing is written to `localStorage`, cookies or anywhere else.

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab` | Lets the extension run on the current tab when you click its icon or press its shortcut, and take a screenshot of that tab. |
| `scripting` | Injects the animation script into that tab and briefly hides non-media elements for the media screenshot. |
| `storage` | Remembers your automatic-play setting on this device. |
| Access to all sites, or to sites you list (optional) | Only requested if you turn on automatic play, so the animation can start when those pages load. Access to all sites also lets it take the media screenshot without a click. |

## Contact

Questions: open an issue at <https://github.com/DhvanilPatel/swarm-cursors/issues>.
