/*
 * Swarm Rebuild
 *
 * Snapshots the current page into a blueprint (boxes, text blocks, media,
 * borders, repeated components), blanks the page, then lets a swarm of
 * multiplayer cursors rebuild it on a canvas: crosshair-drawn rects, typed
 * text, pen-tool lines, ruler guides with snapping, alt-drag duplicates.
 *
 * Injected by background.js; injecting again toggles it off.
 */
(() => {
  "use strict";

  const KEY = "__swarmRebuild";
  if (window[KEY]) {
    window[KEY].toggle();
    return;
  }

  // ---------------------------------------------------------------- constants

  const NAMES = [
    "Ada", "Linus", "Grace", "Alan", "Margaret", "Ken", "Barbara", "Dennis",
    "Radia", "Guido", "Frances", "Bjarne", "Hedy", "Tim", "Katherine", "Edsger",
    "Joan", "Donald", "Sophie", "Niklaus", "Anita", "Brian", "Mary", "Rob",
    "Ida", "Yukihiro", "Shafi", "Leslie", "Jean", "Vint", "Lynn", "Bram",
  ];
  const COLORS = [
    "#F24E1E", "#A259FF", "#1ABCFE", "#0ACF83", "#FF7262", "#FFC700",
    "#9747FF", "#E8467C", "#14AE5C", "#0D99FF", "#FF8A00", "#00B5CE",
  ];
  const BLUE = "#0D99FF";
  const RED = "#F24822";
  const RULER = 20;
  const MIN_AGENTS = 8;
  const MAX_AGENTS = 48;
  const FLOCK_AGENTS = 36;
  const INTRO_AGENTS = 18;
  const MAX_ITEMS = 4000;
  const MAX_WORLD_H = 40000;
  const SVGNS = "http://www.w3.org/2000/svg";

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const bump = (it) => {
    it.v++;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const f1 = (n) => Math.round(n * 10) / 10;

  function alphaOf(c) {
    if (!c || c === "transparent") return 0;
    const slash = c.match(/\/\s*([\d.]+%?)\s*\)/);
    if (slash) return slash[1].endsWith("%") ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
    const m = c.match(/^rgba\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(",");
      return p.length >= 4 ? parseFloat(p[3]) : 1;
    }
    return 1;
  }

  function intersect(a, b) {
    if (!a || !b) return null;
    const l = Math.max(a.l, b.l);
    const t = Math.max(a.t, b.t);
    const r = Math.min(a.r, b.r);
    const bt = Math.min(a.b, b.b);
    return r > l && bt > t ? { l, t, r, b: bt } : null;
  }

  const ltrb = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });

  // ----------------------------------------------------------- cursor shapes

  const ARROW_D =
    "M4.6 3.9 C4.2 3.1 4.9 2.4 5.7 2.8 L20.6 9.4 C21.5 9.8 21.4 11.1 20.4 11.3 L13.9 12.9 C13.4 13 13 13.4 12.9 13.9 L11.3 20.4 C11.1 21.4 9.8 21.5 9.4 20.6 Z";
  const HOT = {
    arrow: [5, 3.5],
    dup: [5, 3.5],
    pen: [3, 3],
    "pen-add": [3, 3],
    "pen-close": [3, 3],
    cross: [12, 12],
    ibeam: [12, 12],
    ew: [12, 12],
    ns: [12, 12],
  };

  function cursorSVG(shape, c) {
    const st = 'stroke="#fff" stroke-width="1.5" stroke-linejoin="round"';
    switch (shape) {
      case "arrow":
        return `<path d="${ARROW_D}" fill="${c}" ${st}/>`;
      case "dup":
        return (
          `<path d="${ARROW_D}" transform="translate(4 3.5)" fill="#fff" stroke="${c}" stroke-width="1.3" stroke-linejoin="round"/>` +
          `<path d="${ARROW_D}" fill="${c}" ${st}/>`
        );
      case "pen":
      case "pen-add":
      case "pen-close": {
        let s =
          `<path d="M17.4 10.6 L20.6 13.8 L13.8 20.6 L10.6 17.4 Z" fill="${c}" ${st}/>` +
          `<path d="M3 3 L13.1 6.3 L17.4 10.6 L10.6 17.4 L6.3 13.1 Z" fill="${c}" ${st}/>` +
          `<path d="M3.6 3.6 L8.9 8.9" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>` +
          `<circle cx="10.2" cy="10.2" r="1.75" fill="none" stroke="#fff" stroke-width="1.2"/>`;
        if (shape === "pen-add")
          s +=
            `<g stroke-linecap="round"><path d="M23 19.5 V26.5 M19.5 23 H26.5" stroke="#fff" stroke-width="3.4"/>` +
            `<path d="M23 19.5 V26.5 M19.5 23 H26.5" stroke="#1E1E1E" stroke-width="1.3"/></g>`;
        if (shape === "pen-close")
          s +=
            `<circle cx="23" cy="23" r="2.8" fill="none" stroke="#fff" stroke-width="3.2"/>` +
            `<circle cx="23" cy="23" r="2.8" fill="none" stroke="#1E1E1E" stroke-width="1.2"/>`;
        return s;
      }
      case "cross":
        return (
          `<g stroke-linecap="round"><path d="M12 3.5 V20.5 M3.5 12 H20.5" stroke="#fff" stroke-width="3.6"/>` +
          `<path d="M12 3.5 V20.5 M3.5 12 H20.5" stroke="${c}" stroke-width="1.5"/></g>`
        );
      case "ibeam": {
        const d =
          "M8.5 4.5 H10.5 Q12 4.5 12 6 Q12 4.5 13.5 4.5 H15.5 M12 6 V18 M8.5 19.5 H10.5 Q12 19.5 12 18 Q12 19.5 13.5 19.5 H15.5";
        return (
          `<g fill="none" stroke-linecap="round"><path d="${d}" stroke="#fff" stroke-width="3.6"/>` +
          `<path d="${d}" stroke="${c}" stroke-width="1.5"/></g>`
        );
      }
      case "ew":
      case "ns":
        return `<path d="M2.5 12 L7 7.5 V10.4 H17 V7.5 L21.5 12 L17 16.5 V13.6 H7 V16.5 Z"${
          shape === "ns" ? ' transform="rotate(90 12 12)"' : ""
        } fill="${c}" ${st}/>`;
    }
    return "";
  }

  const IMG_ICON =
    '<svg class="ph" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18 L10 13 L14 16 L17 13.5 L21 17"/></svg>';

  // ------------------------------------------------------------------ capture

  const SKIP = new Set([
    "script", "style", "noscript", "template", "head", "meta", "link", "title",
    "base", "datalist", "area", "map", "source", "track", "param", "swarm-rebuild",
  ]);
  const DROP_IN_CLONE = new Set(["script", "style", "noscript", "template", "iframe", "object", "embed", "link", "meta"]);
  const REPLACED = new Set(["img", "svg", "video", "canvas", "iframe", "embed", "object", "picture"]);
  const FORMS = new Set(["input", "textarea", "select"]);
  const ATOMIC = new Set(["img", "svg", "video", "canvas", "input", "select", "textarea", "iframe", "picture", "button"]);

  const TEXT_PROPS = [
    "color", "font-family", "font-size", "font-weight", "font-style", "font-variant",
    "font-stretch", "font-feature-settings", "font-variation-settings", "font-kerning",
    "font-optical-sizing", "line-height", "letter-spacing", "word-spacing",
    "text-transform", "text-align", "text-indent", "text-decoration-line",
    "text-decoration-color", "text-decoration-style", "text-decoration-thickness",
    "text-underline-offset", "text-shadow", "white-space", "white-space-collapse",
    "text-wrap-mode", "text-wrap-style", "direction", "overflow-wrap", "word-break",
    "hyphens", "tab-size", "-webkit-text-fill-color", "-webkit-text-stroke-width",
    "-webkit-text-stroke-color", "text-rendering", "-webkit-font-smoothing",
    "list-style-type", "list-style-position", "list-style-image", "writing-mode",
  ];
  const BOX_PROPS = [
    "display", "box-sizing", "width", "height", "min-width", "min-height", "max-width",
    "max-height", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "margin-top", "margin-right", "margin-bottom", "margin-left", "border-top-width",
    "border-right-width", "border-bottom-width", "border-left-width", "border-top-style",
    "border-right-style", "border-bottom-style", "border-left-style", "border-top-color",
    "border-right-color", "border-bottom-color", "border-left-color",
    "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius",
    "border-bottom-left-radius", "background-color", "background-image",
    "background-size", "background-position", "background-repeat", "background-clip",
    "-webkit-background-clip", "box-shadow", "opacity", "vertical-align", "position",
    "top", "right", "bottom", "left", "flex-direction", "flex-wrap", "align-items",
    "justify-content", "gap", "flex-grow", "flex-shrink", "flex-basis", "align-self",
    "object-fit", "object-position", "overflow-x", "overflow-y", "text-overflow",
    "-webkit-line-clamp", "-webkit-box-orient", "visibility", "transform", "filter",
    "float", "fill", "stroke", "clip-path", "mix-blend-mode",
    "-webkit-mask-image", "-webkit-mask-size", "-webkit-mask-position", "-webkit-mask-repeat",
  ];
  const ELEM_PROPS = [...TEXT_PROPS, ...BOX_PROPS];
  const SVG_PROPS = [
    "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
    "stroke-dasharray", "stroke-dashoffset", "stroke-miterlimit", "fill-opacity",
    "stroke-opacity", "fill-rule", "clip-rule", "opacity", "color", "stop-color",
    "stop-opacity", "display", "visibility", "font-family", "font-size", "font-weight",
    "text-anchor", "dominant-baseline", "letter-spacing", "mix-blend-mode", "filter",
  ];
  const SVG_OUTER_PROPS = [
    "margin-top", "margin-right", "margin-bottom", "margin-left", "vertical-align", "display",
    "position", "top", "right", "bottom", "left", "transform", "transform-origin",
    "flex-shrink", "flex-grow", "align-self", "order", "overflow",
  ];
  const RECT_PROPS = [
    "background-color", "background-image", "background-size", "background-position",
    "background-repeat", "background-origin", "background-clip", "border-top-width",
    "border-right-width", "border-bottom-width", "border-left-width", "border-top-style",
    "border-right-style", "border-bottom-style", "border-left-style", "border-top-color",
    "border-right-color", "border-bottom-color", "border-left-color",
    "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius",
    "border-bottom-left-radius", "box-shadow", "backdrop-filter", "filter", "clip-path",
    "-webkit-mask-image", "-webkit-mask-size", "-webkit-mask-position", "-webkit-mask-repeat",
  ];

  function styleString(cs, props) {
    let s = "";
    for (const p of props) {
      const v = cs.getPropertyValue(p);
      if (v !== "") s += `${p}:${v};`;
    }
    return s;
  }

  const lhPx = (cs) => {
    const v = parseFloat(cs.lineHeight);
    return isNaN(v) ? (parseFloat(cs.fontSize) || 16) * 1.2 : v;
  };

  function kidsOf(el) {
    if (el.shadowRoot) return [...el.shadowRoot.childNodes];
    if (el.localName === "slot") {
      const a = el.assignedNodes({ flatten: true });
      return a.length ? a : [...el.childNodes];
    }
    return [...el.childNodes];
  }

  // Copy one element's computed style onto its clone, fix up media sources.
  // ::before / ::after become real spans so icons, chevrons and separators survive.
  function pseudoClone(src, which) {
    const ps = getComputedStyle(src, which);
    const c = ps.content;
    if (!c || c === "none" || c === "normal" || ps.display === "none") return null;
    const sp = document.createElement("span");
    const str = c.match(/^"((?:[^"\\]|\\.)*)"/);
    if (str) sp.textContent = str[1].replace(/\\(.)/g, "$1");
    else if (/^url\(/.test(c)) {
      const u = c.match(/^url\(\s*["']?([^"')]+)["']?\s*\)/);
      if (u) {
        const im = document.createElement("img");
        im.src = u[1];
        im.setAttribute("style", "display:inline-block;vertical-align:middle;");
        sp.appendChild(im);
      }
    }
    sp.setAttribute("style", styleString(ps, ELEM_PROPS));
    return sp;
  }

  function addPseudos(src, dst) {
    const b = pseudoClone(src, "::before");
    if (b) dst.insertBefore(b, dst.firstChild);
    const a = pseudoClone(src, "::after");
    if (a) dst.appendChild(a);
  }

  function prepClone(src, dst) {
    const tag = src.localName;
    if (DROP_IN_CLONE.has(tag)) {
      dst.remove();
      return null;
    }
    const cs = getComputedStyle(src);
    if (cs.display === "none") {
      dst.remove();
      return null;
    }
    const isSvg = src instanceof SVGElement;
    let st = styleString(cs, isSvg ? SVG_PROPS : ELEM_PROPS);
    if (isSvg && tag === "svg" && !src.ownerSVGElement) {
      dst.setAttribute("width", src.clientWidth || src.getBoundingClientRect().width);
      dst.setAttribute("height", src.clientHeight || src.getBoundingClientRect().height);
      st += styleString(cs, SVG_OUTER_PROPS);
    }
    dst.setAttribute("style", st);
    for (const a of [...dst.attributes]) {
      const n = a.name;
      if (n.startsWith("on") || n === "contenteditable" || n === "tabindex" || n === "autofocus" || n === "srcset" || n === "sizes" || n === "loading")
        dst.removeAttribute(n);
    }
    if (tag === "img") {
      dst.setAttribute("src", imgSrc(src));
      dst.setAttribute("decoding", "async");
    }
    if (tag === "svg") fixSvgRefs(src, dst);
    // Clones live in the page's document: custom elements would be upgraded by the
    // site's own JS (and often wipe their content), media would play. Swap in inert stand-ins.
    if (tag === "audio") {
      dst.remove();
      return null;
    }
    if (tag === "video" || tag === "canvas" || (!isSvg && tag.includes("-"))) {
      let rep;
      const vurl = tag === "video" ? videoUrl(src) : null;
      if (vurl) {
        rep = document.createElement("video");
        for (const [k, v] of [["src", vurl], ["muted", ""], ["playsinline", ""], ["preload", "auto"]]) rep.setAttribute(k, v);
        if (!src.paused || src.autoplay) rep.setAttribute("autoplay", "");
        if (src.loop || src.autoplay || !src.paused) rep.setAttribute("loop", "");
        if (src.poster) rep.setAttribute("poster", src.poster);
      } else if (tag === "video" || tag === "canvas") {
        let url = tag === "video" ? src.poster : canvasPixels(src);
        rep = document.createElement(url ? "img" : "span");
        if (url) rep.setAttribute("src", url);
        else st += "background:#1b1b1f;";
      } else {
        rep = document.createElement("span");
        while (dst.firstChild) rep.appendChild(dst.firstChild);
      }
      rep.setAttribute("style", st);
      if (dst.parentNode) dst.replaceWith(rep);
      dst = rep;
    }
    if (!isSvg && !REPLACED.has(tag) && !FORMS.has(tag) && tag !== "img") addPseudos(src, dst);
    return dst;
  }

  // Clones are made in a document without a custom-element registry so the
  // site's component code never runs on them.
  let inertDoc = null;
  const inert = () => inertDoc || (inertDoc = document.implementation.createHTMLDocument(""));

  function cloneStyled(src) {
    const dst = inert().importNode(src, true);
    const a = [...src.querySelectorAll("*")];
    const b = [...dst.querySelectorAll("*")];
    const root = prepClone(src, dst) || document.createElement("span");
    for (let i = 0; i < a.length && i < b.length; i++) prepClone(a[i], b[i]);
    return root;
  }

  function cloneDescendantsStyled(src, dst) {
    const a = src.querySelectorAll("*");
    const b = dst.querySelectorAll("*");
    for (let i = 0; i < a.length && i < b.length; i++) prepClone(a[i], b[i]);
  }

  function imgSrc(img) {
    let s = img.currentSrc || img.src || "";
    const lazy = img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-original");
    if (lazy && (!s || s.startsWith("data:") || !img.complete || !img.naturalWidth)) {
      try {
        s = new URL(lazy, location.href).href;
      } catch (_) {}
    }
    return s;
  }

  // Shadow trees can't see document-level <symbol>/<linearGradient> ids, so
  // inline anything the clone references.
  function fixSvgRefs(src, dst) {
    for (const u of dst.querySelectorAll("use")) {
      const href = u.getAttribute("href") || u.getAttribute("xlink:href");
      if (!href || href[0] !== "#") continue;
      const ref = document.getElementById(href.slice(1));
      if (!ref) continue;
      const isSym = ref.localName === "symbol";
      const g = document.createElementNS(SVGNS, isSym ? "svg" : "g");
      if (isSym) {
        for (const at of ["viewBox", "preserveAspectRatio"]) if (ref.getAttribute(at)) g.setAttribute(at, ref.getAttribute(at));
        g.setAttribute("width", u.getAttribute("width") || "100%");
        g.setAttribute("height", u.getAttribute("height") || "100%");
        g.setAttribute("x", u.getAttribute("x") || 0);
        g.setAttribute("y", u.getAttribute("y") || 0);
        g.setAttribute("overflow", "visible");
      } else if (u.getAttribute("x") || u.getAttribute("y")) {
        g.setAttribute("transform", `translate(${u.getAttribute("x") || 0} ${u.getAttribute("y") || 0})`);
      }
      const us = u.getAttribute("style");
      if (us) g.setAttribute("style", us);
      for (const ch of ref.childNodes) {
        if (ch.nodeType !== 1) {
          g.appendChild(ch.cloneNode(true));
          continue;
        }
        g.appendChild(cloneStyled(ch));
      }
      u.replaceWith(g);
    }
    const html = dst.outerHTML;
    const ids = new Set();
    html.replace(/url\(\s*["']?#([^"')\s]+)["']?\s*\)/g, (_, id) => ids.add(id));
    if (!ids.size) return;
    let defs = null;
    for (const id of ids) {
      if (dst.querySelector(`[id="${CSS.escape(id)}"]`)) continue;
      const ref = document.getElementById(id);
      if (!ref) continue;
      if (!defs) {
        defs = document.createElementNS(SVGNS, "defs");
        dst.insertBefore(defs, dst.firstChild);
      }
      defs.appendChild(ref.cloneNode(true));
    }
  }

  // Pixels for things the DOM can't give back (WebGL canvases, playing video,
  // cross-origin iframes) come from a screenshot taken when the user clicked.
  function cropShot(shot, r) {
    if (!shot || !shot.valid) return null;
    if (r.height > innerHeight * 3 || r.width > innerWidth * 2) return null;
    const vis = intersect(ltrb(r), { l: 0, t: 0, r: innerWidth, b: innerHeight });
    if (!vis) return null;
    const k = shot.scale;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(r.width * k));
    c.height = Math.max(1, Math.round(r.height * k));
    const w = (vis.r - vis.l) * k;
    const h = (vis.b - vis.t) * k;
    c.getContext("2d").drawImage(shot.img, vis.l * k, vis.t * k, w, h, (vis.l - r.left) * k, (vis.t - r.top) * k, w, h);
    const full = vis.l <= r.left + 1 && vis.t <= r.top + 1 && vis.r >= r.right - 1 && vis.b >= r.bottom - 1;
    try {
      return c.toDataURL(full ? "image/jpeg" : "image/webp", 0.9);
    } catch (_) {
      return null;
    }
  }

  // A URL another <video> can play: the chosen source, a <source>, or a lazy-load data-src.
  // (blob:/MediaSource streams are tied to the original element and can't be reused.)
  function videoUrl(el) {
    const cands = [el.currentSrc, el.getAttribute("src"), el.getAttribute("data-src")];
    for (const s of el.querySelectorAll("source")) cands.push(s.getAttribute("src"), s.getAttribute("data-src"));
    for (const c of cands) {
      if (!c || /^(blob|mediasource):/i.test(c)) continue;
      try {
        return new URL(c, location.href).href;
      } catch (_) {}
    }
    return null;
  }

  function canvasPixels(el) {
    try {
      const probe = document.createElement("canvas");
      probe.width = probe.height = 12;
      const g = probe.getContext("2d");
      g.drawImage(el, 0, 0, 12, 12);
      const d = g.getImageData(0, 0, 12, 12).data;
      let a = 0;
      for (let i = 3; i < d.length; i += 4) a += d[i];
      return a > 0 ? el.toDataURL() : null;
    } catch (_) {
      return null;
    }
  }

  function boxyStyle(st) {
    if (alphaOf(st.backgroundColor) > 0.02) return true;
    if (st.backgroundImage && st.backgroundImage !== "none") return true;
    if (st.boxShadow && st.boxShadow !== "none") return true;
    for (const s of ["Top", "Right", "Bottom", "Left"]) {
      if (parseFloat(st["border" + s + "Width"]) > 0 && st["border" + s + "Style"] !== "none" && alphaOf(st["border" + s + "Color"]) > 0.02) return true;
    }
    return false;
  }

  function sameColor(a, b) {
    return (a || "").replace(/\s/g, "") === (b || "").replace(/\s/g, "");
  }

  function pageBackground() {
    const h = document.documentElement;
    const b = document.body;
    const hs = getComputedStyle(h);
    const bs = b ? getComputedStyle(b) : null;
    const pick = (cs) => ({
      color: cs.backgroundColor,
      image: cs.backgroundImage,
      size: cs.backgroundSize,
      position: cs.backgroundPosition,
      repeat: cs.backgroundRepeat,
    });
    if (alphaOf(hs.backgroundColor) > 0.01 || hs.backgroundImage !== "none") return { ...pick(hs), from: h };
    if (bs && (alphaOf(bs.backgroundColor) > 0.01 || bs.backgroundImage !== "none")) return { ...pick(bs), from: b };
    const dark = /dark/.test(hs.colorScheme) && matchMedia("(prefers-color-scheme: dark)").matches;
    return { color: dark ? "rgb(18, 18, 18)" : "rgb(255, 255, 255)", image: "none", from: null };
  }

  /**
   * Walk the live DOM and produce a blueprint the swarm can rebuild.
   * Items live in "world" coords (scroller content space) or, for fixed UI,
   * in screen coords on an "over"/"under" layer.
   */
  function captureModel(env, shot) {
    const { ox, oy, sx, sy, vw, vh } = env.geom();
    const docW = Math.max(env.scrollWidth(), vw);
    const docH = Math.min(Math.max(env.scrollHeight(), vh), MAX_WORLD_H);
    const items = [];
    const roots = [];
    let order = 0;
    const csCache = new Map();
    const css = (el) => {
      let c = csCache.get(el);
      if (!c) {
        c = getComputedStyle(el);
        csCache.set(el, c);
      }
      return c;
    };
    const inlineCache = new Map();
    const fullClip = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 };
    const viewClip = { l: 0, t: 0, r: innerWidth, b: innerHeight };
    const pageBg = env.pageBg;
    const floats = [];
    const bars = [];
    let portKey = null;
    const html = document.documentElement;
    const body = document.body;

    const conv = (r, layer) =>
      layer === "world"
        ? { x: r.left - ox + sx, y: r.top - oy + sy, w: r.width, h: r.height }
        : { x: r.left, y: r.top, w: r.width, h: r.height };
    const convClip = (c, layer) =>
      layer === "world" ? { l: c.l - ox + sx, t: c.t - oy + sy, r: c.r - ox + sx, b: c.b - oy + sy } : { ...c };
    const clipFor = (r, clip, layer) => {
      if (r.left >= clip.l - 0.5 && r.top >= clip.t - 0.5 && r.right <= clip.r + 0.5 && r.bottom <= clip.b + 0.5) return null;
      return convClip(clip, layer);
    };
    const inDoc = (b, layer) =>
      layer === "world"
        ? b.x + b.w > 0 && b.x < docW && b.y + b.h > 0 && b.y < docH
        : b.x + b.w > 0 && b.x < innerWidth && b.y + b.h > 0 && b.y < innerHeight;

    function add(it) {
      it.id = items.length;
      it.v = 1;
      it.rv = 0;
      it.vis = false;
      it.dx = 0;
      it.dy = 0;
      it.scale = 1;
      it.mode = "own";
      items.push(it);
      return it;
    }

    function allInline(el) {
      let v = inlineCache.get(el);
      if (v !== undefined) return v;
      v = !el.shadowRoot;
      if (v)
        for (const c of el.children) {
          const tag = c.localName;
          if (SKIP.has(tag) || tag === "br" || tag === "wbr") continue;
          if (c instanceof SVGElement) continue;
          const d = css(c).display;
          if (d === "none") continue;
          if (d === "inline") {
            if (!allInline(c)) {
              v = false;
              break;
            }
          } else if (!d.startsWith("inline")) {
            v = false;
            break;
          }
        }
      inlineCache.set(el, v);
      return v;
    }

    function rootStyle(cs, isRun) {
      let s = styleString(cs, TEXT_PROPS);
      if (isRun) return s + "display:block;padding:0;margin:0;box-sizing:border-box;width:100%;height:100%;position:relative;";
      const pad = (side) =>
        (parseFloat(cs.getPropertyValue(`padding-${side}`)) || 0) + (parseFloat(cs.getPropertyValue(`border-${side}-width`)) || 0);
      let d = cs.display;
      if (/flex/.test(d)) {
        d = "flex";
        s += styleString(cs, ["flex-direction", "flex-wrap", "align-items", "justify-content", "align-content", "row-gap", "column-gap"]);
      } else if (/grid/.test(d)) {
        d = "grid";
        s += styleString(cs, [
          "grid-template-columns", "grid-template-rows", "grid-auto-flow", "grid-auto-columns",
          "grid-auto-rows", "align-items", "justify-items", "justify-content", "align-content",
          "row-gap", "column-gap",
        ]);
      } else if (d === "list-item" || d === "-webkit-box") {
        // keep
      } else d = "block";
      s += `display:${d};padding:${pad("top")}px ${pad("right")}px ${pad("bottom")}px ${pad("left")}px;`;
      if (cs.overflowX !== "visible" || cs.overflowY !== "visible" || cs.textOverflow === "ellipsis" || (cs.webkitLineClamp && cs.webkitLineClamp !== "none")) {
        s += styleString(cs, ["overflow-x", "overflow-y", "text-overflow", "-webkit-line-clamp", "-webkit-box-orient"]);
      }
      return s + "margin:0;box-sizing:border-box;width:100%;height:100%;position:relative;";
    }

    function textItem(base, root, tb, cs, layer, extra) {
      const fs = parseFloat(cs.fontSize) || 16;
      const text = root.textContent.replace(/\s+/g, " ").trim();
      return add({
        kind: "text",
        ...base,
        tb,
        full: root,
        fs,
        lh: lhPx(cs),
        align: cs.textAlign,
        text,
        sig: text,
        ...extra,
      });
    }

    function emitLeaf(el, cs, r, ctx, key) {
      const root = document.createElement("div");
      root.setAttribute("style", rootStyle(cs, false));
      const clone = inert().importNode(el, true);
      cloneDescendantsStyled(el, clone);
      while (clone.firstChild) root.appendChild(clone.firstChild);
      addPseudos(el, root);
      const rg = document.createRange();
      rg.selectNodeContents(el);
      const tr = rg.getBoundingClientRect();
      // table cells center their content vertically; reproduce the offset
      if (cs.display === "table-cell" && tr.height) root.style.paddingTop = Math.max(0, tr.top - r.top) + "px";
      // floats outside the leaf (figures, infoboxes) shape its line boxes: add invisible shims
      if (/^(block|list-item)$/.test(root.style.display)) {
        const n = (p) => parseFloat(cs.getPropertyValue(p)) || 0;
        const cl = r.left + n("border-left-width") + n("padding-left");
        const ct = r.top + n("border-top-width") + n("padding-top");
        const cr = r.right - n("border-right-width") - n("padding-right");
        for (const f of floats) {
          if (f.b <= r.top + 1 || f.t >= r.bottom - 1 || f.r <= r.left + 1 || f.l >= r.right - 1) continue;
          if (f.el.contains(el)) continue;
          const shim = document.createElement("div");
          const top = Math.max(0, f.t - ct);
          const w = f.side === "left" ? f.r - cl : cr - f.l;
          if (w <= 0) continue;
          shim.setAttribute("style", `float:${f.side};clear:${f.side};width:${w}px;height:${Math.max(0, f.b - Math.max(f.t, ct))}px;margin-top:${top}px;`);
          root.insertBefore(shim, root.firstChild);
        }
      }
      const box = conv(r, ctx.layer);
      const tb = tr.width > 0 && tr.height > 0 ? conv(tr, ctx.layer) : { ...box };
      tb.x = clamp(tb.x, box.x - 4, box.x + box.w);
      tb.y = clamp(tb.y, box.y - 4, box.y + box.h);
      textItem(
        { ...box, layer: ctx.layer, key, op: ctx.op, clip: clipFor(r, ctx.clip, ctx.layer), parentBox: ctx.boxItem, blend: cs.mixBlendMode !== "normal" ? cs.mixBlendMode : ctx.blend || "" },
        root,
        tb,
        cs,
        ctx.layer,
      );
    }

    function emitRun(el, cs, run, ctx) {
      const rg = document.createRange();
      rg.setStartBefore(run[0]);
      rg.setEndAfter(run[run.length - 1]);
      const r = rg.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      if (!intersect(ltrb(r), ctx.clip)) return;
      const root = document.createElement("div");
      root.setAttribute("style", rootStyle(cs, true));
      const single = r.height < lhPx(cs) * 1.6;
      if (single) root.style.whiteSpace = "nowrap";
      for (const n of run) {
        if (n.nodeType === 3) root.appendChild(document.createTextNode(n.data));
        else root.appendChild(cloneStyled(n));
      }
      const box = conv(r, ctx.layer);
      if (!inDoc(box, ctx.layer)) return;
      box.w += 1;
      textItem(
        { ...box, layer: ctx.layer, key: ctx.key(), op: ctx.op, clip: clipFor(r, ctx.clip, ctx.layer), parentBox: ctx.boxItem, blend: ctx.blend || "" },
        root,
        { ...box },
        cs,
        ctx.layer,
      );
    }

    function lineItem(pts, stroke, sw, dash, ctx, key) {
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      return add({
        kind: "line",
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
        pts,
        stroke,
        sw,
        dash,
        placed: 0,
        shut: false,
        edit: false,
        owner: null,
        layer: ctx.layer,
        key,
        op: ctx.op,
        clip: null,
        parentBox: ctx.boxItem,
        sig: pts.length + stroke,
      });
    }

    function emitBox(el, cs, r, ctx, key, forceRect) {
      if (el === html) return null;
      const tag = el.localName;
      const bgc = cs.backgroundColor;
      const bgi = cs.backgroundImage;
      const bgVisible = (alphaOf(bgc) > 0.01 && !sameColor(bgc, pageBg.color)) || bgi !== "none";
      if (el === body && pageBg.from === body) return null;
      const sides = ["top", "right", "bottom", "left"].map((s) => {
        const w = parseFloat(cs.getPropertyValue(`border-${s}-width`)) || 0;
        const st = cs.getPropertyValue(`border-${s}-style`);
        const c = cs.getPropertyValue(`border-${s}-color`);
        return w > 0 && st !== "none" && st !== "hidden" && alphaOf(c) > 0.02 ? { s, w, st, c } : null;
      });
      const nb = sides.filter(Boolean).length;
      const shadow = cs.boxShadow && cs.boxShadow !== "none";
      const backdrop = cs.backdropFilter && cs.backdropFilter !== "none";
      const b = conv(r, ctx.layer);
      if (tag === "hr") {
        const c = sides[0] ? sides[0].c : alphaOf(bgc) > 0.01 ? bgc : "rgb(200,200,200)";
        const y = b.y + b.h / 2;
        lineItem([{ x: b.x, y }, { x: b.x + b.w, y }], c, Math.max(1, Math.min(b.h, 2)), null, ctx, key);
        return null;
      }
      const sameAsPage = alphaOf(bgc) > 0.01 && sameColor(bgc, pageBg.color) && bgi === "none";
      if (!forceRect && !bgVisible && !shadow && !backdrop) {
        if (nb === 0) return null;
        if (nb < 4) {
          for (const sd of sides) {
            if (!sd) continue;
            const hw = sd.w / 2;
            let pts;
            if (sd.s === "top") pts = [{ x: b.x, y: b.y + hw }, { x: b.x + b.w, y: b.y + hw }];
            else if (sd.s === "bottom") pts = [{ x: b.x, y: b.y + b.h - hw }, { x: b.x + b.w, y: b.y + b.h - hw }];
            else if (sd.s === "left") pts = [{ x: b.x + hw, y: b.y }, { x: b.x + hw, y: b.y + b.h }];
            else pts = [{ x: b.x + b.w - hw, y: b.y }, { x: b.x + b.w - hw, y: b.y + b.h }];
            const dash = sd.st === "dashed" ? `${sd.w * 3} ${sd.w * 2}` : sd.st === "dotted" ? `${sd.w} ${sd.w * 1.5}` : null;
            lineItem(pts, sd.c, sd.w, dash, ctx, key);
          }
          return null;
        }
      }
      if (sameAsPage && nb === 0 && !shadow && !backdrop && !forceRect) return null;
      const cssText = styleString(cs, RECT_PROPS);
      return add({
        kind: "rect",
        blend: cs.mixBlendMode !== "normal" ? cs.mixBlendMode : ctx.blend || "",
        big: b.w * b.h > vw * vh * 0.4,
        ...b,
        css: cssText,
        radius: cs.borderRadius,
        draw: null,
        styled: false,
        layer: ctx.layer,
        key,
        op: ctx.op,
        clip: clipFor(r, ctx.clip, ctx.layer),
        parentBox: ctx.boxItem,
        sig: cssText,
      });
    }

    // Decorative ::before/::after on containers (overlays, glows, standalone icons).
    // Their boxes aren't exposed, so derive them from the host box and the pseudo's insets.
    const PSEUDO_EL = { localName: "pseudo" };
    function emitPseudoBox(el, cs, r, ctx, which, empty) {
      const ps = getComputedStyle(el, which);
      const c = ps.content;
      if (!c || c === "none" || c === "normal" || ps.display === "none" || ps.visibility !== "visible") return;
      const pop = parseFloat(ps.opacity);
      if (!(pop > 0.03)) return;
      const n = (v) => parseFloat(v) || 0;
      const w = parseFloat(ps.width);
      const h = parseFloat(ps.height);
      if (!(w > 0 && h > 0)) return;
      const pad = {
        l: r.left + n(cs.borderLeftWidth), t: r.top + n(cs.borderTopWidth),
        r: r.right - n(cs.borderRightWidth), b: r.bottom - n(cs.borderBottomWidth),
      };
      let L;
      let T;
      if (ps.position === "absolute") {
        if (cs.position === "static") return; // containing block is some other ancestor
        const bw = w + n(ps.paddingLeft) + n(ps.paddingRight) + n(ps.borderLeftWidth) + n(ps.borderRightWidth);
        const bh = h + n(ps.paddingTop) + n(ps.paddingBottom) + n(ps.borderTopWidth) + n(ps.borderBottomWidth);
        L = ps.left !== "auto" ? pad.l + n(ps.left) : ps.right !== "auto" ? pad.r - n(ps.right) - bw : pad.l;
        T = ps.top !== "auto" ? pad.t + n(ps.top) : ps.bottom !== "auto" ? pad.b - n(ps.bottom) - bh : pad.t;
        const m = ps.transform.match(/^matrix\(([^)]+)\)$/);
        if (m) {
          const k = m[1].split(",").map(Number);
          L += k[4];
          T += k[5];
        }
        const fake = { left: L, top: T, right: L + bw, bottom: T + bh, width: bw, height: bh };
        if (!intersect(ltrb(fake), ctx.clip)) return;
        emitBox(PSEUDO_EL, ps, fake, { ...ctx, op: ctx.op * pop }, ctx.key(), false);
      } else {
        const cl = pad.l + n(cs.paddingLeft);
        const ct = pad.t + n(cs.paddingTop);
        const cw = pad.r - n(cs.paddingRight) - cl;
        const ch = pad.b - n(cs.paddingBottom) - ct;
        const align = (ps.alignSelf !== "auto" ? ps.alignSelf : cs.alignItems) || "";
        const vAlign = () => (/center/.test(align) ? ct + (ch - h) / 2 : /end/.test(align) ? ct + ch - h : ct);
        if (empty) {
          // the only content of an icon-ish element: centre it in the content box
          L = cl + Math.max(0, (cw - w) / 2);
          T = ct + Math.max(0, (ch - h) / 2);
        } else if (/flex/.test(cs.display) && /^row/.test(cs.flexDirection)) {
          // icon before the first / after the last item of a flex row (chevrons, arrows)
          const kidsR = [...el.children]
            .filter((k) => css(k).display !== "none" && css(k).position !== "absolute" && css(k).position !== "fixed")
            .map((k) => k.getBoundingClientRect())
            .filter((k) => k.width || k.height);
          if (!kidsR.length) return;
          const gap = n(cs.columnGap);
          if (which === "::after") L = kidsR[kidsR.length - 1].right + gap + n(ps.marginLeft);
          else L = kidsR[0].left - gap - n(ps.marginRight) - w;
          T = vAlign();
        } else return;
        const fake = { left: L, top: T, right: L + w, bottom: T + h, width: w, height: h };
        if (!intersect(ltrb(fake), ctx.clip)) return;
        emitBox(PSEUDO_EL, ps, fake, { ...ctx, op: ctx.op * pop }, ctx.key(), false);
      }
    }

    function mediaFor(el, cs, r) {
      const tag = el.localName;
      const fit = `object-fit:${cs.objectFit};object-position:${cs.objectPosition};`;
      if (tag === "img") {
        const src = imgSrc(el);
        if (!src) return null;
        const m = document.createElement("img");
        m.src = src;
        m.decoding = "async";
        m.setAttribute("style", fit + "display:block;");
        m.draggable = false;
        return { el: m, sig: src };
      }
      if (tag === "svg") {
        const m = cloneStyled(el);
        m.setAttribute("width", "100%");
        m.setAttribute("height", "100%");
        m.style.display = "block";
        m.style.overflow = "visible";
        m.style.margin = "0";
        m.style.position = "static";
        // the box we draw is the transformed bounding box; keep only a pure rotation/flip
        const mt = cs.transform.match(/^matrix\(([^)]+)\)$/);
        const k = mt ? mt[1].split(",").map(Number) : null;
        m.style.transform = k && Math.abs(Math.hypot(k[0], k[1]) - 1) < 0.02 && Math.abs(Math.hypot(k[2], k[3]) - 1) < 0.02 ? `matrix(${k[0]},${k[1]},${k[2]},${k[3]},0,0)` : "none";
        m.style.transformOrigin = "50% 50%";
        const h = m.outerHTML;
        return { el: m, sig: h.length + ":" + h.slice(0, 160) };
      }
      const imgOf = (src, extra) => {
        const m = document.createElement("img");
        m.src = src;
        m.setAttribute("style", (extra || "") + "display:block;width:100%;height:100%;");
        m.draggable = false;
        return { el: m, sig: src.slice(0, 120) + src.length };
      };
      if (tag === "canvas" || tag === "iframe" || tag === "embed" || tag === "object") {
        const crop = cropShot(shot, r);
        if (crop) return imgOf(crop);
      }
      if (tag === "video") {
        // Cross-origin video can't be read back as pixels once it's off-screen, so
        // rebuild it as a real (muted) video in the state the original was in.
        const crop = cropShot(shot, r);
        const url = videoUrl(el);
        if (url) {
          const v = document.createElement("video");
          v.setAttribute("src", url);
          v.setAttribute("muted", "");
          v.setAttribute("playsinline", "");
          v.setAttribute("preload", "auto");
          if (el.loop || el.autoplay || !el.paused) v.setAttribute("loop", "");
          if (!el.paused || el.autoplay) v.setAttribute("data-play", "");
          if (el.crossOrigin) v.setAttribute("crossorigin", el.crossOrigin);
          if (el.currentTime > 0) v.setAttribute("data-t", String(el.currentTime));
          const poster = crop || el.poster;
          if (poster) v.setAttribute("poster", poster);
          v.setAttribute("style", fit + "display:block;width:100%;height:100%;");
          return { el: v, sig: url };
        }
        if (crop) return imgOf(crop);
        let src = el.poster || "";
        if (!src && el.videoWidth) {
          try {
            const c = document.createElement("canvas");
            c.width = el.videoWidth;
            c.height = el.videoHeight;
            c.getContext("2d").drawImage(el, 0, 0);
            src = c.toDataURL("image/jpeg", 0.82);
          } catch (_) {}
        }
        if (src) {
          const m = document.createElement("img");
          m.src = src;
          m.setAttribute("style", fit + "display:block;");
          return { el: m, sig: src.slice(0, 200) };
        }
        const d = document.createElement("div");
        d.setAttribute("style", "background:#111;");
        return { el: d, sig: "video" };
      }
      if (tag === "canvas") {
        const src = canvasPixels(el);
        if (src) return imgOf(src);
        return null;
      }
      // iframe / embed / object
      const d = document.createElement("div");
      let host = "";
      try {
        host = new URL(el.src || el.data || "", location.href).hostname.replace(/^www\./, "");
      } catch (_) {}
      d.setAttribute(
        "style",
        "background:#F1F2F4;display:flex;align-items:center;justify-content:center;font:500 12px/1.2 system-ui,sans-serif;color:#8A8F98;letter-spacing:.01em;",
      );
      d.textContent = host || "embed";
      return { el: d, sig: "frame:" + host };
    }

    function emitMedia(el, cs, r, ctx, key) {
      let src = el;
      let scs = cs;
      if (el.localName === "picture") {
        src = el.querySelector("img");
        if (!src) return;
        scs = css(src);
      }
      const m = mediaFor(src, scs, r);
      if (!m) return;
      const b = conv(r, ctx.layer);
      add({
        kind: "image",
        ...b,
        blend: cs.mixBlendMode !== "normal" ? cs.mixBlendMode : ctx.blend || "",
        media: m.el,
        frame: styleString(cs, ["border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-top-style", "border-right-style", "border-bottom-style", "border-left-style", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color"]),
        radius: cs.borderRadius,
        shadow: cs.boxShadow !== "none" ? cs.boxShadow : "",
        bg: alphaOf(cs.backgroundColor) > 0.01 ? cs.backgroundColor : "",
        draw: null,
        styled: false,
        layer: ctx.layer,
        key,
        op: ctx.op,
        clip: clipFor(r, ctx.clip, ctx.layer),
        parentBox: ctx.boxItem,
        sig: m.sig,
      });
    }

    function emitForm(el, cs, r, ctx, key) {
      const tag = el.localName;
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "hidden") return;
      const b = conv(r, ctx.layer);
      if (tag === "input" && (type === "checkbox" || type === "radio")) {
        const accent = cs.accentColor && cs.accentColor !== "auto" ? cs.accentColor : "#0B6CFF";
        const s = document.createElementNS(SVGNS, "svg");
        s.setAttribute("viewBox", "0 0 16 16");
        s.setAttribute("width", "100%");
        s.setAttribute("height", "100%");
        const on = el.checked;
        s.innerHTML =
          type === "radio"
            ? `<circle cx="8" cy="8" r="7" fill="#fff" stroke="${on ? accent : "#767676"}" stroke-width="1.2"/>${on ? `<circle cx="8" cy="8" r="4" fill="${accent}"/>` : ""}`
            : `<rect x="1" y="1" width="14" height="14" rx="2.5" fill="${on ? accent : "#fff"}" stroke="${on ? accent : "#767676"}" stroke-width="1.2"/>${on ? '<path d="M4.2 8.3 L7 11 L12 5.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' : ""}`;
        add({
          kind: "image", ...b, media: s, frame: "", radius: "0px", shadow: "", bg: "",
          draw: null, styled: false, layer: ctx.layer, key, op: ctx.op, clip: null,
          parentBox: ctx.boxItem, sig: type + on,
        });
        return;
      }
      const boxIt = emitBox(el, cs, r, ctx, key, false);
      let text = "";
      let ph = false;
      if (tag === "select") text = (el.selectedOptions && el.selectedOptions[0] && el.selectedOptions[0].text) || "";
      else if (["submit", "button", "reset"].includes(type)) text = el.value || (type === "submit" ? "Submit" : type === "reset" ? "Reset" : "");
      else if (type === "password") text = "•".repeat((el.value || "").length);
      else if (["range", "color", "file", "image"].includes(type)) text = "";
      else text = el.value || "";
      if (!text && el.placeholder) {
        text = el.placeholder;
        ph = true;
      }
      if (!text.trim()) return;
      const root = document.createElement("div");
      const pad = (side) =>
        (parseFloat(cs.getPropertyValue(`padding-${side}`)) || 0) + (parseFloat(cs.getPropertyValue(`border-${side}-width`)) || 0);
      const isButton = ["submit", "button", "reset"].includes(type);
      let st = styleString(cs, TEXT_PROPS);
      st += `padding:${pad("top")}px ${pad("right")}px ${pad("bottom")}px ${pad("left")}px;margin:0;box-sizing:border-box;width:100%;height:100%;overflow:hidden;`;
      st += tag === "textarea" ? "display:block;white-space:pre-wrap;" : `display:flex;align-items:center;white-space:pre;${isButton ? "justify-content:center;" : ""}`;
      if (ph) st += `color:${getComputedStyle(el, "::placeholder").color};-webkit-text-fill-color:currentColor;`;
      root.setAttribute("style", st);
      root.textContent = text;
      textItem(
        { ...b, layer: ctx.layer, key: key + 0.5, op: ctx.op, clip: clipFor(r, ctx.clip, ctx.layer), parentBox: boxIt || ctx.boxItem },
        root,
        { ...b },
        cs,
        ctx.layer,
      );
    }

    function walk(el, ctx, parent) {
      if (items.length >= MAX_ITEMS) return;
      const tag = el.localName;
      if (SKIP.has(tag) || el === env.host) return;
      const cs = css(el);
      const disp = cs.display;
      if (disp === "none") return;
      if (disp === "contents") {
        // transparent wrapper (incl. <slot>): its loose text still renders, styled by it
        let run = [];
        const flushRun = () => {
          if (ctx.key && run.some((n) => /\S/.test(n.data))) emitRun(el, cs, run, ctx);
          run = [];
        };
        for (const c of kidsOf(el)) {
          if (c.nodeType === 3) run.push(c);
          else if (c.nodeType === 1) {
            flushRun();
            walk(c, ctx, parent);
          }
        }
        flushRun();
        return;
      }
      const op = ctx.op * parseFloat(cs.opacity);
      if (!(op > 0.03)) return;
      const r = el.getBoundingClientRect();
      // "visually hidden" accessibility text: 1px boxes, clip:rect(0 0 0 0), clip-path:inset(50%)
      // (html/body overflow belongs to the viewport, so a 0px-tall body clips nothing)
      const clipsSelf = el !== html && el !== body && el !== env.scroller && cs.overflowX !== "visible" && cs.overflowY !== "visible";
      if (clipsSelf && (r.width <= 2 || r.height <= 2)) return;
      if (cs.position === "absolute" && /rect\(0px,? 0px,? 0px,? 0px\)/.test(cs.clip)) return;
      if (/inset\(50%\)|circle\(0px/.test(cs.clipPath)) return;
      if (cs.float !== "none" && r.width > 1 && r.height > 1) {
        const n = (p) => parseFloat(cs.getPropertyValue(p)) || 0;
        floats.push({ el, side: cs.float, l: r.left - n("margin-left"), t: r.top - n("margin-top"), r: r.right + n("margin-right"), b: r.bottom + n("margin-bottom") });
      }
      let layer = ctx.layer;
      let clip = ctx.clip;
      let zTop = ctx.zTop;
      let posd = ctx.posd;
      const pos = cs.position;
      if (pos === "fixed" && layer !== "over") {
        layer = "over";
        clip = viewClip;
      } else if (pos === "sticky" && layer === "world") {
        // stuck (or sitting exactly where it would stick) at the top of its scroller
        const top = parseFloat(cs.top);
        if (!isNaN(top) && Math.abs(r.top - oy - top) < 2 && r.height < vh * 0.4) {
          layer = "over";
          clip = viewClip;
        }
      }
      // z-index counts for positioned boxes and for flex/grid items (even when static)
      const pe = el.parentElement;
      const flexItem = pos === "static" && pe && /flex|grid/.test(css(pe).display);
      if (pos !== "static" || flexItem) {
        if (cs.zIndex !== "auto") {
          if (zTop == null) zTop = parseInt(cs.zIndex, 10) || 0;
        } else if (pos !== "static") posd = true;
      }
      const keyFn = () => (zTop || 0) * 1e7 + (posd ? 5e6 : 0) + order++;
      if (layer === "over" && ctx.layer !== "over" && r.top <= 4 && r.width >= vw * 0.8 && r.height > 20 && r.height <= 200) {
        bars.push({ node: null, r, start: items.length, key: (zTop || 0) * 1e7 + (posd ? 5e6 : 0) + order - 0.5 });
      }
      const isScroller = !env.isRoot && el === env.scroller;
      const kidLayer = isScroller ? "world" : layer;
      const box = conv(r, layer);
      const visible = cs.visibility === "visible";
      const sized = r.width >= 1 && r.height >= 1;
      const emit = visible && sized && !!intersect(ltrb(r), clip) && inDoc(box, layer);

      const node = {
        el, tag, cls: (el.getAttribute && el.getAttribute("class")) || "", layer,
        start: items.length, end: items.length, kids: [], box,
      };
      (parent ? parent.kids : roots).push(node);

      if (REPLACED.has(tag) || FORMS.has(tag)) {
        if (emit) {
          if (FORMS.has(tag)) emitForm(el, cs, r, { ...ctx, layer, clip, op }, keyFn());
          else emitMedia(el, cs, r, { ...ctx, layer, clip, op }, keyFn());
        }
        node.end = items.length;
        return;
      }

      let boxItem = ctx.boxItem;
      if (emit) {
        const b = emitBox(el, cs, r, { ...ctx, layer, clip, op }, keyFn(), false);
        if (b) boxItem = b;
      }

      let kidClip = clip;
      if (isScroller) {
        kidClip = fullClip;
        portKey = keyFn();
      }
      else if (el !== html && el !== body && (cs.overflowX !== "visible" || cs.overflowY !== "visible")) {
        const bl = parseFloat(cs.borderLeftWidth) || 0;
        const bt = parseFloat(cs.borderTopWidth) || 0;
        const br = parseFloat(cs.borderRightWidth) || 0;
        const bb = parseFloat(cs.borderBottomWidth) || 0;
        kidClip = intersect(clip, { l: r.left + bl, t: r.top + bt, r: r.right - br, b: r.bottom - bb });
        if (!kidClip) {
          node.end = items.length;
          return;
        }
      }
      const blend = cs.mixBlendMode !== "normal" ? cs.mixBlendMode : ctx.blend;
      const kctx = { op, layer: kidLayer, clip: kidClip, zTop, posd, boxItem, key: keyFn, blend };

      // Decide: one text leaf, or a mix of text runs and nested blocks.
      // Closed <details> and content-visibility:hidden still report real boxes for
      // content that isn't painted, so only the summary (or nothing) gets built.
      if (cs.contentVisibility === "hidden") {
        node.end = items.length;
        return;
      }
      let kids = kidsOf(el);
      if (tag === "details" && !el.open) {
        const sum = kids.find((n) => n.nodeType === 1 && n.localName === "summary");
        kids = sum ? [sum] : [];
      }
      const emptyEl = !kids.some((k) => (k.nodeType === 3 && /\S/.test(k.data)) || k.nodeType === 1);
      const pctx = { ...kctx, layer, clip };
      const directText = kids.some((n) => n.nodeType === 3 && /\S/.test(n.data));
      const kinds = [];
      let allRun = !el.shadowRoot;
      let anyText = directText;
      for (const n of kids) {
        if (n.nodeType === 3) {
          kinds.push(1);
          continue;
        }
        if (n.nodeType !== 1 || SKIP.has(n.localName)) {
          kinds.push(0);
          continue;
        }
        const d = css(n).display;
        if (d === "none") {
          kinds.push(0);
          continue;
        }
        let inl = false;
        const nt = n.localName;
        if (n.shadowRoot || nt === "slot") inl = false;
        else if (nt === "br" || nt === "wbr") inl = true;
        else if (d === "inline") inl = allInline(n);
        else if (directText && d.startsWith("inline")) inl = true;
        if (inl && !anyText && /\S/.test(n.textContent)) anyText = true;
        kinds.push(inl ? 1 : 2);
        if (!inl) allRun = false;
      }

      if (allRun && anyText && !isScroller) {
        if (visible && sized && emit) emitLeaf(el, cs, r, { ...kctx, layer }, keyFn());
        node.end = items.length;
        return;
      }
      // (text leaves carry their pseudos inside the clone instead)
      if (emit && visible) emitPseudoBox(el, cs, r, pctx, "::before", emptyEl);
      const afterPseudo = () => {
        if (emit && visible) emitPseudoBox(el, cs, r, pctx, "::after", emptyEl);
      };

      let run = [];
      const flush = () => {
        if (!run.length) return;
        const hasText = run.some((n) => (n.nodeType === 3 ? /\S/.test(n.data) : /\S/.test(n.textContent)));
        if (hasText) {
          if (visible) emitRun(el, cs, run, kctx);
        } else {
          for (const n of run) if (n.nodeType === 1) walk(n, kctx, node);
        }
        run = [];
      };
      kids.forEach((n, i) => {
        if (kinds[i] === 1) run.push(n);
        else if (kinds[i] === 2) {
          flush();
          walk(n, kctx, node);
        }
      });
      flush();
      afterPseudo();
      node.end = items.length;
    }

    const rootLayer = env.isRoot ? "world" : "under";
    const rootClip = env.isRoot ? fullClip : viewClip;
    walk(html, { op: 1, layer: rootLayer, clip: rootClip, zTop: null, posd: false, boxItem: null }, null);

    // --------------------------------------------- repeated components (dup)
    const groups = [];
    const kindsSig = (n) => {
      let s = "";
      for (let i = n.start; i < n.end; i++) s += items[i].kind[0];
      return s;
    };
    const similar = (a, b, loose) =>
      a.w > 0 && b.w > 0 && a.h > 0 && b.h > 0 && a.h / b.h < 1.8 && b.h / a.h < 1.8 && (loose || (a.w / b.w < 1.6 && b.w / a.w < 1.6));
    function findGroups(node, inCopy) {
      if (inCopy) return;
      const buckets = new Map();
      for (const k of node.kids) {
        const n = k.end - k.start;
        if (n < 1 || n > 48) continue;
        // long single paragraphs read better typed than duplicated
        if (n === 1 && items[k.start].kind === "text" && items[k.start].text.length > 40) continue;
        const sig = `${k.tag}|${k.cls}|${k.layer}|${kindsSig(k)}`;
        if (!buckets.has(sig)) buckets.set(sig, []);
        buckets.get(sig).push(k);
      }
      const copies = new Set();
      for (const list of buckets.values()) {
        if (list.length < 2) continue;
        const m = list[0];
        const loose = m.end - m.start === 1 && items[m.start].kind === "text";
        const members = list.filter((k) => similar(k.box, m.box, loose));
        if (members.length < 2) continue;
        const g = { id: groups.length, master: members[0], copies: members.slice(1) };
        groups.push(g);
        for (const c of g.copies) copies.add(c);
      }
      for (const k of node.kids) findGroups(k, copies.has(k));
    }
    for (const r of roots) findGroups(r, false);

    for (const g of groups) {
      for (const c of g.copies) {
        for (let i = c.start; i < c.end; i++) {
          const it = items[i];
          if (it.copyOf) continue;
          it.copyOf = items[g.master.start + (i - c.start)];
          it.group = g;
        }
      }
    }

    const twinKey = new Map();
    for (const it of items) {
      if (it.kind !== "text" || it.copyOf || !it.text) continue;
      const k = `${it.layer}|${Math.round(it.tb.x / 4)}|${Math.round(it.tb.y / 4)}|${it.text}`;
      const m = twinKey.get(k);
      if (m) it.twinOf = m;
      else twinKey.set(k, it);
    }

    // ------------------------------------------------------------- tasks
    const tasks = [];
    const mk = (y, spec, deps, layer) => {
      const t = { id: tasks.length, y, spec, deps, state: "wait", doneAt: 0, layer };
      tasks.push(t);
      return t;
    };
    const KIND_TASK = { rect: "rect", image: "image", text: "text", line: "line" };
    for (const it of items) {
      if (it.copyOf) continue;
      if (it.twinOf) {
        it.final = it.twinOf.final;
        continue;
      }
      const deps = it.parentBox && it.parentBox.final ? it.parentBox.final : [];
      const y = it.kind === "text" ? it.tb.y : it.y;
      it.task = mk(y, { type: KIND_TASK[it.kind], it }, deps, it.layer);
      it.final = [it.task];
    }
    // inner groups first so outer copies can wait for them
    for (let gi = groups.length - 1; gi >= 0; gi--) {
      const g = groups[gi];
      const mItems = items.slice(g.master.start, g.master.end);
      const masterFinals = [];
      for (const it of mItems) if (it.final) masterFinals.push(...it.final);
      if (g.master.start < g.master.end && items[g.master.start].parentBox && items[g.master.start].parentBox.final)
        masterFinals.push(...items[g.master.start].parentBox.final);
      g.src = { items: mItems, box: g.master.box };
      g.dst = g.copies.map((c, k) => {
        const its = items.slice(c.start, c.end).filter((it) => it.group === g);
        const minY = Math.min(...its.map((it) => (it.kind === "text" ? it.tb.y : it.y)));
        const task = mk(minY, { type: "dup", g, k }, masterFinals, c.layer);
        for (const it of its) {
          it.dupTask = task;
          it.final = [task];
          const m = it.copyOf;
          let type = null;
          if (it.kind === "text" && it.sig !== m.sig) type = "edit";
          else if (it.kind === "image" && it.sig !== m.sig) type = "swap";
          else if (it.kind === "rect" && it.sig !== m.sig) type = "restyle";
          if (type) {
            it.editTask = mk(it.kind === "text" ? it.tb.y : it.y, { type, it }, [task], it.layer);
            it.final = [task, it.editTask];
          }
        }
        return { items: its, box: c.box, task };
      });
    }

    // -------------------------------------------------- guides & snapping
    const guides = [];
    const texts = items.filter((it) => it.kind === "text" && it.task && it.layer === "world" && it.fs >= 13 && it.tb.w > 30);
    const BAND = 900;
    const bands = new Map();
    for (const it of texts) {
      const k = Math.floor(it.tb.y / BAND);
      if (!bands.has(k)) bands.set(k, []);
      bands.get(k).push(it);
    }
    for (const [, list] of [...bands.entries()].sort((a, b) => a[0] - b[0])) {
      if (guides.length >= 16) break;
      const byX = new Map();
      for (const it of list) {
        const x = Math.round(it.tb.x);
        if (!byX.has(x)) byX.set(x, []);
        byX.get(x).push(it);
      }
      let best = null;
      for (const [x, l] of byX) if (l.length >= 3 && (!best || l.length > best[1].length)) best = [x, l];
      if (best) {
        const top = Math.min(...best[1].map((m) => m.tb.y));
        const members = best[1].filter((m) => m.tb.y < top + 450).sort((a, b) => b.fs - a.fs).slice(0, 2);
        const g = { axis: "x", pos: best[0], cur: best[0], op: 1, flash: 0, dragging: false, vis: false };
        guides.push(g);
        const gy = Math.min(...members.map((m) => m.tb.y)) - 30;
        g.task = mk(gy, { type: "guide", g }, [], "world");
        g.deps = [];
        for (const m of members) {
          m.task.spec.snap = g;
          m.task.spec.snapDx = m.tb.x - best[0];
          g.deps.push(m.task);
        }
      }
      const byY = new Map();
      for (const it of list) {
        const y = Math.round(it.tb.y);
        if (!byY.has(y)) byY.set(y, []);
        byY.get(y).push(it);
      }
      let row = null;
      for (const [y, l] of byY) if (l.length >= 3 && (!row || l.length > row[1].length)) row = [y, l];
      if (row) {
        const m = row[1].find((it) => !it.task.spec.snap);
        if (m) {
          const g = { axis: "y", pos: row[0], cur: row[0], op: 1, flash: 0, dragging: false, vis: false };
          guides.push(g);
          g.task = mk(row[0] - 30, { type: "guide", g }, [], "world");
          g.deps = [m.task];
          m.task.spec.snap = g;
        }
      }
    }
    for (const it of items) if (it.kind === "text" && it.task && it.fs >= 28 && it.tb.h < 400) it.task.spec.grow = true;
    // deps always have lower ids, so one reverse pass propagates the earliest need
    for (const t of tasks) t.gate = t.y;
    for (let i = tasks.length - 1; i >= 0; i--) for (const d of tasks[i].deps) if (tasks[i].gate < d.gate) d.gate = tasks[i].gate;

    // A sticky header that is transparent at the top of the page still needs
    // something behind it once content scrolls underneath (sites add it on scroll).
    const backdrops = [];
    if (pageBg.image === "none")
      for (const b of bars) {
        const area = b.r.width * b.r.height;
        const covered = items.some(
          (it) => it.id >= b.start && it.layer === "over" && it.kind === "rect" && it.w * it.h >= area * 0.85 && /rgba?\(/.test(it.css) && !/background-color:\s*rgba\([^)]*,\s*0(\.\d+)?\)/.test(it.css),
        );
        if (!covered) backdrops.push({ x: b.r.left, y: b.r.top, w: b.r.width, h: b.r.height, key: b.key, color: pageBg.color });
      }

    return { items, tasks, groups, guides, docW, docH, backdrops, portKey };
  }

  // -------------------------------------------------------------- text reveal

  function wsOf(n, root) {
    for (let e = n; e && e !== root.parentNode; e = e.parentNode) {
      const w = e.style && e.style.whiteSpace;
      if (w) return w;
    }
    return "normal";
  }

  function prepText(it) {
    const live = it.full.cloneNode(true);
    const units = [];
    let seq = "";
    const boxes = [];
    (function rec(n, box) {
      for (const c of [...n.childNodes]) {
        if (c.nodeType === 3) {
          let s = c.data;
          const ws = wsOf(n, live);
          if (!/^pre|break-spaces/.test(ws)) s = s.replace(/[\t\n\r ]+/g, " ");
          if (!s.length) {
            c.remove();
            continue;
          }
          units.push({ t: c, s, len: s.length, box });
          seq += s;
        } else if (c.nodeType === 1) {
          // media, and empty styled boxes (mask icons, dots, swatches) appear in one keystroke
          if (ATOMIC.has(c.localName) || c instanceof SVGElement || (!/\S/.test(c.textContent) && c.style && boxyStyle(c.style))) {
            units.push({ e: c, len: 1, box, on: true });
            seq += "□";
          } else {
            const b = c.style && boxyStyle(c.style) ? c : box;
            if (b === c) boxes.push(c);
            rec(c, b);
          }
        }
      }
    })(live, null);
    for (const u of units) {
      if (u.t) u.t.data = "";
      else {
        u.e.style.visibility = "hidden";
        u.on = false;
      }
    }
    for (const b of boxes) {
      b.style.visibility = "hidden";
      b.__on = false;
    }
    it.live = live;
    it.units = units;
    it.seq = seq;
    it.total = seq.length;
    it.shown = 0;
    it.rshown = 0;
  }

  function reveal(it, n) {
    let left = n;
    let last = null;
    for (const u of it.units) {
      const k = left <= 0 ? 0 : left >= u.len ? u.len : left;
      left -= k;
      if (u.t) {
        const want = k === u.len ? u.s : u.s.slice(0, k);
        if (u.t.data !== want) u.t.data = want;
        if (k) last = u.t;
      } else {
        const on = k > 0;
        if (u.on !== on) {
          u.e.style.visibility = on ? "" : "hidden";
          u.on = on;
        }
        if (on) last = u.e;
      }
      if (k && u.box && u.box.__on === false) {
        for (let b = u.box; b && b !== it.live; b = b.parentNode)
          if (b.__on === false) {
            b.style.visibility = "";
            b.__on = true;
          }
      }
    }
    return last;
  }

  // ------------------------------------------------------------------ styles

  const STYLE = `
:host{all:initial}
*{box-sizing:border-box}
.bg{position:absolute;inset:0;opacity:0;transition:opacity .5s ease}
.bg.on{opacity:1}
.layer,.port{position:absolute;overflow:hidden;pointer-events:none}
.layer{inset:0}
.world{position:absolute;left:0;top:0;will-change:transform}
.it{position:absolute;left:0;top:0;transform-origin:0 0}
.it.settle{transition:transform .3s cubic-bezier(.2,.8,.2,1)}
.r{background-color:var(--ph,#D9D9D9);transition:background-color .22s ease,border-radius .22s ease}
.r.st{background-color:transparent}
.r>.f{position:absolute;inset:0;opacity:0;transition:opacity .22s ease,background-color .35s ease,border-radius .35s ease,box-shadow .35s ease,border-color .35s ease}
.r.st>.f{opacity:1}
.m{background-color:var(--ph,#D9D9D9);overflow:hidden}
.m>.ph{position:absolute;left:50%;top:50%;width:22px;height:22px;transform:translate(-50%,-50%);opacity:.7;transition:opacity .2s}
.m>.md{position:absolute;inset:0;width:100%;height:100%;opacity:0;clip-path:inset(0 0 100% 0);transition:opacity .35s ease,clip-path .6s cubic-bezier(.2,.75,.2,1)}
.m.st{background-color:transparent;transition:background-color .3s ease .3s}
.m.st>.ph{opacity:0}
.m.st>.md{opacity:1;clip-path:inset(0 0 0 0)}
.m>.md.swap{animation:swap .45s ease}
@keyframes swap{from{opacity:0;filter:blur(6px)}}
.m>.fr{position:absolute;inset:0;pointer-events:none}
.l svg{position:absolute;left:0;top:0;overflow:visible}
.bd{position:absolute;opacity:0;-webkit-backdrop-filter:saturate(180%) blur(14px);backdrop-filter:saturate(180%) blur(14px);box-shadow:0 1px 0 rgba(0,0,0,.06);pointer-events:none}
.caret{display:inline-block;width:1.5px;height:1.1em;margin-left:1px;margin-right:-2.5px;vertical-align:text-bottom;background:currentColor;animation:blink 1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.sa{background-color:rgba(13,153,255,.28)!important}
.ov{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.badges,.cursors{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.badge{position:absolute;transform:translate(-50%);padding:1px 4px;border-radius:2px;color:#fff;font:600 11px/16px Inter,system-ui,-apple-system,"Segoe UI",sans-serif;white-space:nowrap;font-variant-numeric:tabular-nums}
.cursor{position:absolute;left:0;top:0;will-change:transform}
.cursor svg{position:absolute;overflow:visible;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.28))}
.rulers{position:absolute;inset:0;pointer-events:none}
.ruler{position:absolute;background:#2c2c2c;pointer-events:none}
.ruler svg{display:block}
.ruler-top{top:0;left:0;right:0;height:20px;border-bottom:1px solid #3a3a3a}
.ruler-left{top:0;left:0;bottom:0;width:20px;border-right:1px solid #3a3a3a}
.ruler-corner{position:absolute;top:0;left:0;width:20px;height:20px;background:#2c2c2c}
.rtext{font:500 9px Inter,system-ui,-apple-system,sans-serif;fill:#8c8c8c}
.rsel{fill:#0d99ff}
.intro{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.92);opacity:0;transition:opacity .35s ease,transform .45s cubic-bezier(.2,.8,.2,1);pointer-events:none}
.intro.on{opacity:1;transform:translate(-50%,-50%)}
.intro.gone{opacity:0;transform:translate(-50%,-50%) scale(.9)}
.intro img{display:block;width:60px;height:60px;object-fit:contain;filter:grayscale(1);opacity:.42;border-radius:14px}
.intro .mono{width:60px;height:60px;border-radius:16px;background:#D7DADE;color:#fff;font:700 30px/60px Inter,system-ui,sans-serif;text-align:center}
.hud{position:absolute;left:50%;bottom:20px;transform:translate(-50%,18px);opacity:0;display:flex;align-items:center;gap:10px;padding:6px 6px 6px 10px;background:rgba(30,30,30,.94);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.07);font:500 12px/1 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:auto;transition:opacity .45s ease,transform .45s cubic-bezier(.2,.8,.2,1);white-space:nowrap;user-select:none;z-index:5}
.hud.on{opacity:1;transform:translate(-50%,0)}
.hud .dots{display:flex;padding-left:5px}
.hud .dots i{display:block;width:18px;height:18px;margin-left:-5px;border-radius:50%;border:2px solid #1e1e1e;font:700 9px/14px Inter,system-ui,sans-serif;font-style:normal;text-align:center;color:#fff;transition:background .3s}
.hud .txt,.hud .status{display:flex;align-items:center;gap:7px;color:#cfcfcf;font-variant-numeric:tabular-nums}
.hud .txt b{color:#fff;font-weight:600}
.hud .sep{width:1px;height:12px;background:#444}
.hud .bar{width:64px;height:3px;border-radius:2px;background:#3a3a3a;overflow:hidden}
.hud .bar i{display:block;height:100%;width:0;background:#0D99FF;transition:width .35s ease}
.hud button{all:unset;cursor:pointer;padding:7px 10px;border-radius:8px;background:#2c2c2c;color:#fff;font:500 12px/1 Inter,system-ui,-apple-system,sans-serif;transition:background .15s}
.hud button:hover{background:#3a3a3a}
.hud button.pri{background:#0D99FF}
.hud button.pri:hover{background:#2aa6ff}
.hud button.on{background:rgba(13,153,255,.22);color:#8fd0ff}
.hud button[hidden]{display:none}
.hud .x{padding:7px 9px;color:#aaa}
.hud button.snd{display:flex;align-items:center;gap:6px;padding:6px 8px}
.hud button.snd.off{color:#8a8a8a}
.hud button.snd.tap{background:#0D99FF;animation:hudpulse 1.6s ease-in-out infinite}
@keyframes hudpulse{50%{box-shadow:0 0 0 4px rgba(13,153,255,.28)}}
`;

  // -------------------------------------------------------------------- env

  function detectEnv() {
    const se = document.scrollingElement || document.documentElement;
    let scroller = se;
    let isRoot = true;
    if (se.scrollHeight <= innerHeight + 4) {
      let best = null;
      let bestArea = 0;
      const all = document.body ? document.body.getElementsByTagName("*") : [];
      for (let i = 0; i < all.length && i < 20000; i++) {
        const el = all[i];
        if (el.scrollHeight <= el.clientHeight + 40 || el.clientHeight < innerHeight * 0.4) continue;
        const oy = getComputedStyle(el).overflowY;
        if (!/(auto|scroll|overlay)/.test(oy)) continue;
        const r = el.getBoundingClientRect();
        const area = r.width * r.height;
        if (area > bestArea && r.width > innerWidth * 0.35) {
          best = el;
          bestArea = area;
        }
      }
      if (best) {
        scroller = best;
        isRoot = false;
      }
    }
    const env = {
      scroller,
      isRoot,
      host: null,
      pageBg: pageBackground(),
      geom() {
        if (isRoot) {
          return {
            ox: 0,
            oy: 0,
            sx: window.scrollX,
            sy: window.scrollY,
            vw: document.documentElement.clientWidth,
            vh: window.innerHeight,
          };
        }
        const r = scroller.getBoundingClientRect();
        return {
          ox: r.left + scroller.clientLeft,
          oy: r.top + scroller.clientTop,
          sx: scroller.scrollLeft,
          sy: scroller.scrollTop,
          vw: scroller.clientWidth,
          vh: scroller.clientHeight,
        };
      },
      scrollHeight: () => (isRoot ? Math.max(se.scrollHeight, document.body ? document.body.scrollHeight : 0) : scroller.scrollHeight),
      scrollWidth: () => (isRoot ? se.scrollWidth : scroller.scrollWidth),
      scrollTo(y, x) {
        const opts = { top: y, behavior: "instant" };
        if (x != null) opts.left = x;
        if (isRoot) window.scrollTo(opts);
        else scroller.scrollTo(opts);
      },
      scrollBy(dy) {
        if (isRoot) window.scrollBy({ top: dy, behavior: "instant" });
        else scroller.scrollBy({ top: dy, behavior: "instant" });
      },
    };
    return env;
  }

  // ------------------------------------------------------------------- view

  class View {
    constructor(env) {
      this.env = env;
      this.frozen = null;
      for (const old of document.querySelectorAll("swarm-rebuild")) old.remove();
      const host = document.createElement("swarm-rebuild");
      host.style.cssText =
        "all:initial !important;position:fixed !important;inset:0 !important;z-index:2147483647 !important;display:block !important;pointer-events:auto !important;contain:strict !important;opacity:1;transition:opacity .6s ease;";
      env.host = host;
      this.host = host;
      const root = host.attachShadow({ mode: "open" });
      this.root = root;
      root.innerHTML = `<style>${STYLE}</style>
<div class="bg"></div>
<div class="layer under"></div>
<div class="port"><div class="world"></div></div>
<div class="layer over"></div>
<div class="intro"></div>
<svg class="ov"></svg>
<div class="badges"></div>
<div class="cursors"></div>
<div class="rulers"></div>
<div class="hud">
  <div class="dots"></div>
  <div class="txt"><span class="status">Scanning page…</span></div>
  <div class="bar"><i></i></div>
  <button data-a="tour" title="Auto-scroll while the swarm builds">Tour</button>
  <button data-a="speed" title="Build speed">1×</button>
  <button data-a="sound" class="snd" title="Sound (M)"></button>
  <button data-a="live" class="pri" hidden title="Fade back to the real page">Go live</button>
  <button data-a="replay" hidden title="Wipe and rebuild again">Replay</button>
  <button data-a="close" class="x" title="Exit (Esc)">✕</button>
</div>`;
      const $ = (s) => root.querySelector(s);
      this.bg = $(".bg");
      this.under = $(".under");
      this.over = $(".over");
      this.port = $(".port");
      this.world = $(".world");
      this.intro = $(".intro");
      this.ov = $(".ov");
      this.badges = $(".badges");
      this.cursorsEl = $(".cursors");
      this.rulers = $(".rulers");
      this.hud = $(".hud");
      this.status = $(".status");
      this.barFill = $(".bar i");
      this.dots = $(".dots");
      this.cursorEls = new Map();
      this._ovS = "";
      this._ovB = "";
      this._rulersOn = false;

      const pb = env.pageBg;
      this.bg.style.backgroundColor = pb.color;
      const rgb = (pb.color.match(/[\d.]+/g) || [255, 255, 255]).map(Number);
      const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
      if (lum < 0.4) this.host.style.setProperty("--ph", "#3B3D42");
      if (pb.image && pb.image !== "none") {
        this.bg.style.backgroundImage = pb.image;
        this.bg.style.backgroundSize = pb.size;
        this.bg.style.backgroundPosition = pb.position;
        this.bg.style.backgroundRepeat = pb.repeat;
      }
      this.makeIntroLogo();
      document.documentElement.appendChild(host);
      this.measure();
    }

    makeIntroLogo() {
      const links = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]')];
      const sized = links
        .map((l) => ({ href: l.href, s: parseInt((l.getAttribute("sizes") || "0").split("x")[0], 10) || (l.rel.includes("apple") ? 180 : 32) }))
        .filter((l) => l.href)
        .sort((a, b) => b.s - a.s);
      const label = (document.title || location.hostname || "?").replace(/^www\./, "").trim();
      const mono = () => {
        this.intro.innerHTML = "";
        const d = document.createElement("div");
        d.className = "mono";
        d.textContent = (label[0] || "?").toUpperCase();
        this.intro.appendChild(d);
      };
      const href = sized.length ? sized[0].href : location.origin + "/favicon.ico";
      const img = document.createElement("img");
      img.onerror = mono;
      img.src = href;
      this.intro.appendChild(img);
    }

    measure() {
      this.W = innerWidth;
      this.H = innerHeight;
      this.g = this.env.geom();
      const g = this.g;
      this.port.style.left = g.ox + "px";
      this.port.style.top = g.oy + "px";
      this.port.style.width = g.vw + "px";
      this.port.style.height = g.vh + "px";
    }

    get vp() {
      if (this.frozen) return this.frozen;
      const g = this.env.geom();
      return { ...g, ox: this.g.ox, oy: this.g.oy };
    }

    syncWorld() {
      const vp = this.vp;
      this.world.style.transform = `translate(${-vp.sx}px,${-vp.sy}px)`;
    }

    mount(model) {
      this.world.style.width = model.docW + "px";
      this.world.style.height = model.docH + "px";
      const by = { world: [], under: [], over: [] };
      for (const it of model.items) by[it.layer].push(it);
      if (model.portKey != null) {
        // inner scroller: its scrolling content sits at the scroller's own place in
        // the stacking order (above its dialog/panel background, below later UI)
        const screen = [...by.under, ...by.over].sort((a, b) => a.key - b.key);
        const frag = document.createDocumentFragment();
        let placed = false;
        for (const it of screen) {
          if (!placed && it.key > model.portKey) {
            frag.appendChild(this.port);
            placed = true;
          }
          frag.appendChild(this.makeNode(it));
        }
        if (!placed) frag.appendChild(this.port);
        this.over.appendChild(frag);
        const wl = by.world.sort((a, b) => a.key - b.key);
        const wf = document.createDocumentFragment();
        for (const it of wl) wf.appendChild(this.makeNode(it));
        this.world.appendChild(wf);
      } else
        for (const layer of ["under", "world", "over"]) {
          const list = by[layer].sort((a, b) => a.key - b.key);
          const frag = document.createDocumentFragment();
          for (const it of list) frag.appendChild(this.makeNode(it));
          (layer === "world" ? this.world : this[layer]).appendChild(frag);
        }
      this.backdrops = (model.backdrops || []).map((b) => {
        const d = document.createElement("div");
        d.className = "bd";
        const rgb = (b.color.match(/[\d.]+/g) || [255, 255, 255]).slice(0, 3).join(",");
        d.setAttribute("style", `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;background:rgba(${rgb},.82);`);
        this.over.insertBefore(d, this.over.firstChild);
        return d;
      });
      this.bdStart = this.env.geom().sy;
    }

    makeNode(it) {
      const n = document.createElement("div");
      n.style.display = "none";
      it.node = n;
      if (it.kind === "rect") {
        n.className = "it r";
        const f = document.createElement("div");
        f.className = "f";
        n.appendChild(f);
      } else if (it.kind === "image") {
        n.className = "it m";
        n.innerHTML = IMG_ICON;
      } else if (it.kind === "text") {
        n.className = "it t";
        prepText(it);
      } else if (it.kind === "line") {
        n.className = "it l";
        n.innerHTML = '<svg width="1" height="1"><path fill="none"/></svg>';
      }
      if (it.op < 0.999) n.style.opacity = it.op;
      if (it.blend) n.style.mixBlendMode = it.blend;
      return n;
    }

    renderItem(it) {
      const tw = it.twinOf;
      if (tw && it._tv !== tw.v) {
        it._tv = tw.v;
        it.vis = tw.vis;
        it.shown = tw.total ? Math.round((tw.shown / tw.total) * it.total) : it.total;
        it.dx = tw.dx;
        it.dy = tw.dy;
        it.scale = tw.scale;
        it.done = tw.done;
        it.v++;
      }
      if (it.rv === it.v) return;
      it.rv = it.v;
      const n = it.node;
      if (!it.vis) {
        if (n.style.display !== "none") n.style.display = "none";
        return;
      }
      if (n.style.display === "none") n.style.display = "";
      if (it.settle) {
        it.settle = false;
        n.classList.add("settle");
        clearTimeout(n._st);
        n._st = setTimeout(() => n.classList.remove("settle"), 340);
      }
      if (it.kind === "line") {
        n.style.transform = `translate(${it.dx}px,${it.dy}px)`;
        const pts = it.pts.slice(0, it.placed);
        const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") + (it.shut ? " Z" : "");
        const path = n.firstChild.firstChild;
        path.setAttribute("d", d);
        path.setAttribute("stroke", it.stroke);
        path.setAttribute("stroke-width", it.sw);
        path.setAttribute("stroke-linecap", "square");
        if (it.dash) path.setAttribute("stroke-dasharray", it.dash);
        return;
      }
      const w = it.draw ? it.draw.w : it.w;
      const h = it.draw ? it.draw.h : it.h;
      let tf = `translate(${it.x + it.dx}px,${it.y + it.dy}px)`;
      if (it.scale !== 1) tf += ` scale(${it.scale})`;
      n.style.transform = tf;
      n.style.width = w + "px";
      n.style.height = h + "px";
      const c = it.clip;
      n.style.clipPath =
        it.done && c ? `inset(${Math.max(0, c.t - it.y)}px ${Math.max(0, it.x + it.w - c.r)}px ${Math.max(0, it.y + it.h - c.b)}px ${Math.max(0, c.l - it.x)}px)` : "";

      if (it.kind === "rect") {
        const css = it.mode === "master" ? it.copyOf.css : it.css;
        if (n._css !== css) {
          n.firstChild.setAttribute("style", css);
          n._css = css;
        }
        n.classList.toggle("st", !!it.styled);
        n.style.borderRadius = it.styled ? (it.mode === "master" ? it.copyOf.radius : it.radius) : "0px";
      } else if (it.kind === "image") {
        const src = it.mode === "master" ? it.copyOf : it;
        if (n._src !== src) {
          const old = n.querySelector(".md");
          const m = src.media.cloneNode(true);
          m.classList.add("md");
          if (old) {
            m.classList.add("swap");
            old.replaceWith(m);
          } else n.appendChild(m);
          if (m.localName === "video") {
            m.muted = true;
            const t = parseFloat(m.getAttribute("data-t"));
            if (t > 0) m.addEventListener("loadedmetadata", () => (m.currentTime = t), { once: true });
            if (m.hasAttribute("data-play")) m.play().catch(() => {});
          }
          n._src = src;
          if (src.frame) {
            let fr = n.querySelector(".fr");
            if (!fr) {
              fr = document.createElement("div");
              fr.className = "fr";
              n.appendChild(fr);
            }
            fr.setAttribute("style", src.frame + `border-radius:${src.radius};`);
          }
        }
        n.classList.toggle("st", !!it.styled);
        n.style.borderRadius = it.styled ? src.radius : "0px";
        n.style.boxShadow = it.styled ? src.shadow : "";
        n.style.backgroundColor = it.styled && src.bg ? src.bg : "";
      } else if (it.kind === "text") {
        let content;
        if (it.mode === "master") {
          if (!it._mv) it._mv = it.copyOf.full.cloneNode(true);
          content = it._mv;
        } else content = it.live;
        if (n.firstChild !== content) {
          n.textContent = "";
          n.appendChild(content);
        }
        if (it.mode !== "master" && it.rshown !== it.shown) {
          it._last = reveal(it, it.shown);
          it.rshown = it.shown;
        }
        content.classList.toggle("sa", !!it.selAll);
        const wantCaret = it.editing && !it.selAll && it.mode !== "master";
        if (wantCaret) {
          if (!it._caret) {
            it._caret = document.createElement("span");
            it._caret.className = "caret";
          }
          const last = it._last;
          if (last && last.parentNode) last.parentNode.insertBefore(it._caret, last.nextSibling);
          else content.insertBefore(it._caret, content.firstChild);
        } else if (it._caret && it._caret.parentNode) it._caret.remove();
        if (it.scale !== 1) {
          const ox = it.tb.x - it.x + (it.align === "center" ? it.tb.w / 2 : it.align === "right" || it.align === "end" ? it.tb.w : 0);
          n.style.transformOrigin = `${ox}px ${it.tb.y - it.y}px`;
        }
      }
    }

    renderCursors(E) {
      const vp = E.vp;
      const seen = new Set();
      for (const c of E.cursors) {
        let el = this.cursorEls.get(c.id);
        if (!el) {
          el = document.createElement("div");
          el.className = "cursor";
          el.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"></svg>';
          this.cursorsEl.appendChild(el);
          this.cursorEls.set(c.id, el);
          el._shape = "";
        }
        seen.add(c.id);
        const X = c.sticky ? c.x : c.x - vp.sx + vp.ox;
        const Y = c.sticky ? c.y : c.y - vp.sy + vp.oy;
        el.style.transform = `translate(${f1(X)}px,${f1(Y)}px)`;
        const svg = el.firstChild;
        if (el._shape !== c.shape) {
          svg.innerHTML = cursorSVG(c.shape, c.color);
          el._shape = c.shape;
          const [hx, hy] = HOT[c.shape];
          el._hx = hx;
          el._hy = hy;
          svg.style.transformOrigin = `${hx}px ${hy}px`;
        }
        const s = 1 - c.press * 0.12;
        svg.style.transform = `translate(${-el._hx}px,${-el._hy}px) rotate(${f1(c.angle)}deg) scale(${s})`;
      }
      for (const [id, el] of this.cursorEls)
        if (!seen.has(id)) {
          el.remove();
          this.cursorEls.delete(id);
        }
    }

    renderOverlay(E) {
      const vp = E.vp;
      const W = this.W;
      const H = this.H;
      const X = (x, st) => f1(st ? x : x - vp.sx + vp.ox);
      const Y = (y, st) => f1(st ? y : y - vp.sy + vp.oy);
      let s = "";
      let b = "";
      for (const g of E.guides) {
        if (!g.vis || g.op <= 0) continue;
        const sw = 1 + g.flash;
        const flt = g.flash > 0 ? ` style="filter:drop-shadow(0 0 ${f1(2 + g.flash * 3)}px ${RED})"` : "";
        if (g.axis === "x") {
          const x = X(g.cur);
          s += `<line x1="${x}" x2="${x}" y1="0" y2="${H}" stroke="${RED}" stroke-width="${sw}" opacity="${f1(g.op)}"${flt}/>`;
        } else {
          const y = Y(g.cur);
          s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="${RED}" stroke-width="${sw}" opacity="${f1(g.op)}"${flt}/>`;
        }
      }
      for (const it of E.editLines) {
        const st = it.layer !== "world";
        const pts = it.pts.slice(0, it.placed).map((p) => [X(p.x + it.dx, st), Y(p.y + it.dy, st)]);
        const o = it.owner;
        const all = o ? [...pts, [X(o.x, o.sticky), Y(o.y, o.sticky)]] : pts;
        s += `<polyline points="${all.map((p) => p.join(",")).join(" ")}${it.shut && pts[0] ? " " + pts[0].join(",") : ""}" fill="none" stroke="${BLUE}" stroke-width="1.5"/>`;
        for (const p of pts) s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.6" fill="#fff" stroke="${BLUE}" stroke-width="1.5"/>`;
      }
      const rt = E.rulers.t;
      for (const c of E.cursors) {
        if (!c.ov) continue;
        const st = c.sticky;
        for (const v of c.ov()) {
          if (v.t === "box") {
            const x = X(v.b.x, st);
            const y = Y(v.b.y, st);
            const w = f1(v.b.w);
            const h = f1(v.b.h);
            const col = v.color === "red" ? RED : BLUE;
            s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${col}" stroke-width="1"/>`;
            if (v.underline && v.underline.w > 0) {
              const u = v.underline;
              s += `<line x1="${X(u.x, st)}" x2="${X(u.x + u.w, st)}" y1="${Y(u.y, st)}" y2="${Y(u.y, st)}" stroke="${BLUE}" stroke-width="1.5"/>`;
            }
            if (v.rulerLines && rt > 0.05)
              s += `<g stroke="${BLUE}" stroke-width="1" stroke-dasharray="2 2" opacity="${f1(rt)}"><line x1="${RULER}" x2="${x}" y1="${f1(y + h / 2)}" y2="${f1(y + h / 2)}"/><line x1="${f1(x + w / 2)}" x2="${f1(x + w / 2)}" y1="${RULER}" y2="${y}"/></g>`;
            if (v.handles)
              for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]])
                s += `<rect x="${f1(hx - 3.5)}" y="${f1(hy - 3.5)}" width="7" height="7" fill="#fff" stroke="${col}" stroke-width="1"/>`;
            if (v.badge && w > 0) b += `<div class="badge" style="left:${f1(x + w / 2)}px;top:${f1(y + h + 8)}px;background:${col}">${v.badge}</div>`;
          } else if (v.t === "measure") {
            const a = { x: X(v.a.x, st), y: Y(v.a.y, st) };
            const z = { x: X(v.b.x, st), y: Y(v.b.y, st) };
            s += `<line x1="${a.x}" y1="${a.y}" x2="${z.x}" y2="${z.y}" stroke="${RED}" stroke-width="1"/>`;
            const horiz = a.y === z.y;
            b += `<div class="badge" style="left:${f1(horiz ? (a.x + z.x) / 2 : a.x + 18)}px;top:${f1(horiz ? a.y + 8 : (a.y + z.y) / 2 - 9)}px;background:${RED}">${v.label}</div>`;
          }
        }
      }
      if (s !== this._ovS) {
        this.ov.innerHTML = s;
        this._ovS = s;
      }
      if (b !== this._ovB) {
        this.badges.innerHTML = b;
        this._ovB = b;
      }
    }

    renderRulers(E) {
      const t = E.rulers.t;
      if (t <= 0.001) {
        if (this._rulersOn) {
          this.rulers.innerHTML = "";
          this._rulersOn = false;
        }
        return;
      }
      this._rulersOn = true;
      const vp = E.vp;
      const W = this.W;
      const H = this.H;
      const step = 100;
      let u = "";
      let a = "";
      const x0 = Math.floor((vp.sx - vp.ox) / step) * step;
      for (let c = x0; c - vp.sx + vp.ox < W; c += step / 2) {
        const x = f1(c - vp.sx + vp.ox);
        const major = c % step === 0;
        u += `<line x1="${x}" x2="${x}" y1="${major ? 13 : 16}" y2="${RULER}" stroke="#5E5E5E"/>`;
        if (major) u += `<text x="${f1(x + 3)}" y="11" class="rtext">${c}</text>`;
      }
      const y0 = Math.floor((vp.sy - vp.oy) / step) * step;
      for (let c = y0; c - vp.sy + vp.oy < H; c += step / 2) {
        const y = f1(c - vp.sy + vp.oy);
        const major = c % step === 0;
        a += `<line y1="${y}" y2="${y}" x1="${major ? 13 : 16}" x2="${RULER}" stroke="#5E5E5E"/>`;
        if (major) a += `<text x="11" y="${f1(y - 3)}" class="rtext" transform="rotate(-90 11 ${f1(y - 3)})">${c}</text>`;
      }
      for (const c of E.cursors) {
        if (!c.ov || c.sticky) continue;
        for (const v of c.ov()) {
          if (v.t !== "box" || !v.handles) continue;
          const l = f1(v.b.x - vp.sx + vp.ox);
          const r = f1(v.b.x + v.b.w - vp.sx + vp.ox);
          const tp = f1(v.b.y - vp.sy + vp.oy);
          const bt = f1(v.b.y + v.b.h - vp.sy + vp.oy);
          u = `<rect x="${l}" y="0" width="${f1(r - l)}" height="${RULER}" fill="rgba(13,153,255,0.22)"/>` + u + `<text x="${f1(l + 3)}" y="11" class="rtext rsel">${Math.round(v.b.x)}</text>`;
          a = `<rect y="${tp}" x="0" height="${f1(bt - tp)}" width="${RULER}" fill="rgba(13,153,255,0.22)"/>` + a;
        }
      }
      for (const g of E.guides) {
        if (!g.dragging) continue;
        if (g.axis === "x") {
          const x = f1(g.cur - vp.sx + vp.ox);
          u += `<line x1="${x}" x2="${x}" y1="0" y2="${RULER}" stroke="${RED}"/><text x="${f1(x + 4)}" y="11" class="rtext" fill="${RED}" style="fill:${RED}">${Math.round(g.cur)}</text>`;
        } else {
          const y = f1(g.cur - vp.sy + vp.oy);
          a += `<line y1="${y}" y2="${y}" x1="0" x2="${RULER}" stroke="${RED}"/>`;
        }
      }
      this.rulers.innerHTML =
        `<div class="ruler ruler-top" style="transform:translateY(${f1((t - 1) * 100)}%)"><svg width="${W}" height="${RULER}">${u}</svg></div>` +
        `<div class="ruler ruler-left" style="transform:translateX(${f1((t - 1) * 100)}%)"><svg width="${RULER}" height="${H}">${a}</svg></div>` +
        `<div class="ruler-corner" style="opacity:${f1(t)}"></div>`;
    }

    render(E) {
      this.syncWorld();
      if (this.backdrops && this.backdrops.length) {
        const o = f1(clamp((Math.abs(E.vp.sy - this.bdStart) - 8) / 80, 0, 1));
        if (o !== this._bdO) {
          this._bdO = o;
          for (const d of this.backdrops) d.style.opacity = o;
        }
      }
      if (E.items) for (const it of E.items) this.renderItem(it);
      this.renderOverlay(E);
      this.renderCursors(E);
      this.renderRulers(E);
    }
  }

  // ----------------------------------------------------------------- engine

  class Engine {
    constructor(view) {
      this.view = view;
      this.vp = view.vp;
      this.items = null;
      this.tasks = [];
      this.groups = [];
      this.guides = [];
      this.editLines = new Set();
      this.cursors = [];
      this.started = false;
      this.ready = false;
      this.frontier = 0;
      this.vel = 0;
      this.tempo = 1;
      this.speed = 1;
      this.time = 0;
      this.rulers = { want: 0, t: 0, lastNeed: -10 };
      this.lastScroll = null;
      this.nextId = 0;
      this.spawnCooldown = 0;
      this.flocking = false;
      this.lastT = null;
      this.tv = { x: 0, y: 0 };
      this.mouse = null;
      this.retired = 0;
      this.doneCount = 0;
      this.waitCount = 0;
      const vp = this.vp;
      for (let n = 0; n < INTRO_AGENTS; n++) {
        const side = n % 2 === 0;
        const p = this.fromViewport(side ? vp.ox - 40 - rand(0, 200) : vp.ox + vp.vw + 40 + rand(0, 200), vp.oy + rand(0.05, 0.95) * vp.vh);
        const c = this.makeCursor(p.x, p.y, n < MIN_AGENTS);
        c.follow = true;
        this.cursors.push(c);
      }
    }

    setModel(m) {
      this.items = m.items;
      this.tasks = m.tasks;
      this.groups = m.groups;
      this.guides = m.guides;
      this.guideDeps = new Map(m.guides.map((g) => [g, g.deps || []]));
      this.waitCount = m.tasks.length;
      this.ready = true;
    }

    makeCursor(x, y, home = false) {
      const id = this.nextId++;
      const fast = Math.random() < 0.25;
      return {
        id, x, y, home,
        name: NAMES[id % NAMES.length],
        color: COLORS[id % COLORS.length],
        shape: "arrow", press: 0, task: null, gen: null, ov: null,
        idleFor: 0, leaving: false, worked: false, sticky: false,
        vx: 0, vy: 0, angle: 0,
        speed: fast ? rand(1000, 1500) : rand(300, 750),
        force: fast ? rand(3500, 6000) : rand(700, 1800),
        spin: fast ? rand(2.2, 3.4) : rand(0.8, 1.8),
        curl: rand(-1, 1), orbit: rand(70, 170), follow: false,
      };
    }

    get viewTop() {
      return this.vp.sy;
    }
    get viewBot() {
      return this.vp.sy + this.vp.vh;
    }
    fromViewport(x, y) {
      const vp = this.vp;
      return { x: x - vp.ox + vp.sx, y: y - vp.oy + vp.sy };
    }
    taskY(t) {
      return t.layer === "world" ? t.y : this.viewTop + t.y;
    }

    // screen position of a cursor / an item (for panning and loudness)
    scr(c) {
      const vp = this.vp;
      return c.sticky ? { x: c.x, y: c.y } : { x: c.x - vp.sx + vp.ox, y: c.y - vp.sy + vp.oy };
    }

    sfxPlace(kind, it, b) {
      if (!this.sfx) return;
      const vp = this.vp;
      b = b || this.bounds(it);
      let x = b.x + b.w / 2;
      let y = b.y + b.h / 2;
      if (!it || it.layer === "world") {
        x += vp.ox - vp.sx;
        y += vp.oy - vp.sy;
      }
      this.sfx.place(kind, x, y, b.w, b.h, vp.vw, vp.vh, (it && it.fs) || 0);
    }

    start() {
      if (this.started || !this.ready) return;
      this.started = true;
      this.startTime = this.time;
      for (const c of this.cursors) {
        c.follow = false;
        c.gen = null;
        c.angle = ((((c.angle + 180) % 360) + 360) % 360) - 180;
      }
      if (this.sfx) this.sfx.start();
      if (this.onStart) this.onStart();
    }

    bounds(it) {
      if (it.kind === "text") {
        let h = it.tb.h;
        if (it.editing && !it.selAll && it.total) {
          const lines = Math.max(1, Math.round(it.tb.h / it.lh));
          h = Math.min(it.tb.h, Math.max(it.lh, Math.ceil((it.shown / it.total) * lines) * it.lh));
        }
        const s = it.scale;
        const ax = it.align === "center" ? it.tb.w * (1 - s) / 2 : it.align === "right" || it.align === "end" ? it.tb.w * (1 - s) : 0;
        return { x: it.tb.x + it.dx + ax, y: it.tb.y + it.dy, w: it.tb.w * s, h: h * s };
      }
      if (it.kind === "line") {
        return { x: it.x + it.dx, y: it.y + it.dy, w: it.w, h: it.h };
      }
      return {
        x: it.x + it.dx,
        y: it.y + it.dy,
        w: it.draw ? it.draw.w : it.w,
        h: it.draw ? it.draw.h : it.h,
      };
    }

    unionBounds(list) {
      const bs = list.map((it) => this.bounds(it));
      const x = Math.min(...bs.map((b) => b.x));
      const y = Math.min(...bs.map((b) => b.y));
      return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
    }

    underline(it, b) {
      return { x: b.x, y: b.y + (it.lh * 0.5 + it.fs * 0.42) * it.scale, w: Math.min(b.w, it.tb.w * it.scale), h: 0 };
    }

    selection(it, extra) {
      const b = this.bounds(it);
      return Object.assign(
        {
          t: "box",
          b,
          handles: true,
          badge: `${Math.round(b.w)} × ${Math.round(b.h)}`,
          rulerLines: true,
          underline: it.kind === "text" ? this.underline(it, b) : undefined,
        },
        extra,
      );
    }

    available() {
      const out = [];
      for (const t of this.tasks) {
        if (t.state !== "wait") continue;
        if (t.layer === "world" && t.gate > this.frontier) continue;
        let ok = true;
        for (const d of t.deps)
          if (d.state !== "done") {
            ok = false;
            break;
          }
        if (ok) out.push(t);
      }
      return out;
    }

    pick(c, list) {
      let best = null;
      let bestS = Infinity;
      const top = this.viewTop - 40;
      const bot = this.viewBot;
      const cy = c.sticky ? c.y + this.viewTop : c.y;
      for (const t of list) {
        const y = this.taskY(t);
        const u = y >= top && y <= bot ? 0 : y < top ? 1 : 2;
        const s = u * 1e6 + (u === 1 ? top - y : y) * 0.6 + Math.abs(y - cy) * 0.4 - (t.spec.type === "guide" ? 5e5 : 0);
        if (s < bestS) {
          bestS = s;
          best = t;
        }
      }
      return best;
    }

    // work that's unlocked but unfinished (things past the frontier need scrolling, not waiting)
    backlog() {
      let n = 0;
      for (const t of this.tasks) if (t.state !== "done" && (t.layer !== "world" || t.gate <= this.frontier)) n++;
      return n;
    }

    step(dt) {
      dt = Math.min(dt, 0.05);
      this.time += dt;
      const vp = (this.vp = this.view.vp);
      const sv = Math.abs(vp.sy - (this.lastScroll == null ? vp.sy : this.lastScroll)) / Math.max(dt, 0.001);
      this.lastScroll = vp.sy;
      this.vel = Math.max(this.vel * Math.exp(-dt * 1.2), this.vel * 0.7 + sv * 0.3);
      if (this.started) this.frontier = Math.max(this.frontier, this.viewBot);
      const avail = this.started ? this.available() : [];
      this.tempo = clamp(2.1 + this.vel / 900 + (avail.length / Math.max(1, this.cursors.length)) * 0.5, 2.1, 4.5) * this.speed;

      if (this.rulers.want > 0) this.rulers.lastNeed = this.time;
      const rt = this.time - this.rulers.lastNeed < 0.7 ? 1 : 0;
      this.rulers.t += (rt - this.rulers.t) * Math.min(1, dt * 10);
      if (Math.abs(rt - this.rulers.t) < 0.002) this.rulers.t = rt;

      for (const g of this.guides) {
        if (!g.vis) continue;
        if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 1.5);
        const deps = this.guideDeps.get(g) || [];
        if (g.shownAt == null) g.shownAt = this.time;
        if (!g.dragging && g.op > 0 && this.time - g.shownAt > 7 && !deps.some((t) => t.state === "active")) g.op = Math.max(0, g.op - dt * 1.2);
        else if (!g.dragging && deps.every((t) => t.state === "done")) {
          const last = Math.max(0, ...deps.map((t) => t.doneAt));
          if (this.time - last > 1.2 && g.op > 0) g.op = Math.max(0, g.op - dt * 1.2);
        }
      }

      if (!this.flocking && this.started && this.waitCount === 0) {
        for (const c of this.cursors)
          if (!c.task && !c.follow) {
            c.follow = true;
            c.gen = null;
            c.leaving = false;
            c.ov = null;
            c.shape = "arrow";
          }
        if (this.cursors.every((c) => c.follow)) {
          this.flocking = true;
          this.endTime = this.time;
          if (this.onComplete) this.onComplete();
        }
      }
      if (this.flocking) {
        this.flock(dt);
        return;
      }
      if (!this.started) {
        const center = this.fromViewport(vp.ox + vp.vw / 2, vp.oy + vp.vh / 2);
        if (this.follow(dt, this.cursors, center, 0.7) && this.ready) this.start();
        return;
      }
      if (this.cursors.some((c) => c.follow))
        this.follow(
          dt,
          this.cursors.filter((c) => c.follow),
        );

      this.spawnCooldown -= dt;
      const want = clamp(MIN_AGENTS + Math.floor(this.vel / 40) + Math.floor(avail.length / 2), MIN_AGENTS, MAX_AGENTS);
      const active = this.cursors.filter((c) => !c.leaving).length;
      const busy = this.cursors.filter((c) => c.task).length;
      if (active < want && avail.length > active - busy && this.spawnCooldown <= 0) {
        const left = Math.random() < 0.5;
        const p = this.fromViewport(left ? vp.ox - 40 : vp.ox + vp.vw + 40, vp.oy + rand(0.2, 0.8) * vp.vh);
        this.cursors.push(this.makeCursor(p.x, p.y));
        this.spawnCooldown = 0.035;
      }

      for (const c of this.cursors) {
        if (c.task || c.leaving || c.follow) continue;
        const t = this.pick(c, avail);
        if (!t) continue;
        avail.splice(avail.indexOf(t), 1);
        t.state = "active";
        this.waitCount--;
        c.task = t;
        c.worked = true;
        c.idleFor = 0;
        if (t.layer !== "world") {
          c.sticky = true;
          c.x += vp.ox - vp.sx;
          c.y += vp.oy - vp.sy;
        }
        c.gen = this.run(c, t);
      }

      for (const c of [...this.cursors]) {
        if (c.follow) continue;
        c.press = Math.max(0, c.press - dt * 6);
        if (c.angle !== 0) c.angle = Math.abs(c.angle) < 0.5 ? 0 : c.angle * (1 - Math.min(1, dt * 10));
        if (!c.task) {
          c.idleFor += dt;
          if (!c.leaving && c.idleFor > 2.5 && this.cursors.filter((m) => !m.leaving).length > MIN_AGENTS && !c.home) {
            c.leaving = true;
            c.gen = this.leave(c);
          }
          if (!c.gen) c.gen = this.idle(c);
        }
        if (c.gen.next(dt).done) {
          if (c.task) {
            c.task.state = "done";
            c.task.doneAt = this.time;
            this.doneCount++;
            c.task = null;
            c.ov = null;
            if (c.sticky) {
              c.sticky = false;
              c.x -= vp.ox - vp.sx;
              c.y -= vp.oy - vp.sy;
            }
            c.shape = "arrow";
          }
          c.gen = null;
          if (c.leaving) {
            if (c.worked) this.retired++;
            this.cursors.splice(this.cursors.indexOf(c), 1);
          }
        }
      }
    }

    flockTarget() {
      if (this.mouse) return this.fromViewport(this.mouse.x, this.mouse.y);
      const t = this.time;
      const vp = this.vp;
      return this.fromViewport(vp.ox + vp.vw * (0.5 + 0.28 * Math.sin(t * 0.37)), vp.oy + vp.vh * (0.5 + 0.25 * Math.sin(t * 0.53 + 1)));
    }

    flock(dt) {
      this.spawnCooldown -= dt;
      if (this.cursors.length < FLOCK_AGENTS && this.spawnCooldown <= 0 && !this.releasing) {
        const vp = this.vp;
        const left = Math.random() < 0.5;
        const p = this.fromViewport(left ? vp.ox - 30 : vp.ox + vp.vw + 30, vp.oy + rand(0.1, 0.9) * vp.vh);
        const c = this.makeCursor(p.x, p.y);
        c.follow = true;
        this.cursors.push(c);
        this.spawnCooldown = 0.04;
      }
      if (this.releasing) {
        for (const c of [...this.cursors]) {
          if (!c.gen) c.gen = this.leave(c);
          if (c.gen.next(dt).done) this.cursors.splice(this.cursors.indexOf(c), 1);
        }
        return;
      }
      this.follow(dt, this.cursors);
    }

    // Boids-ish orbit around a target, ported from the original.
    follow(dt, list, target, scale = 1) {
      const m = this.mouse ? this.fromViewport(this.mouse.x, this.mouse.y) : null;
      const o = target || this.flockTarget();
      const time = this.time;
      if (m && this.lastT && dt > 0) {
        const k = Math.min(1, dt * 18);
        this.tv.x += ((m.x - this.lastT.x) / dt - this.tv.x) * k;
        this.tv.y += ((m.y - this.lastT.y) / dt - this.tv.y) * k;
      }
      this.lastT = m;
      const R = 135 * scale * (1 + 0.18 * Math.sin(time * 0.55));
      const swirl = Math.tanh(Math.cos(time * 0.11) * 3);
      const want = [];
      for (const c of list) {
        const vx = c.x - o.x;
        const vy = c.y - o.y;
        const d = Math.hypot(vx, vy) || 0.01;
        const nx = vx / d;
        const ny = vy / d;
        const ang = Math.atan2(vy, vx);
        const off = (c.orbit - 120) * 0.55 * scale;
        const rr = R * (1 + 0.3 * Math.sin(3 * ang + time * 0.7)) + off;
        const tang = 300 * (0.7 + c.spin * 0.2) * swirl;
        const rad = clamp((rr - d) * 4, -2600, 1400);
        const far = Math.min(1, Math.max(0, (d - rr) / 600));
        want.push([-ny * tang + nx * rad - ny * c.curl * 400 * far, nx * tang + ny * rad + nx * c.curl * 400 * far]);
      }
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        let ax = 0;
        let ay = 0;
        let wsum = 0;
        for (let j = 0; j < list.length; j++) {
          if (j === i) continue;
          const q = list[j];
          const d = Math.hypot(q.x - c.x, q.y - c.y);
          if (d > 90) continue;
          const w = 1 - d / 90;
          ax += q.vx * w;
          ay += q.vy * w;
          wsum += w;
        }
        let [fx, fy] = want[i];
        if (wsum > 0) {
          fx = fx * 0.7 + (ax / wsum) * 0.3;
          fy = fy * 0.7 + (ay / wsum) * 0.3;
        }
        const dist = Math.max(0, Math.hypot(c.x - o.x, c.y - o.y) - 180 * scale);
        const maxV = c.speed * (1.3 + Math.min(3.2, dist / 90));
        const L = Math.hypot(fx, fy);
        if (L > maxV) {
          fx *= maxV / L;
          fy *= maxV / L;
        }
        let gx = (fx - c.vx) * 6;
        let gy = (fy - c.vy) * 6;
        const maxF = c.force * (1.4 + Math.min(5, dist / 50));
        const G = Math.hypot(gx, gy);
        if (G > maxF) {
          gx *= maxF / G;
          gy *= maxF / G;
        }
        c.vx += gx * dt;
        c.vy += gy * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      }
      const R0 = 48;
      let touched = false;
      if (m)
        for (const c of list) {
          const vx = c.x - m.x;
          const vy = c.y - m.y;
          const d = Math.hypot(vx, vy) || 0.01;
          if (d >= R0) continue;
          touched = true;
          const nx = vx / d;
          const ny = vy / d;
          c.x = m.x + nx * R0;
          c.y = m.y + ny * R0;
          const rel = (c.vx - this.tv.x) * nx + (c.vy - this.tv.y) * ny;
          if (rel < 0) {
            c.vx -= nx * rel * 1.6;
            c.vy -= ny * rel * 1.6;
          }
          c.vx += nx * 260;
          c.vy += ny * 260;
        }
      for (const c of list) {
        if (Math.hypot(c.vx, c.vy) < 30) continue;
        const d = ((((Math.atan2(c.vy, c.vx) * 180) / Math.PI + 128 - c.angle + 540) % 360) + 360) % 360 - 180;
        c.angle += d * Math.min(1, dt * 8);
        c.press = Math.max(0, c.press - dt * 6);
      }
      return touched;
    }

    // ------------------------------------------------------- primitives

    *wait(t) {
      let n = 0;
      while (n < t) n += (yield) * this.tempo;
    }

    *moveTo(c, target, o = {}) {
      const get = typeof target === "function" ? target : () => target;
      const x0 = c.x;
      const y0 = c.y;
      const p0 = get();
      const dist = Math.hypot(p0.x - x0, p0.y - y0);
      if (dist < 0.5) {
        c.x = p0.x;
        c.y = p0.y;
        if (o.onStep) o.onStep();
        return;
      }
      const dur = clamp(0.12 + Math.sqrt(dist) * 0.021, 0.14, 0.9) / (o.speed || 1);
      const bend = (o.bend != null ? o.bend : (Math.random() < 0.5 ? -1 : 1) * rand(0.04, 0.14)) * Math.min(dist, 600);
      let t = 0;
      while (t < dur) {
        t += (yield) * this.tempo;
        const k = Math.min(1, t / dur);
        const e = o.drag || k < 0.15 ? easeInOut(k) : easeOut(k);
        const p = get();
        const dx = p.x - x0;
        const dy = p.y - y0;
        const L = Math.hypot(dx, dy) || 1;
        const off = Math.sin(Math.PI * e) * bend;
        c.x = x0 + dx * e + (-dy / L) * off;
        c.y = y0 + dy * e + (dx / L) * off;
        if (o.onStep) o.onStep();
      }
      const p = get();
      c.x = p.x;
      c.y = p.y;
      if (o.onStep) o.onStep();
    }

    *click(c) {
      c.press = 1;
      if (this.sfx) this.sfx.press(this.scr(c).x, this.vp.vw);
      yield* this.wait(0.07);
    }

    *type(it, c) {
      const N = it.total;
      const k = clamp(70 / Math.max(1, N), 0.06, 1);
      let budget = 0;
      let i = it.shown;
      while (i < N) {
        budget += (yield) * this.tempo;
        while (i < N && budget > 0) {
          const ch = it.seq[i];
          let d = rand(0.012, 0.04);
          if (ch === " ") d += rand(0, 0.03);
          if (ch === "\n") d += 0.1;
          if (Math.random() < 0.025) d += rand(0.08, 0.2);
          budget -= d * k;
          i++;
        }
        if (c && this.sfx && i > it.shown) this.sfx.key(this.scr(c).x, this.vp.vw, c.id, i - it.shown, /\s/.test(it.seq.slice(it.shown, i)) ? 1 : 0);
        it.shown = i;
        bump(it);
      }
    }

    *idle(c) {
      for (;;) {
        const vp = this.vp;
        const top = this.viewTop;
        const bot = this.viewBot;
        const p = { x: rand(vp.sx + vp.vw * 0.17, vp.sx + vp.vw * 0.83), y: rand(top + (bot - top) * 0.2, top + (bot - top) * 0.8) };
        yield* this.moveTo(c, p, { speed: 0.35 });
        let w = rand(0.4, 1.4);
        while (w > 0) {
          w -= yield;
          if (c.y < this.viewTop || c.y > this.viewBot) break;
        }
      }
    }

    *leave(c) {
      const right = c.x > this.vp.sx + this.vp.vw / 2;
      yield* this.moveTo(
        c,
        () => {
          const vp = this.vp;
          return this.fromViewport(right ? vp.ox + vp.vw + 60 : vp.ox - 60, c.y - this.viewTop + vp.oy);
        },
        { speed: 0.8 },
      );
    }

    run(c, t) {
      const s = t.spec;
      switch (s.type) {
        case "rect":
          return this.drawBox(c, s.it, false);
        case "image":
          return this.drawBox(c, s.it, true);
        case "line":
          return this.drawLine(c, s.it);
        case "text":
          return this.drawText(c, s.it, s.snap || null, !!s.grow);
        case "guide":
          return this.dragGuide(c, s.g);
        case "dup":
          return this.duplicate(c, s.g, s.k);
        case "edit":
          return this.editText(c, s.it);
        case "restyle":
        case "swap":
          return this.restyle(c, s.it);
      }
      return this.wait(0.1);
    }

    // Where a drag should end so a huge box doesn't drag the cursor off-screen.
    dragEnd(c, it) {
      const vp = this.vp;
      const screen = c.sticky;
      const right = screen ? vp.ox + vp.vw : vp.sx + vp.vw;
      const bot = screen ? vp.oy + vp.vh : this.viewBot;
      const x = it.x + it.w > right - 16 ? Math.max(it.x + Math.min(it.w, 40), right - 30) : it.x + it.w;
      const y = it.y + it.h > bot - 16 ? Math.max(it.y + Math.min(it.h, 40), bot - 40) : it.y + it.h;
      return { x: Math.min(x, it.x + it.w), y: Math.min(y, it.y + it.h) };
    }

    *drawBox(c, it, isImg) {
      c.shape = "cross";
      yield* this.moveTo(c, { x: it.x, y: it.y });
      c.press = 1;
      it.vis = true;
      if (it.big) it.styled = true;
      it.draw = { w: 0, h: 0 };
      bump(it);
      c.ov = () => [this.selection(it)];
      const end = this.dragEnd(c, it);
      yield* this.moveTo(c, end, {
        speed: 0.75,
        drag: true,
        bend: 0,
        onStep: () => {
          it.draw = { w: Math.max(0, c.x - it.x), h: Math.max(0, c.y - it.y) };
          bump(it);
        },
      });
      if (end.x < it.x + it.w - 0.5 || end.y < it.y + it.h - 0.5) {
        const w0 = it.draw.w;
        const h0 = it.draw.h;
        let k = 0;
        while (k < 1) {
          k = Math.min(1, k + ((yield) * this.tempo) / 0.5);
          const e = easeOut(k);
          it.draw = { w: w0 + (it.w - w0) * e, h: h0 + (it.h - h0) * e };
          bump(it);
        }
      }
      it.draw = null;
      bump(it);
      c.shape = "arrow";
      yield* this.wait(rand(0.18, 0.3));
      it.styled = true;
      bump(it);
      this.sfxPlace(isImg ? "image" : "rect", it);
      yield* this.wait(isImg ? 0.5 : 0.35);
      c.ov = null;
      it.done = true;
      bump(it);
    }

    *drawLine(c, it) {
      c.shape = "pen-add";
      yield* this.moveTo(c, it.pts[0]);
      yield* this.click(c);
      it.vis = true;
      it.edit = true;
      it.placed = 1;
      it.owner = c;
      bump(it);
      this.editLines.add(it);
      c.shape = "pen";
      for (let i = 1; i < it.pts.length; i++) {
        yield* this.moveTo(c, it.pts[i], { bend: rand(-0.03, 0.03) });
        yield* this.click(c);
        it.placed = i + 1;
        bump(it);
        yield* this.wait(rand(0.04, 0.12));
      }
      it.owner = null;
      bump(it);
      yield* this.moveTo(c, { x: c.x + rand(14, 30), y: c.y + rand(10, 24) }, { speed: 1.4 });
      yield* this.wait(0.3);
      it.edit = false;
      this.editLines.delete(it);
      it.done = true;
      bump(it);
      this.sfxPlace("line", it);
    }

    *drawText(c, it, guide, grow) {
      if (guide) {
        if (guide.axis === "x") {
          it.dx = rand(28, 64);
          it.dy = rand(-8, 8);
        } else {
          it.dx = rand(-8, 8);
          it.dy = rand(18, 34) * (Math.random() < 0.5 ? -1 : 1);
        }
      }
      if (grow) it.scale = Math.min(1, 18 / it.fs);
      const b0 = this.bounds(it);
      c.shape = "cross";
      yield* this.moveTo(c, { x: b0.x, y: b0.y });
      const lineH = Math.min(b0.h, it.lh * it.scale);
      if (b0.w < 140 && it.tb.h < it.lh * 1.6) {
        yield* this.click(c);
      } else {
        c.press = 1;
        const ghost = { x: b0.x, y: b0.y, w: 0, h: 0 };
        c.ov = () => [{ t: "box", b: ghost, handles: true, badge: `${Math.round(ghost.w)} × ${Math.round(ghost.h)}`, rulerLines: true }];
        yield* this.moveTo(
          c,
          { x: b0.x + b0.w, y: b0.y + lineH },
          {
            speed: 0.9,
            drag: true,
            bend: 0,
            onStep: () => {
              ghost.w = Math.max(0, c.x - b0.x);
              ghost.h = Math.max(0, c.y - b0.y);
            },
          },
        );
      }
      it.vis = true;
      it.editing = true;
      it.shown = 0;
      bump(it);
      c.shape = "ibeam";
      c.ov = () => [{ t: "box", b: this.bounds(it) }];
      yield* this.moveTo(c, { x: c.x + rand(-30, 10), y: c.y + rand(10, 30) }, { speed: 1.5 });
      yield* this.type(it, c);
      yield* this.wait(0.12);
      it.editing = false;
      bump(it);
      this.sfxPlace("text", it);
      c.shape = "arrow";
      c.ov = () => [this.selection(it)];
      if (grow) {
        const steps = [24, 32, 40, 48, 56, 64, 72, 88, 104].filter((s) => s < it.fs && s > 18);
        let k = 0;
        for (const s of [...steps, it.fs]) {
          yield* this.wait(0.06);
          it.scale = s / it.fs;
          bump(it);
          if (this.sfx) this.sfx.grow(k++, this.scr(c).x, this.vp.vw);
        }
        it.scale = 1;
        bump(it);
        yield* this.wait(0.15);
      }
      if (guide) {
        // give the guide a moment to land; never block a cursor on it
        let waited = 0;
        while (guide.task.state !== "done" && waited < 1.6) waited += (yield) * this.tempo;
        if (guide.task.state !== "done") guide = null;
      }
      if (guide) {
        const u = this.bounds(it);
        const a = { x: u.x + Math.min(u.w * 0.4, 60) + rand(-6, 6), y: u.y + Math.min(u.h * 0.5, 22) };
        yield* this.moveTo(c, a);
        c.press = 1;
        const p = { x: a.x - it.dx, y: a.y - it.dy };
        const m = {
          x: p.x + (guide.axis === "x" ? -rand(2, 5) : rand(-6, 6)),
          y: p.y + (guide.axis === "y" ? -rand(2, 5) : rand(-3, 3)),
        };
        const drag = () => {
          let h = c.x - p.x;
          let v = c.y - p.y;
          if (guide.axis === "x" && Math.abs(h) < 9) {
            if (h !== 0 && it.dx !== 0) {
              if (guide.flash < 0.5 && this.sfx) this.sfx.snap(this.scr(c).x, this.vp.vw);
              guide.flash = 1;
            }
            h = 0;
          }
          if (guide.axis === "y" && Math.abs(v) < 9) {
            if (v !== 0 && it.dy !== 0) {
              if (guide.flash < 0.5 && this.sfx) this.sfx.snap(this.scr(c).x, this.vp.vw);
              guide.flash = 1;
            }
            v = 0;
          }
          it.dx = h;
          it.dy = v;
          bump(it);
        };
        yield* this.moveTo(c, m, { speed: 0.6, drag: true, onStep: drag });
        yield* this.wait(0.1);
        yield* this.moveTo(c, p, { speed: 2, onStep: drag });
        it.dx = 0;
        it.dy = 0;
        bump(it);
        yield* this.wait(0.25);
      } else if (it.dx || it.dy) {
        const dx0 = it.dx;
        const dy0 = it.dy;
        let k = 0;
        while (k < 1) {
          k = Math.min(1, k + ((yield) * this.tempo) / 0.3);
          const e = easeInOut(k);
          it.dx = dx0 * (1 - e);
          it.dy = dy0 * (1 - e);
          bump(it);
        }
        yield* this.wait(0.15);
      } else yield* this.wait(0.2);
      c.ov = null;
      it.done = true;
      bump(it);
    }

    *dragGuide(c, g) {
      this.rulers.want++;
      try {
        const r = rand(-0.15, 0.15);
        const from = () => {
          const vp = this.vp;
          return g.axis === "x"
            ? this.fromViewport(vp.ox + 10, vp.oy + vp.vh * (0.45 + r))
            : this.fromViewport(vp.ox + vp.vw * 0.3 + r * 200, vp.oy + 10);
        };
        c.shape = "arrow";
        yield* this.moveTo(c, from);
        while (this.rulers.t < 0.95) yield;
        yield* this.moveTo(c, from, { speed: 3 });
        c.press = 1;
        c.shape = g.axis === "x" ? "ew" : "ns";
        g.vis = true;
        g.dragging = true;
        g.op = 1;
        const upd = () => {
          g.cur = g.axis === "x" ? c.x : c.y;
        };
        upd();
        const to = () => {
          const s = from();
          return g.axis === "x" ? { x: g.pos, y: s.y + 40 } : { x: s.x + 30, y: g.pos };
        };
        yield* this.moveTo(c, to, { speed: 0.55, drag: true, onStep: upd });
        g.cur = g.pos;
        g.dragging = false;
        if (this.sfx) {
          const p = this.scr(c);
          this.sfx.place("guide", p.x, p.y, 1, 1, this.vp.vw, this.vp.vh, 0);
        }
        c.shape = "arrow";
        yield* this.wait(0.25);
      } finally {
        this.rulers.want--;
      }
    }

    *duplicate(c, g, k) {
      const dst = g.dst[k];
      let src = g.src;
      const cand = [g.src, ...g.dst.filter((d) => d.task.state === "done")];
      const dd = (a) => Math.hypot(a.box.x - dst.box.x, a.box.y - dst.box.y);
      for (const s of cand) if (dd(s) < dd(src)) src = s;
      const sb = this.unionBounds(src.items);
      c.shape = "arrow";
      const u = { x: sb.x + Math.min(sb.w * 0.45, 70) + rand(-8, 8), y: sb.y + Math.min(sb.h * 0.45, 30) + rand(-4, 4) };
      yield* this.moveTo(c, u);
      yield* this.click(c);
      c.ov = () => [{ t: "box", b: sb, handles: true, badge: `${Math.round(sb.w)} × ${Math.round(sb.h)}` }];
      yield* this.wait(rand(0.15, 0.3));
      c.shape = "dup";
      yield* this.wait(0.12);
      c.press = 1;
      const ox = src.box.x - dst.box.x;
      const oy = src.box.y - dst.box.y;
      for (const it of dst.items) {
        it.vis = true;
        it.mode = "master";
        it.dx = ox;
        it.dy = oy;
        if (it.kind === "rect" || it.kind === "image") {
          it.styled = true;
          it.draw = null;
        }
        if (it.kind === "line") {
          it.placed = it.pts.length;
        }
        bump(it);
      }
      const m = { x: u.x - ox, y: u.y - oy };
      c.ov = () => {
        const cb = this.unionBounds(dst.items);
        const h = [
          { t: "box", b: sb, color: "red" },
          { t: "box", b: cb, color: "red" },
        ];
        const sp = this.spacing(sb, cb);
        if (sp) h.push(sp);
        return h;
      };
      yield* this.moveTo(c, m, {
        speed: 0.6,
        drag: true,
        onStep: () => {
          for (const it of dst.items) {
            it.dx = ox + (c.x - u.x);
            it.dy = oy + (c.y - u.y);
            bump(it);
          }
        },
      });
      this.sfxPlace("dup", dst.items[0], this.unionBounds(dst.items));
      for (const it of dst.items) {
        it.dx = 0;
        it.dy = 0;
        it.settle = true;
        if (!it.editTask) it.mode = "own";
        if (it.kind === "text" && it.mode === "own") it.shown = it.total;
        bump(it);
      }
      yield* this.wait(0.1);
      c.shape = "arrow";
      c.ov = () => {
        const cb = this.unionBounds(dst.items);
        return [{ t: "box", b: cb, handles: true, badge: `${Math.round(cb.w)} × ${Math.round(cb.h)}` }];
      };
      yield* this.wait(0.35);
      for (const it of dst.items)
        if (!it.editTask) {
          it.done = true;
          bump(it);
        }
    }

    spacing(a, b) {
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (oy > 0) {
        const y = Math.max(a.y, b.y) + oy / 2;
        const [l, r] = a.x < b.x ? [a, b] : [b, a];
        const gap = r.x - (l.x + l.w);
        if (gap > 0) return { t: "measure", a: { x: l.x + l.w, y }, b: { x: r.x, y }, label: String(Math.round(gap)) };
      } else if (ox > 0) {
        const x = Math.max(a.x, b.x) + ox / 2;
        const [t, btm] = a.y < b.y ? [a, b] : [b, a];
        const gap = btm.y - (t.y + t.h);
        if (gap > 0) return { t: "measure", a: { x, y: t.y + t.h }, b: { x, y: btm.y }, label: String(Math.round(gap)) };
      }
      return null;
    }

    *editText(c, it) {
      c.shape = "arrow";
      const b = this.bounds(it);
      yield* this.moveTo(c, { x: b.x + Math.min(b.w * 0.5, 50) + rand(-5, 5), y: b.y + Math.min(it.lh, b.h) * 0.55 });
      yield* this.click(c);
      yield* this.wait(0.08);
      yield* this.click(c);
      it.selAll = true;
      it.editing = true;
      bump(it);
      c.shape = "ibeam";
      c.ov = () => [{ t: "box", b: this.bounds(it) }];
      yield* this.wait(rand(0.2, 0.35));
      it.mode = "own";
      it.selAll = false;
      it.shown = 0;
      bump(it);
      yield* this.type(it, c);
      yield* this.wait(0.12);
      it.editing = false;
      bump(it);
      c.shape = "arrow";
      c.ov = () => [this.selection(it)];
      this.sfxPlace("edit", it);
      yield* this.wait(0.3);
      c.ov = null;
      it.done = true;
      bump(it);
    }

    *restyle(c, it) {
      c.shape = "arrow";
      const b = this.bounds(it);
      yield* this.moveTo(c, { x: b.x + Math.min(b.w * 0.5, 60) + rand(-6, 6), y: b.y + Math.min(b.h * 0.5, 30) + rand(-4, 4) });
      yield* this.click(c);
      c.ov = () => [this.selection(it)];
      yield* this.wait(rand(0.15, 0.3));
      it.mode = "own";
      bump(it);
      this.sfxPlace(it.kind === "image" ? "image" : "restyle", it);
      yield* this.wait(0.4);
      c.ov = null;
      it.done = true;
      bump(it);
    }
  }

  // ------------------------------------------------------------------ sound

  // A glass piano in E. Every finished piece of the page plays one note of the
  // E major pentatonic, quantized to a soft 16th-note grid, so a busy swarm comes
  // out as a generative melody: big sections low, small things high, pitch rising
  // left to right, panned to where the cursor is. Typing and clicks are quiet
  // paper ticks underneath. All synthesized; no audio files.
  const PENTA = [0, 2, 4, 7, 9]; // E F# G# B C#
  const E2 = 40;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let soundPref = true;
  const SPK_ICON = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6v4h2.5l3.5 3V3L5 6z" fill="currentColor"/>';

  class Sound {
    constructor() {
      this.on = soundPref;
      this.ctx = null;
      this.bpm = 104;
      this.slots = new Map();
      this.lastKey = new Map();
      this.keyTimes = [];
      this.pressTimes = [];
      this.ends = []; // when each sounding piano voice dies out
      this.fakeNow = null; // offline renders drive the clock explicitly
    }

    init(offline) {
      if (this.ctx) return true;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = offline || new Ctx({ latencyHint: "interactive" });
      } catch (_) {
        return false;
      }
      const ctx = this.ctx;
      const out = ctx.createGain();
      out.gain.value = this.on ? 1 : 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 14;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.3;
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp);
      comp.connect(out);
      out.connect(ctx.destination);
      const verb = ctx.createConvolver();
      verb.buffer = this.impulse(3.2, 2.4);
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      verb.connect(wet);
      wet.connect(master);
      this.out = out;
      this.master = master;
      this.verb = verb;
      this.noiseBuf = this.noise(1.5);
      this.t0 = this.now();
      return true;
    }

    now() {
      return this.fakeNow != null ? this.fakeNow : this.ctx.currentTime;
    }

    // Generated room: decaying stereo noise, darkened as it rings out.
    impulse(secs, decay) {
      const sr = this.ctx.sampleRate;
      const n = Math.floor(sr * secs);
      const b = this.ctx.createBuffer(2, n, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < n; i++) {
          const k = i / n;
          const a = 0.55 - 0.4 * k; // lowpass closes over time: warm tail
          lp += a * (Math.random() * 2 - 1 - lp);
          d[i] = lp * Math.pow(1 - k, decay) * (i < sr * 0.012 ? i / (sr * 0.012) : 1);
        }
      }
      return b;
    }

    noise(secs) {
      const sr = this.ctx.sampleRate;
      const b = this.ctx.createBuffer(1, Math.floor(sr * secs), sr);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }

    setOn(on) {
      this.on = soundPref = on;
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setTargetAtTime(on ? 1 : 0, t, 0.05);
      if (on) this.resume();
    }

    resume() {
      if (this.ctx && this.ctx.state === "suspended" && this.ctx.resume) this.ctx.resume().catch(() => {});
    }

    get blocked() {
      return !!this.ctx && this.ctx.state !== "running" && this.fakeNow == null;
    }

    log(fn, args) {
      if (Array.isArray(window.__swarmSfxLog)) window.__swarmSfxLog.push({ t: performance.now() / 1000, fn, args });
    }

    ready() {
      return this.ctx && this.on && (this.fakeNow != null || this.ctx.state === "running");
    }

    // next 16th-note on the grid (or 8th for slow, low events)
    grid(div = 4) {
      const step = 60 / this.bpm / div;
      const now = this.now() + 0.015;
      const k = Math.ceil((now - this.t0) / step);
      return { when: this.t0 + k * step, slot: `${div}:${k}` };
    }

    pan(x, vw) {
      return clamp((x / Math.max(1, vw)) * 1.6 - 0.8, -0.8, 0.8);
    }

    bus(when, pan, send) {
      const g = this.ctx.createGain();
      const p = this.ctx.createStereoPanner();
      p.pan.setValueAtTime(pan, when);
      g.connect(p);
      p.connect(this.master);
      if (send) {
        const s = this.ctx.createGain();
        s.gain.value = send;
        p.connect(s);
        s.connect(this.verb);
      }
      return g;
    }

    // Glass piano: a few sine partials (one inharmonic, for the glass) with a
    // soft felt-hammer tick, long exponential ring.
    piano(midi, when, vel, pan, ring = 2.4) {
      const now = this.now();
      this.ends = this.ends.filter((e) => e > now);
      if (this.ends.length >= 28) return;
      const ctx = this.ctx;
      const f = mtof(midi);
      const v = this.bus(when, pan, 0.85);
      v.gain.value = 0.3 * vel;
      const hi = f > 900;
      const parts = [
        [1, 1, 1],
        [2, 0.38, 0.55],
        [3, 0.12, 0.32],
        [2.756, 0.16, 0.42],
        [5.4, 0.05, 0.16],
      ];
      let last = null;
      for (const [r, a, d] of parts) {
        if (f * r > 15000) continue;
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f * r * (1 + (Math.random() - 0.5) * 0.002);
        const g = ctx.createGain();
        const dec = ring * d * (hi ? 0.65 : 1);
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(a, when + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0006, when + dec);
        o.connect(g);
        g.connect(v);
        o.start(when);
        o.stop(when + dec + 0.05);
        last = o;
      }
      this.hammer(when, v, f, 0.5);
      this.ends.push(when + ring * (hi ? 0.65 : 1));
      if (last) last.onended = () => v.disconnect();
    }

    hammer(when, dest, f, amt) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = Math.min(9000, f * 4 + 1200);
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.25 * amt, when + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0005, when + 0.03);
      src.connect(bp);
      bp.connect(g);
      g.connect(dest);
      src.start(when, Math.random());
      src.stop(when + 0.05);
    }

    // short filtered-noise ticks: typing and clicks
    tick(when, pan, freq, q, vel, len) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = freq;
      bp.Q.value = q;
      const g = this.bus(when, pan, 0.06);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vel, when + 0.0008);
      g.gain.exponentialRampToValueAtTime(0.0004, when + len);
      src.connect(bp);
      bp.connect(g);
      src.start(when, Math.random() * 1.2);
      src.stop(when + len + 0.02);
      src.onended = () => g.disconnect();
    }

    // ---- events (screen coords in; all plain numbers so a log can be replayed)

    // one mechanical key: a sharp click on top of a short "thock" (deeper for space)
    clack(when, pan, space, vel = 1) {
      this.tick(when, pan, rand(3600, 5600), 2.2, rand(0.2, 0.3) * vel, rand(0.006, 0.011));
      this.tick(when + rand(0.001, 0.005), pan, space ? rand(380, 560) : rand(850, 1500), 1.6, (space ? 0.26 : rand(0.13, 0.2)) * vel, space ? 0.065 : rand(0.025, 0.042));
    }

    key(x, vw, id, n = 1, space = 0) {
      this.log("key", [x, vw, id, n, space]);
      if (!this.ready()) return;
      const t = this.now();
      if (t - (this.lastKey.get(id) || -1) < 0.024) return;
      this.keyTimes = this.keyTimes.filter((k) => t - k < 1);
      if (this.keyTimes.length > 80) return;
      this.lastKey.set(id, t);
      const pan = this.pan(x, vw);
      // a burst of characters in one frame becomes a quick roll of keys
      let at = t + 0.004;
      for (let k = 0; k < Math.min(n, 3) && this.keyTimes.length <= 80; k++) {
        this.keyTimes.push(t);
        this.clack(at, pan, space && k === 0, rand(0.75, 1));
        at += rand(0.018, 0.032);
      }
    }

    // a mouse button: press click, then a lighter release
    press(x, vw) {
      this.log("press", [x, vw]);
      if (!this.ready()) return;
      const t = this.now();
      this.pressTimes = this.pressTimes.filter((k) => t - k < 1);
      if (this.pressTimes.length > 40) return;
      this.pressTimes.push(t);
      const pan = this.pan(x, vw);
      this.tick(t + 0.004, pan, rand(2100, 2700), 4, 0.32, 0.012);
      this.tick(t + 0.005, pan, rand(650, 850), 2, 0.16, 0.022);
      this.tick(t + rand(0.055, 0.075), pan, rand(2900, 3400), 4, 0.15, 0.008);
    }

    // a finished element: rect, image, text, line, dup, guide, edit, restyle
    place(kind, x, y, w, h, vw, vh, fs) {
      this.log("place", [kind, x, y, w, h, vw, vh, fs]);
      if (!this.ready()) return;
      // only boxes, media, duplicates and guides sing; text and lines stay percussive
      if (kind === "text" || kind === "edit" || kind === "line") return;
      const area = (w * h) / Math.max(1, vw * vh);
      let oct;
      if (kind === "text") oct = fs >= 40 ? 2 : fs >= 22 ? 3 : 4;
      else if (kind === "guide") oct = 5;
      else oct = area > 0.08 ? 1 : area > 0.015 ? 2 : area > 0.002 ? 3 : 4;
      const deg = Math.floor(clamp(x / Math.max(1, vw), 0, 0.999) * 5);
      const midi = E2 + oct * 12 + PENTA[deg];
      const { when, slot } = this.grid(2);
      const seen = this.slots.get(slot) || [];
      if (seen.length >= 1) return;
      seen.push(midi);
      this.slots.set(slot, seen);
      if (this.slots.size > 64) this.slots.delete(this.slots.keys().next().value);
      const off = y < -40 || y > vh + 40 ? 0.45 : 1;
      const pan = this.pan(x, vw);
      const vel = ({ rect: 0.55, image: 0.5, dup: 0.5, guide: 0.3, restyle: 0.34 }[kind] || 0.4) * 0.42;
      const ring = oct <= 1 ? 3.6 : oct >= 4 ? 1.6 : 2.4;
      this.piano(midi, when, vel * off, pan, ring);
      if (kind === "image") this.piano(midi + (PENTA[(deg + 2) % 5] - PENTA[deg] + 12) % 12, when + 0.04, vel * 0.6 * off, pan, ring);
      if (kind === "dup") this.piano(E2 + 12 + (deg % 2 ? 7 : 0), when, 0.15 * off, pan * 0.5, 2.8);
    }

    // headings stepping up in size: a little rising run
    grow(step, x, vw) {
      this.log("grow", [step, x, vw]);
      if (!this.ready()) return;
      const t = this.now() + 0.004;
      this.tick(t, this.pan(x, vw), 2400 + step * 260, 5, 0.12, 0.01);
    }

    snap(x, vw) {
      this.log("snap", [x, vw]);
      if (!this.ready()) return;
      const t = this.now() + 0.004;
      const pan = this.pan(x, vw);
      this.tick(t, pan, 4800, 3, 0.36, 0.012);
      this.tick(t + 0.002, pan, 1200, 2, 0.2, 0.03);
    }

    // the page dissolving: an airy swell over a low open fifth
    intro() {
      this.log("intro", []);
      if (!this.ready()) return;
      const ctx = this.ctx;
      const t = this.now() + 0.02;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(260, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + 0.9);
      bp.frequency.exponentialRampToValueAtTime(900, t + 1.8);
      const g = this.bus(t, 0, 0.6);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 2.2);
      src.connect(bp);
      bp.connect(g);
      src.start(t);
      src.stop(t + 2.3);
      src.onended = () => g.disconnect();
      for (const [m, d] of [[E2, 0], [E2 + 7, 0.08], [E2 + 12, 0.16]]) this.pad(m, t + 0.3 + d, 0.07, 2.6);
    }

    pad(midi, when, vel, len) {
      const ctx = this.ctx;
      const g = this.bus(when, 0, 0.9);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vel, when + len * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0005, when + len);
      for (const det of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = mtof(midi);
        o.detune.value = det;
        o.connect(g);
        o.start(when);
        o.stop(when + len + 0.05);
      }
    }

    // the swarm fans out: E G# B E arpeggio on the grid
    start() {
      this.log("start", []);
      if (!this.ready()) return;
      const { when } = this.grid(4);
      const step = 60 / this.bpm / 4;
      [E2 + 24, E2 + 28, E2 + 31, E2 + 36, E2 + 40].forEach((m, i) => this.piano(m, when + i * step, 0.2, -0.5 + i * 0.25, 2));
    }

    // the last chord rings: E major add9, strummed
    finale() {
      this.log("finale", []);
      if (!this.ready()) return;
      const { when } = this.grid(2);
      const chord = [E2, E2 + 7, E2 + 12, E2 + 16, E2 + 19, E2 + 26, E2 + 28, E2 + 31, E2 + 36, E2 + 43];
      chord.forEach((m, i) => this.piano(m, when + i * 0.035, 0.34 - i * 0.015, -0.6 + (i / chord.length) * 1.2, 5.5));
      this.pad(E2 + 12, when, 0.05, 5);
    }

    // back to the real page: a falling sweep
    release() {
      this.log("release", []);
      if (!this.ready()) return;
      const ctx = this.ctx;
      const t = this.now() + 0.01;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1;
      bp.frequency.setValueAtTime(3000, t);
      bp.frequency.exponentialRampToValueAtTime(220, t + 1);
      const g = this.bus(t, 0, 0.5);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 1.1);
      src.connect(bp);
      bp.connect(g);
      src.start(t);
      src.stop(t + 1.2);
      this.piano(E2 + 12, t + 0.05, 0.3, 0, 2.5);
    }

    close(after = 0) {
      if (!this.ctx || this.fakeNow != null) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(this.out.gain.value, t);
      this.out.gain.linearRampToValueAtTime(0, t + Math.max(0.05, after));
      setTimeout(() => ctx.close().catch(() => {}), (after + 0.2) * 1000);
    }
  }

  // -------------------------------------------------------------------- app

  class App {
    constructor() {
      this.dead = false;
      this.t0 = performance.now();
      this.tour = false;
      this.tourV = 0;
      this.tourAcc = 0;
      this.speeds = [1, 2, 3];
      this.speedIx = 0;
      this.complete = false;
      this.timing = {};
    }

    async loadShot() {
      let src = window.__swarmShot;
      window.__swarmShot = null;
      if (src) lastShot = { src, at: this.env.geom() };
      else if (lastShot) src = lastShot.src; // Replay reuses the click-time screenshot
      if (!src) return null;
      const img = new Image();
      img.src = src;
      try {
        await img.decode();
      } catch (_) {
        return null;
      }
      const g = lastShot && lastShot.src === src ? lastShot.at : this.env.geom();
      return { img, sx: g.sx, sy: g.sy, scale: img.naturalWidth / innerWidth, valid: false };
    }

    async run() {
      this.env = detectEnv();
      const shotP = this.loadShot();
      this.view = new View(this.env);
      this.engine = new Engine(this.view);
      this.sfx = new Sound();
      this.sfx.init();
      this.engine.sfx = this.sfx;
      this.engine.onStart = () => this.view.intro.classList.add("gone");
      this.engine.onComplete = () => this.onComplete();
      this.bind();
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.frame(t));
      await nextFrame();
      this.renderSoundBtn();
      this.sfx.intro();
      this.view.bg.classList.add("on");
      this.view.intro.classList.add("on");
      this.view.hud.classList.add("on");
      const mark = (k) => (this.timing[k] = Math.round(performance.now() - this.t0));
      await sleep(520);
      await unhidePage();
      mark("blank");
      if (this.dead) return;
      await this.scan();
      mark("scan");
      if (this.dead) return;
      try {
        await Promise.race([document.fonts.ready, sleep(1200)]);
      } catch (_) {}
      mark("fonts");
      this.view.measure();
      const shot = await shotP;
      if (shot) {
        const g = this.env.geom();
        shot.valid = Math.abs(g.sx - shot.sx) < 1 && Math.abs(g.sy - shot.sy) < 1;
      }
      let model;
      try {
        model = captureModel(this.env, shot);
      } catch (err) {
        console.error("[swarm-rebuild] capture failed", err);
        model = { items: [], tasks: [], groups: [], guides: [], docW: 0, docH: 0 };
      }
      mark("capture");
      if (this.dead) return;
      this.view.mount(model);
      this.engine.setModel(model);
      this.model = model;
      mark("mount");
      const wait = 1500 - (performance.now() - this.t0);
      if (wait > 0) await sleep(wait);
      if (this.dead) return;
      this.engine.start();
    }

    async scan() {
      const env = this.env;
      const g = env.geom();
      const H = env.scrollHeight();
      if (H <= g.vh * 1.25) return;
      this.view.frozen = { ...this.view.vp };
      const steps = Math.min(28, Math.ceil(H / (g.vh * 0.85)));
      for (let i = 1; i <= steps && !this.dead; i++) {
        env.scrollTo(Math.min(H, (H / steps) * i));
        await nextFrame();
        await sleep(30);
      }
      env.scrollTo(g.sy, g.sx);
      await nextFrame();
      await sleep(750);
      env.scrollTo(g.sy, g.sx);
      this.view.frozen = null;
    }

    bind() {
      const on = (t, ev, fn, o) => {
        t.addEventListener(ev, fn, o);
        (this.unbinds || (this.unbinds = [])).push(() => t.removeEventListener(ev, fn, o));
      };
      const scrollTarget = this.env.isRoot ? window : this.env.scroller;
      on(scrollTarget, "scroll", () => {
        if (!this.view.frozen) this.view.syncWorld();
      }, { passive: true });
      on(window, "resize", () => this.view.measure());
      on(window, "wheel", () => {
        if (this.engine.ready) this.engine.start();
      }, { passive: true });
      on(window, "pointermove", (e) => {
        this.engine.mouse = { x: e.clientX, y: e.clientY };
      }, { passive: true });
      on(document.documentElement, "pointerleave", () => {
        this.engine.mouse = null;
      });
      on(window, "keydown", (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          stop(false);
        } else if ((e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey && !e.altKey) {
          this.sfx.setOn(!this.sfx.on);
          this.renderSoundBtn();
        }
        this.unlockSound();
      }, true);
      // browsers only let audio start after a click/keypress on the page
      on(window, "pointerdown", () => this.unlockSound(), true);
      if (!this.env.isRoot) {
        on(this.view.host, "wheel", (e) => {
          e.preventDefault();
          this.env.scroller.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: "instant" });
        }, { passive: false });
      }
      on(this.view.hud, "click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        const a = b.dataset.a;
        if (a === "close") stop(false);
        else if (a === "live") stop(true);
        else if (a === "replay") restart();
        else if (a === "tour") {
          this.tour = !this.tour;
          b.classList.toggle("on", this.tour);
          b.textContent = this.tour ? "Touring" : "Tour";
          if (this.tour) this.engine.start();
        } else if (a === "sound") {
          if (this.sfx.on && this.sfx.blocked) this.sfx.resume();
          else this.sfx.setOn(!this.sfx.on);
          setTimeout(() => this.renderSoundBtn(), 60);
        } else if (a === "speed") {
          this.speedIx = (this.speedIx + 1) % this.speeds.length;
          this.engine.speed = this.speeds[this.speedIx];
          b.textContent = this.speeds[this.speedIx] + "×";
        }
      });
    }

    unlockSound() {
      if (this.dead || !this.sfx || !this.sfx.blocked) return;
      this.sfx.resume();
      setTimeout(() => this.renderSoundBtn(), 80);
    }

    renderSoundBtn() {
      const b = this.view.root.querySelector('[data-a="sound"]');
      if (!b || !this.sfx) return;
      const tap = this.sfx.on && this.sfx.blocked;
      const key = this.sfx.on ? (tap ? "tap" : "on") : "off";
      if (b._k === key) return;
      b._k = key;
      b.classList.toggle("off", key === "off");
      b.classList.toggle("tap", tap);
      const waves = '<path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.6a6 6 0 0 1 0 8.8"/>';
      const mute = '<path d="M11 6l4 4M15 6l-4 4"/>';
      b.innerHTML = `${SPK_ICON}${key === "off" ? mute : waves}</svg>${tap ? "<span>Tap for sound</span>" : ""}`;
      b.title = key === "off" ? "Sound off (M)" : "Sound on (M)";
    }

    frame(now) {
      if (this.dead) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      try {
        this.engine.step(dt);
        if (this.tour) this.tourStep(dt);
        this.view.render(this.engine);
        if (!this._hudT || now - this._hudT > 200) {
          this._hudT = now;
          this.updateHud();
          this.renderSoundBtn();
        }
      } catch (err) {
        console.error("[swarm-rebuild]", err);
      }
      this.raf = requestAnimationFrame((t) => this.frame(t));
    }

    tourStep(dt) {
      const E = this.engine;
      if (!E.started) return;
      const g = this.env.geom();
      const maxY = this.env.scrollHeight() - g.vh;
      if (g.sy >= maxY - 1) {
        this.tourV = 0;
        return;
      }
      const crew = Math.max(MIN_AGENTS, E.cursors.filter((c) => !c.leaving).length);
      const backlog = E.backlog();
      const target = backlog <= Math.max(4, crew * 0.6) ? 230 : backlog <= crew * 1.5 ? 80 : 0;
      this.tourV += (target - this.tourV) * Math.min(1, dt * 2.5);
      this.tourAcc += this.tourV * dt;
      if (this.tourAcc >= 1) {
        const d = Math.floor(this.tourAcc);
        this.tourAcc -= d;
        this.env.scrollBy(d);
      }
    }

    updateHud() {
      const E = this.engine;
      const v = this.view;
      if (!E.ready) return;
      const workers = E.cursors.filter((c) => c.worked).length + E.retired;
      const total = E.tasks.length;
      const done = E.doneCount;
      if (this.complete) return;
      if (!E.started) v.status.innerHTML = `<b>${E.cursors.length}</b> agents ready<span class="sep"></span>${total.toLocaleString()} layers`;
      else {
        const pend = E.tasks.length - done;
        const below = E.tasks.some((t) => t.state === "wait" && t.layer === "world" && t.gate > E.frontier);
        v.status.innerHTML =
          `<b>${workers}</b> agents<span class="sep"></span><b>${done.toLocaleString()}</b> / ${total.toLocaleString()} layers` +
          (below && pend && !this.tour && E.backlog() === 0 ? `<span class="sep"></span>scroll to keep building` : "");
      }
      v.barFill.style.width = total ? `${(done / total) * 100}%` : "0%";
      const busy = E.cursors.filter((c) => c.task).slice(-5);
      const key = busy.map((c) => c.id).join(",");
      if (key !== this._dots) {
        this._dots = key;
        v.dots.innerHTML = busy.map((c) => `<i style="background:${c.color}" title="${c.name}">${c.name[0]}</i>`).join("");
      }
    }

    onComplete() {
      this.complete = true;
      if (this.sfx) this.sfx.finale();
      const E = this.engine;
      const v = this.view;
      const workers = E.cursors.filter((c) => c.worked).length + E.retired;
      const secs = (E.endTime - E.startTime).toFixed(1);
      v.status.innerHTML = `Rebuilt by <b>${workers}</b> agents in <b>${secs}s</b>`;
      v.barFill.style.width = "100%";
      v.dots.innerHTML = "";
      v.root.querySelector('[data-a="live"]').hidden = false;
      v.root.querySelector('[data-a="replay"]').hidden = false;
      v.root.querySelector('[data-a="tour"]').hidden = true;
      v.root.querySelector('[data-a="speed"]').hidden = true;
      this.tour = false;
    }

    destroy(reveal) {
      unhidePage();
      if (this.sfx) {
        if (reveal) this.sfx.release();
        this.sfx.close(reveal ? 1.4 : 0.25);
      }
      const finish = () => {
        this.dead = true;
        cancelAnimationFrame(this.raf);
        for (const u of this.unbinds || []) u();
        this.view.host.remove();
      };
      if (reveal) {
        this.engine.releasing = true;
        this.engine.flocking = true;
        for (const c of this.engine.cursors) {
          c.gen = null;
          c.follow = false;
        }
        this.view.hud.classList.remove("on");
        setTimeout(() => {
          this.view.host.style.setProperty("opacity", "0", "important");
        }, 450);
        setTimeout(finish, 1150);
      } else {
        this.view.host.style.setProperty("transition", "opacity .25s ease", "important");
        this.view.host.style.setProperty("opacity", "0", "important");
        this.dead = true;
        cancelAnimationFrame(this.raf);
        for (const u of this.unbinds || []) u();
        setTimeout(() => this.view.host.remove(), 260);
      }
    }
  }

  // background.js may have hidden everything but media for its screenshot;
  // put the page back once our canvas covers it (or if we bail out early).
  async function unhidePage() {
    if (!window.__swarmHidden) return;
    window.__swarmHidden = false;
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) await chrome.runtime.sendMessage({ type: "swarm:unhide" });
    } catch (_) {}
    if (typeof window.__swarmUnhide === "function") {
      try {
        window.__swarmUnhide();
      } catch (_) {}
    }
    await nextFrame();
  }

  let app = null;
  let lastShot = null;

  function start() {
    if (app) return;
    app = new App();
    app.run().catch((err) => console.error("[swarm-rebuild]", err));
  }

  function stop(reveal) {
    if (!app) return;
    const a = app;
    app = null;
    a.destroy(reveal);
  }

  function restart() {
    if (app) {
      const a = app;
      app = null;
      a.dead = true;
      cancelAnimationFrame(a.raf);
      for (const u of a.unbinds || []) u();
      a.view.host.remove();
      if (a.sfx) a.sfx.close(0.1);
      // rebuild from where the first run started so screenshot crops line up again
      if (lastShot) a.env.scrollTo(lastShot.at.sy, lastShot.at.sx);
    }
    start();
  }

  window[KEY] = {
    toggle() {
      if (app) stop(false);
      else start();
    },
    start,
    stop,
    get app() {
      return app;
    },
    debug: { captureModel, detectEnv, Sound },
  };
  start();
})();
