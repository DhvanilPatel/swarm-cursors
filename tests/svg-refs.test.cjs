const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(path.join(__dirname, "../swarm-rebuild/swarm.js"), "utf8");
// Exercise the production clone code without starting the page overlay or agents.
const end = /  start\(\);\s*\}\)\(\);\s*$/;
assert.match(source, end);
const instrumented = source.replace(end, "  window.__svgTest = { cloneStyled };\n})();");

function withSvg(markup, check) {
  const dom = new JSDOM(markup, { runScripts: "outside-only" });
  try {
    dom.window.CSS = { escape: id => id.replace(/["\\]/g, "\\$&") };
    dom.window.eval(instrumented);
    const document = dom.window.document;
    const original = document.querySelector("svg[data-test]");
    const before = original.outerHTML;
    const clone = dom.window.__svgTest.cloneStyled(original);
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.append(clone);
    check({ document, original, clone, shadow });
    assert.equal(original.outerHTML, before, "capture must not mutate the source SVG");
  } finally {
    dom.window.close();
  }
}

function assertLocalPaintRefs(clone) {
  const refs = [...clone.outerHTML.matchAll(/url\(\s*["']?#([^"')\s]+)["']?\s*\)/g)];
  for (const [, id] of refs) {
    assert.ok(clone.querySelector(`[id="${id}"]`), `missing local paint reference #${id}`);
  }
}

test("a bicycle rebuilt in a shadow root retains both nested wheel instances", () => {
  withSvg(`
    <svg width="0" height="0"><defs>
      <linearGradient id="rim"><stop stop-color="#8b9d70"/></linearGradient>
      <symbol id="wheel" viewBox="0 0 280 280">
        <circle data-wheel="tire" cx="140" cy="140" r="128" fill="#111710"/>
        <circle cx="140" cy="140" r="111" fill="none" stroke="url(#rim)"/>
      </symbol>
      <symbol id="bicycle" viewBox="0 0 850 530">
        <use href="#wheel" x="42" y="228" width="277" height="277"/>
        <use href="#wheel" x="552" y="228" width="277" height="277"/>
        <path data-frame="true" d="M180 366 334 206 423 369Z"/>
      </symbol>
    </defs></svg>
    <svg data-test viewBox="0 0 850 650"><use href="#bicycle" y="62" width="850" height="530"/></svg>
  `, ({ clone }) => {
    assert.equal(clone.querySelectorAll("use").length, 0, "all symbol references must be expanded");
    assert.equal(clone.querySelectorAll('[data-wheel="tire"]').length, 2);
    const wheels = [...clone.querySelectorAll('svg[viewBox="0 0 280 280"]')];
    assert.deepEqual(wheels.map(el => el.getAttribute("x")), ["42", "552"]);
    wheels.forEach(el => {
      assert.equal(el.getAttribute("y"), "228");
      assert.equal(el.getAttribute("width"), "277");
      assert.equal(el.getAttribute("height"), "277");
    });
    assert.ok(clone.querySelector("[data-frame]"));
    assertLocalPaintRefs(clone);
  });
});

test("references expand beyond two levels and keep repeated sibling instances", () => {
  withSvg(`
    <svg><defs>
      <symbol id="dot"><circle r="5"/></symbol>
      <symbol id="pair"><use href="#dot"/><use href="#dot"/></symbol>
      <symbol id="nested"><svg viewBox="0 0 20 20"><use href="#pair"/></svg></symbol>
      <symbol id="outer"><use href="#nested"/><use href="#nested"/></symbol>
    </defs></svg>
    <svg data-test><use href="#outer"/></svg>
  `, ({ clone }) => {
    assert.equal(clone.querySelectorAll("use").length, 0);
    assert.equal(clone.querySelectorAll("circle").length, 4);
  });
});

test("gradient aliases and their transitive dependencies are copied locally", () => {
  withSvg(`
    <svg xmlns:xlink="http://www.w3.org/1999/xlink"><defs>
      <linearGradient id="base"><stop stop-color="#d6f56b"/></linearGradient>
      <linearGradient id="middle" xlink:href="#base"/>
      <linearGradient id="paint" href="#middle"/>
    </defs></svg>
    <svg data-test><path fill="url(#paint)" d="M0 0h10v10z"/></svg>
  `, ({ clone }) => {
    for (const id of ["paint", "middle", "base"]) assert.ok(clone.querySelector(`[id="${id}"]`), id);
    assertLocalPaintRefs(clone);
  });
});

test("cyclic symbol references terminate without dropping valid siblings", () => {
  withSvg(`
    <svg><defs>
      <symbol id="loop"><circle r="8"/><use href="#loop"/></symbol>
    </defs></svg>
    <svg data-test><use href="#loop"/><use href="#loop"/></svg>
  `, ({ clone }) => {
    assert.equal(clone.querySelectorAll("use").length, 0);
    assert.equal(clone.querySelectorAll("circle").length, 2);
  });
});

test("cycles through a nested SVG also terminate", () => {
  withSvg(`
    <svg><defs>
      <symbol id="a"><circle r="3"/><svg><use href="#b"/></svg></symbol>
      <symbol id="b"><use href="#a"/></symbol>
    </defs></svg>
    <svg data-test><use href="#a"/></svg>
  `, ({ clone }) => {
    assert.equal(clone.querySelectorAll("use").length, 0);
    assert.equal(clone.querySelectorAll("circle").length, 1);
  });
});

test("cyclic gradient aliases are copied once rather than looping", () => {
  withSvg(`
    <svg><defs>
      <linearGradient id="left" href="#right"/>
      <linearGradient id="right" href="#left"/>
    </defs></svg>
    <svg data-test><path fill="url(#left)"/></svg>
  `, ({ clone }) => {
    assert.equal(clone.querySelectorAll('[id="left"]').length, 1);
    assert.equal(clone.querySelectorAll('[id="right"]').length, 1);
  });
});

test("legacy xlink references work and missing or external references remain intact", () => {
  withSvg(`
    <svg><defs><symbol id="icon"><path data-icon="true"/></symbol></defs></svg>
    <svg data-test xmlns:xlink="http://www.w3.org/1999/xlink">
      <use xlink:href="#icon"/>
      <use href="#not-present"/>
      <use href="other.svg#icon"/>
    </svg>
  `, ({ clone }) => {
    assert.ok(clone.querySelector("[data-icon]"));
    assert.equal(clone.querySelectorAll("use").length, 2);
    assert.ok(clone.querySelector('use[href="#not-present"]'));
    assert.ok(clone.querySelector('use[href="other.svg#icon"]'));
  });
});

test("ordinary SVGs without references keep their shapes", () => {
  withSvg('<svg data-test viewBox="0 0 40 40"><circle r="9"/><path d="M1 1h20"/></svg>', ({ clone }) => {
    assert.equal(clone.querySelectorAll("circle").length, 1);
    assert.equal(clone.querySelectorAll("path").length, 1);
    assert.equal(clone.querySelector("defs"), null);
  });
});

test("SVG navigation links do not copy their destination into the artwork", () => {
  withSvg('<section id="destination">Page content</section><svg data-test><a href="#destination"><circle r="9"/></a></svg>', ({ clone }) => {
    assert.ok(clone.querySelector('a[href="#destination"]'));
    assert.equal(clone.querySelector('[id="destination"]'), null);
    assert.equal(clone.querySelector("defs"), null);
  });
});

const website = path.join(__dirname, "../../aerovelo/index.html");
test("the recording website's actual bicycle has two complete wheels", { skip: !fs.existsSync(website) }, () => {
  const page = fs.readFileSync(website, "utf8").replace('class="hero-bike bike-svg"', 'data-test class="hero-bike bike-svg"');
  withSvg(page, ({ clone }) => {
    assert.equal(clone.querySelectorAll("use").length, 0);
    const wheels = clone.querySelectorAll('svg[viewBox="0 0 280 280"]');
    assert.equal(wheels.length, 2);
    wheels.forEach(wheel => assert.equal(wheel.querySelectorAll("circle").length, 6));
    assertLocalPaintRefs(clone);
  });
});
