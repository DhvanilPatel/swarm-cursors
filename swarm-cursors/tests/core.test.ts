import { describe, expect, it, vi } from "vitest";
import { createSwarm } from "../packages/core/src";

describe("createSwarm", () => {
  it("creates an instance without touching browser globals", () => {
    const swarm = createSwarm();

    expect(swarm.state).toBe("created");
    swarm.destroy();
    expect(swarm.state).toBe("destroyed");
  });

  it("validates the initial cursor range", () => {
    expect(() => createSwarm({ cursors: { minCount: 20, maxCount: 10 } })).toThrow(
      "cursors.minCount must not exceed cursors.maxCount",
    );
  });

  it("validates runtime option updates before applying them", () => {
    const swarm = createSwarm();

    expect(() => swarm.setOptions({ animation: { speed: 0 } })).toThrow(
      "animation.speed must be greater than 0 and at most 5",
    );
    expect(swarm.setSpeed(2).state).toBe("created");
    expect(swarm.setCursorCount(24).state).toBe("created");
    swarm.destroy();
  });

  it("supports typed listeners and unsubscribe", () => {
    const swarm = createSwarm();
    const ready = vi.fn();
    const unsubscribe = swarm.on("ready", ready);

    unsubscribe();
    swarm.off("ready", ready);
    swarm.destroy();

    expect(ready).not.toHaveBeenCalled();
  });

  it("allows listener removal by the returned disposer", () => {
    const swarm = createSwarm();
    const handler = vi.fn();
    const unsubscribe = swarm.on("progress", handler);
    unsubscribe();

    expect(handler).not.toHaveBeenCalled();
    swarm.destroy();
  });

  it("rejects controls after destruction", () => {
    const swarm = createSwarm();
    swarm.destroy();

    expect(() => swarm.start()).toThrow("This Swarm instance has been destroyed");
    expect(() => swarm.setSpeed(1)).toThrow("This Swarm instance has been destroyed");
  });
});
