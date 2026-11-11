// Registered only on sites where the user turned on automatic play (see options.html).
// Once the page has loaded and is actually on screen (not prerendering, not a background or
// restored tab nobody is looking at), asks the background to start the swarm. Once per page.
(() => {
  let sent = false;
  const go = () => {
    if (sent || document.readyState !== "complete" || document.prerendering || document.visibilityState !== "visible") return;
    sent = true;
    chrome.runtime.sendMessage({ type: "swarm:autoplay" }).catch(() => {});
  };
  addEventListener("load", go);
  document.addEventListener("visibilitychange", go);
  document.addEventListener("prerenderingchange", go);
  go();
})();
