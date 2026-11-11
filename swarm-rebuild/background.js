// Clicking the toolbar icon (or Alt+Shift+S) injects the swarm into the active tab.
// Injecting again while it is running toggles it off. If the user opted in on the options page,
// autoplay.js also starts it when a page loads (see "autoplay" below).

// For one screenshot frame, show only the pixels the DOM can't give back
// (WebGL canvases, playing video, cross-origin iframes) so the swarm can crop them cleanly.
const MEDIA_ONLY_CSS = `
html body *:not(canvas):not(video):not(iframe):not(embed):not(object) { visibility: hidden !important; }
html body canvas, html body video, html body iframe, html body embed, html body object { visibility: visible !important; }
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Triggers for a tab run one after another (a second one mid-start would race the first).
const chains = new Map(); // tabId -> { p, auto } for the latest trigger

// auto: started by autoplay.js, not by the user. It targets exactly the document that asked (so a
// navigation mid-start can't land it on the next page), never toggles a running swarm off, and
// fails silently.
function rebuild(tab, { auto = false, documentId } = {}) {
  if (!tab || tab.id == null) return Promise.resolve();
  const last = chains.get(tab.id);
  // the user pressing during an automatic start means "stop it", never "start another"
  const stopOnly = !auto && !!last && last.auto;
  const entry = { auto };
  entry.p = (last ? last.p : Promise.resolve()).then(() => run(tab, { auto, documentId, stopOnly })).catch(() => {});
  chains.set(tab.id, entry);
  entry.p.then(() => chains.get(tab.id) === entry && chains.delete(tab.id));
  return entry.p;
}

// captureVisibleTab shoots whatever tab is on screen, so only take it while this tab is.
async function isShowing(tab) {
  try {
    return (await chrome.tabs.get(tab.id)).active;
  } catch (_) {
    return false;
  }
}

async function run(tab, { auto, documentId, stopOnly }) {
  const target = documentId ? { tabId: tab.id, documentIds: [documentId] } : { tabId: tab.id };
  let hidden = false;
  try {
    const [probe] = await chrome.scripting.executeScript({
      target,
      func: () => {
        const running = !!(window.__swarmRebuild && window.__swarmRebuild.app);
        let media = false;
        if (!running) {
          for (const el of document.querySelectorAll("canvas, video, iframe, embed, object")) {
            const r = el.getBoundingClientRect();
            if (r.width > 8 && r.height > 8 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth) {
              media = true;
              break;
            }
          }
        }
        return { running, media };
      },
    });
    const { running, media } = probe.result || {};
    if ((auto && running) || (stopOnly && !running)) return;
    // Without a click, Chrome only allows the screenshot with <all_urls> (every-site mode).
    const mayShoot = !auto || (await chrome.permissions.contains({ origins: ["<all_urls>"] }));
    if (!running && media && mayShoot && (await isShowing(tab))) {
      try {
        await chrome.scripting.insertCSS({ target, css: MEDIA_ONLY_CSS });
        hidden = true;
        await sleep(90);
        if (!(await isShowing(tab))) throw new Error("tab no longer on screen");
        const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
        if (!(await isShowing(tab))) throw new Error("tab left the screen during capture");
        await chrome.scripting.executeScript({
          target,
          func: (s) => {
            window.__swarmShot = s;
            window.__swarmHidden = true;
          },
          args: [shot],
        });
      } catch (_) {
        // no screenshot: those regions fall back to placeholders
        if (hidden) {
          await chrome.scripting.removeCSS({ target, css: MEDIA_ONLY_CSS }).catch(() => {});
          hidden = false;
        }
      }
    }
    await chrome.scripting.executeScript({ target, files: ["swarm.js"] });
    if (hidden) {
      // swarm.js unhides the page itself once its canvas covers it, and on a failed start.
      // If it never got that far (e.g. it threw while loading), put the page back here.
      const [check] = await chrome.scripting.executeScript({
        target,
        func: () => {
          if (window.__swarmRebuild && window.__swarmRebuild.app) return true;
          window.__swarmShot = null;
          window.__swarmHidden = false;
          return false;
        },
      });
      if (!(check && check.result)) await chrome.scripting.removeCSS({ target, css: MEDIA_ONLY_CSS }).catch(() => {});
    }
  } catch (err) {
    if (hidden) await chrome.scripting.removeCSS({ target, css: MEDIA_ONLY_CSS }).catch(() => {});
    if (auto) return;
    // chrome://, the Web Store, PDFs and other protected pages can't be scripted.
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#F24822" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "×" });
    await chrome.action.setTitle({ tabId: tab.id, title: "Swarm Rebuild can't run on this page" });
    setTimeout(() => {
      chrome.action.setBadgeText({ tabId: tab.id, text: "" });
      chrome.action.setTitle({ tabId: tab.id, title: "Swarm Rebuild (Alt+Shift+S)" });
    }, 2500);
  }
}

chrome.action.onClicked.addListener((tab) => rebuild(tab));

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // The swarm asks us to restore the page once its own canvas fully covers it.
  if (msg && msg.type === "swarm:unhide" && sender.tab) {
    const target = sender.documentId ? { tabId: sender.tab.id, documentIds: [sender.documentId] } : { tabId: sender.tab.id };
    chrome.scripting
      .removeCSS({ target, css: MEDIA_ONLY_CSS })
      .catch(() => {})
      .then(() => reply(true));
    return true;
  }
  // autoplay.js, on a page the user chose to have the swarm play on automatically.
  // (frameType, not frameId === 0: a page Chrome prerendered keeps a non-zero frame ID after it's shown)
  const top = sender.frameType ? sender.frameType === "outermost_frame" : sender.frameId === 0;
  if (msg && msg.type === "swarm:autoplay" && sender.tab && top) {
    chrome.storage.local.get("autoplay").then(({ autoplay = "off" }) => {
      if (autoplay !== "off") rebuild(sender.tab, { auto: true, documentId: sender.documentId });
    });
  }
});

// ---------------------------------------------------------------- autoplay
// Off by default. The options page asks Chrome for access to every site or to sites the user
// picks (optional host permissions) and stores the mode; here we keep a tiny loader script
// registered on exactly the sites we have access to, so nothing runs anywhere else.

const AUTOPLAY_ID = "autoplay";
let syncing = Promise.resolve();

function syncAutoplay() {
  syncing = syncing.then(async () => {
    try {
      const { autoplay = "off" } = await chrome.storage.local.get("autoplay");
      const { origins = [] } = await chrome.permissions.getAll();
      const broad = (o) => o === "<all_urls>" || /^(\*|https?):\/\/\*\//.test(o);
      const web = (o) => o === "<all_urls>" || /^(\*|https?):\/\//.test(o);
      // "sites I choose" never runs everywhere because of a broad grant made elsewhere (e.g. Chrome's own
      // menu). <all_urls> is what lets us screenshot without a click, but autoplay is for web pages only,
      // not local files, so it registers as http(s).
      const allowed = origins.filter((o) => web(o) && !(autoplay === "sites" && broad(o)));
      const matches = autoplay === "off" ? [] : [...new Set(allowed.map((o) => (o === "<all_urls>" ? "*://*/*" : o)))];
      await chrome.scripting.unregisterContentScripts({ ids: [AUTOPLAY_ID] }).catch(() => {});
      if (matches.length)
        await chrome.scripting.registerContentScripts([{ id: AUTOPLAY_ID, js: ["autoplay.js"], matches, runAt: "document_idle" }]);
    } catch (err) {
      console.warn("[swarm-rebuild] autoplay sync failed", err);
    }
  });
  return syncing;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.autoplay) syncAutoplay();
});
chrome.permissions.onAdded.addListener(() => syncAutoplay());
chrome.permissions.onRemoved.addListener(() => syncAutoplay());
chrome.runtime.onInstalled.addListener(() => syncAutoplay());
chrome.runtime.onStartup.addListener(() => syncAutoplay());
