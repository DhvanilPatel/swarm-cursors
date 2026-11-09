// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createSwarm } from "../packages/core/src";

const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
const originalRangeBounds = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");
let activeSwarm: ReturnType<typeof createSwarm> | null = null;

afterEach(() => {
  activeSwarm?.destroy();
  activeSwarm = null;
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  if (originalRangeBounds) Object.defineProperty(Range.prototype, "getBoundingClientRect", originalRangeBounds);
  else delete (Range.prototype as Partial<Range>).getBoundingClientRect;
  document.body.replaceChildren();
  document.querySelectorAll("swarm-rebuild").forEach((host) => host.remove());
});

describe("browser engine lifecycle", () => {
  it("captures a DOM blueprint, emits lifecycle events, and restores the original DOM", async () => {
    document.body.innerHTML = `
      <main>
        <section data-test-box style="background: rgb(220, 30, 50); padding: 12px">
          <h1>Captured heading</h1>
          <p>Original page text remains in the DOM.</p>
        </section>
      </main>`;

    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1024 });
    Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 768 });
    HTMLElement.prototype.getBoundingClientRect = function () {
      const bounds = this.hasAttribute("data-test-box")
        ? { left: 40, top: 40, width: 420, height: 300 }
        : this === document.body || this === document.documentElement
          ? { left: 0, top: 0, width: 1024, height: 768 }
          : { left: 50, top: 60, width: 260, height: 48 };
      return {
        ...bounds,
        x: bounds.left,
        y: bounds.top,
        right: bounds.left + bounds.width,
        bottom: bounds.top + bounds.height,
        toJSON: () => bounds,
      } as DOMRect;
    };
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 50,
        y: 60,
        left: 50,
        top: 60,
        right: 310,
        bottom: 108,
        width: 260,
        height: 48,
        toJSON: () => ({}),
      }),
    });

    const swarm = (activeSwarm = createSwarm({ animation: { autoplay: false, delay: 0 } }));
    const ready = new Promise<{ itemCount: number; taskCount: number }>((resolve, reject) => {
      swarm.on("ready", resolve);
      swarm.on("error", reject);
    });
    const started = new Promise<void>((resolve) => {
      swarm.on("start", resolve);
    });
    const progress = new Promise<{ completed: number; total: number }>((resolve) => {
      swarm.on("progress", resolve);
    });

    swarm.start();
    const captured = await ready;
    expect(captured.itemCount).toBeGreaterThan(0);
    expect(captured.taskCount).toBeGreaterThan(0);

    swarm.start();
    await started;
    expect((await progress).total).toBeGreaterThan(0);
    expect(swarm.state).toBe("running");
    swarm.pause();
    expect(swarm.state).toBe("paused");
    swarm.resume();
    expect(swarm.state).toBe("running");

    swarm.stop();
    expect(swarm.state).toBe("stopped");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(document.body.textContent).toContain("Original page text remains in the DOM.");
    expect(document.querySelector("swarm-rebuild")).toBeNull();
    swarm.destroy();
  });
});
