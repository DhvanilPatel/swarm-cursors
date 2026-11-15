import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Evaluate the real dependency-free content script without starting its UI.
// This changes only the test copy; the extension exposes no extra test globals.
const source = fs.readFileSync(new URL("../swarm-rebuild/swarm.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const instrumented = source.replace(/\n  start\(\);\n\}\)\(\);\s*$/, "\n  window.__swarmTest = { Engine, App };\n})();");
assert.ok(instrumented !== source, "test harness must replace the startup call");
const context = { window: {}, document: {}, console };
vm.runInNewContext(instrumented, context);
const { Engine, App } = context.window.__swarmTest;
function fixture(tasks, sy = 0, vh = 800, height = 3000) {
  const engine = Object.assign(Object.create(Engine.prototype), { tasks, frontier: sy + vh, started: true, cursors: [] });
  const geometry = { sy, vh };
  const app = Object.assign(Object.create(App.prototype), {
    engine, tourV: 0, tourAcc: 0,
    env: { geom: () => geometry, scrollHeight: () => height, scrollBy: (dy) => { geometry.sy += dy; } },
  });
  return { app, engine, geometry };
}
const task = (y, extra = {}) => ({ layer: "world", state: "active", y, gate: y, deps: [], ...extra });

test("Tour keeps an unfinished heading visible even with only one task left", () => {
  const heading = task(20);
  const { app, geometry } = fixture([heading]);
  app.tourV = 230; app.tourAcc = .9;
  for (let i = 0; i < 30; i++) app.tourStep(.05);
  assert.equal(geometry.sy, 0);
  assert.equal(app.tourV, 0);
  assert.equal(app.tourAcc, 0);
  heading.state = "done";
  for (let i = 0; i < 30; i++) app.tourStep(.05);
  assert.ok(geometry.sy > 0, "Tour resumes when the heading finishes");
});

test("inertia and fractional accumulation cannot cross the unfinished task", () => {
  const { app, geometry } = fixture([task(180)]);
  app.tourV = 2000; app.tourAcc = 200;
  for (let i = 0; i < 20; i++) app.tourStep(.05);
  assert.ok(geometry.sy <= 132);
});

test("ready waiting work is retained, but blocked and offscreen work cannot deadlock Tour", () => {
  const ready = task(10, { state: "wait" });
  const { engine } = fixture([ready]);
  assert.equal(engine.tourCeiling(0, 800, 2200), 0);
  ready.deps = [{ state: "wait" }];
  assert.equal(engine.tourCeiling(0, 800, 2200), 2200);
  ready.deps = []; ready.gate = 900;
  assert.equal(engine.tourCeiling(0, 800, 2200), 2200);
  ready.gate = 10; ready.y = 801;
  assert.equal(engine.tourCeiling(0, 800, 2200), 2200);
});

test("fixed UI does not hold the document scroll and the bottom clears inertia", () => {
  const { app, engine, geometry } = fixture([task(0, { layer: "fixed" })], 2200);
  assert.equal(engine.tourCeiling(2200, 800, 2200), 2200);
  app.tourV = 100; app.tourAcc = .8; app.tourStep(.05);
  assert.equal(geometry.sy, 2200); assert.equal(app.tourV, 0); assert.equal(app.tourAcc, 0);
});

test("the guard uses an inner scroller's coordinates after manual scrolling", () => {
  const { engine } = fixture([task(540)], 500, 600, 2400);
  assert.equal(engine.tourCeiling(500, 600, 1800), 500);
  engine.tasks[0].state = "done";
  assert.equal(engine.tourCeiling(500, 600, 1800), 1800);
});
