import { EventEmitter } from "./events/emitter";
import { createSwarmRuntime, type SwarmRuntime } from "./engine/swarm-runtime";
import type { SwarmEventMap, SwarmEventName, SwarmListener } from "./types/events";
import type { ResolvedSwarmOptions, SwarmOptions } from "./types/options";
import { resolveOptions } from "./utils/options";

export type {
  AnimationOptions,
  AppearanceOptions,
  AudioOptions,
  BehaviorOptions,
  CursorOptions,
  InteractionOptions,
  MediaOptions,
  PerformanceOptions,
  ReconstructionOptions,
  ResolvedSwarmOptions,
  SwarmOptions,
  SwarmTarget,
} from "./types/options";
export type { SwarmCompletion, SwarmEventMap, SwarmEventName, SwarmListener, SwarmProgress, SwarmReady, SwarmWarning } from "./types/events";

export type SwarmState = "created" | "starting" | "ready" | "running" | "paused" | "complete" | "stopped" | "destroyed";

export class Swarm {
  private readonly events = new EventEmitter();
  private readonly runtime: SwarmRuntime;
  private readonly options: ResolvedSwarmOptions;
  private currentState: SwarmState = "created";

  constructor(options: SwarmOptions = {}) {
    this.options = resolveOptions(options);
    this.runtime = createSwarmRuntime(this.options, (name, event) => {
      this.handleRuntimeEvent(name, event);
    });
  }

  get state(): SwarmState {
    return this.currentState;
  }

  start(): this {
    this.assertAlive();
    if (this.currentState === "paused") return this.resume();
    if (this.currentState === "running" || this.currentState === "complete") return this;
    this.currentState = "starting";
    this.runtime.start();
    return this;
  }

  pause(): this {
    this.assertAlive();
    this.runtime.pause();
    return this;
  }

  resume(): this {
    this.assertAlive();
    this.runtime.resume();
    return this;
  }

  stop(): this {
    if (this.currentState === "destroyed") return this;
    this.runtime.stop();
    this.currentState = "stopped";
    return this;
  }

  replay(): this {
    this.assertAlive();
    this.currentState = "starting";
    this.runtime.replay();
    return this;
  }

  destroy(): void {
    if (this.currentState === "destroyed") return;
    this.runtime.stop();
    this.currentState = "destroyed";
    this.events.clear();
  }

  setSpeed(speed: number): this {
    this.assertAlive();
    const next = resolveOptions({ animation: { speed } }, this.options);
    this.options.animation.speed = next.animation.speed;
    this.runtime.setSpeed(speed);
    return this;
  }

  setCursorCount(count: number): this {
    this.assertAlive();
    const next = resolveOptions({ cursors: { count } }, this.options);
    this.options.cursors.count = next.cursors.count;
    this.runtime.setCursorCount(count);
    return this;
  }

  setBackground(background: string): this {
    this.assertAlive();
    if (!background.trim()) throw new TypeError("background must be a non-empty CSS color or background value");
    const next = resolveOptions({ appearance: { background } }, this.options);
    this.options.appearance.background = next.appearance.background;
    this.options.appearance.backgroundGradient = undefined;
    this.runtime.setBackground(background);
    return this;
  }

  setOptions(options: SwarmOptions): this {
    this.assertAlive();
    const next = resolveOptions(options, this.options);
    Object.assign(this.options, next);
    this.runtime.configure();
    return this;
  }

  on<T extends SwarmEventName>(name: T, listener: SwarmListener<T>): () => void {
    this.assertAlive();
    return this.events.on(name, listener);
  }

  off<T extends SwarmEventName>(name: T, listener: SwarmListener<T>): void {
    this.events.off(name, listener);
  }

  private handleRuntimeEvent<T extends SwarmEventName>(name: T, event: SwarmEventMap[T]): void {
    if (name === "ready") this.currentState = "ready";
    else if (name === "start") this.currentState = "running";
    else if (name === "pause") this.currentState = "paused";
    else if (name === "resume") this.currentState = "running";
    else if (name === "complete") this.currentState = "complete";
    else if (name === "stop") this.currentState = "stopped";
    else if (name === "error") this.currentState = "stopped";
    this.events.emit(name, event);
  }

  private assertAlive(): void {
    if (this.currentState === "destroyed") {
      throw new Error("This Swarm instance has been destroyed");
    }
  }
}

export function createSwarm(options: SwarmOptions = {}): Swarm {
  return new Swarm(options);
}
