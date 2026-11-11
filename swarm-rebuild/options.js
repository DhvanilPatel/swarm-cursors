// Automatic play settings. The mode lives in chrome.storage.local; which sites it may run on is
// whatever host access Chrome has granted (optional_host_permissions), so the two can't drift apart.
// background.js watches both and registers autoplay.js on exactly those sites.

// <all_urls> rather than *://*/*: Chrome only lets an extension screenshot a tab it wasn't clicked on
// with <all_urls>, and the screenshot is how canvases, video and embedded frames get rebuilt.
const ALL = ["<all_urls>"];
const $ = (s) => document.querySelector(s);
const radios = [...document.querySelectorAll('input[name="mode"]')];
let current = "off";

// example.com also covers www. and other subdomains; an IP address or localhost only itself.
const patternsFor = (host) => (/^[\d.]+$|^localhost$/.test(host) ? [`*://${host}/*`] : [`*://${host}/*`, `*://*.${host}/*`]);

function parseHost(text) {
  const t = text.trim();
  if (!t) return null;
  try {
    const u = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(t) ? t : `https://${t}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname || u.hostname.includes("*")) return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.hostname.replace(/^www\./, "");
  } catch (_) {
    return null;
  }
}

// host -> the exact origin patterns Chrome has granted for it (ours, or ones made in Chrome's own
// site-access menu such as https://example.com/*), so Remove revokes exactly what's there.
async function grantedSites() {
  const { origins = [] } = await chrome.permissions.getAll();
  const sites = new Map();
  for (const o of origins) {
    const m = o.match(/^(?:\*|https?):\/\/(?:\*\.)?([^/*]+)\/\*$/);
    if (m) sites.set(m[1], [...(sites.get(m[1]) || []), o]);
  }
  return new Map([...sites].sort(([a], [b]) => a.localeCompare(b)));
}

// Revoke and report honestly: Chrome won't drop access granted by policy or as a required permission.
async function revoke(origins) {
  // one at a time: Chrome rejects the whole call if any single origin can't be removed
  for (const o of origins) {
    try {
      await chrome.permissions.remove({ origins: [o] });
    } catch (_) {}
  }
  const { origins: left = [] } = await chrome.permissions.getAll();
  return !origins.some((o) => left.includes(o));
}

const say = (text) => ($("#status").textContent = text);

async function render() {
  ({ autoplay: current = "off" } = await chrome.storage.local.get("autoplay"));
  for (const r of radios) r.checked = r.value === current;
  $("#sites").hidden = current !== "sites";
  const list = $("#list");
  list.textContent = "";
  const sites = await grantedSites();
  if (!sites.size) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No sites yet.";
    list.append(li);
  }
  for (const [host, origins] of sites) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = host;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.textContent = "Remove";
    rm.addEventListener("click", async () => {
      say((await revoke(origins)) ? `Removed ${host}.` : `Chrome kept access to ${host}. You can change it in Chrome's extension settings.`);
      render();
    });
    li.append(name, rm);
    list.append(li);
  }
}

async function setMode(mode) {
  try {
    if (mode === "all" && !(await chrome.permissions.request({ origins: ALL }))) {
      say("Chrome didn't get permission, so nothing changed.");
      return;
    }
    // (in "sites" mode the background ignores any every-site grant that Chrome keeps)
    if (mode === "sites") await revoke(ALL);
    const revoked = mode !== "off" || (await revoke((await chrome.permissions.getAll()).origins || []));
    await chrome.storage.local.set({ autoplay: mode });
    say(
      mode === "off"
        ? revoked
          ? "The swarm only plays when you click it. Site access removed."
          : "The swarm only plays when you click it. Chrome kept some site access; you can change it in Chrome's extension settings."
        : mode === "all"
          ? "The swarm will play on every page you open."
          : "Add the sites you want the swarm to play on."
    );
  } finally {
    render();
  }
}

for (const r of radios) r.addEventListener("change", () => r.checked && setMode(r.value));

$("#add").addEventListener("submit", async (e) => {
  e.preventDefault();
  const host = parseHost($("#host").value);
  if (!host) {
    say("Enter a site like example.com.");
    return;
  }
  // request() must run straight from the click, before any other await
  const ok = await chrome.permissions.request({ origins: patternsFor(host) });
  if (!ok) {
    say(`Chrome didn't get permission for ${host}.`);
    return;
  }
  $("#host").value = "";
  if (current !== "sites") await chrome.storage.local.set({ autoplay: "sites" });
  say(`The swarm will play on ${host}.`);
  render();
});

render();
