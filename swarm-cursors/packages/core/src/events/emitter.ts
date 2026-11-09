import type { SwarmEventMap, SwarmEventName, SwarmListener } from "../types/events";

export class EventEmitter {
  private readonly listeners = new Map<SwarmEventName, Set<(event: never) => void>>();

  on<T extends SwarmEventName>(name: T, listener: SwarmListener<T>): () => void {
    let listeners = this.listeners.get(name);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(name, listeners);
    }
    listeners.add(listener as (event: never) => void);
    return () => this.off(name, listener);
  }

  off<T extends SwarmEventName>(name: T, listener: SwarmListener<T>): void {
    const listeners = this.listeners.get(name);
    listeners?.delete(listener as (event: never) => void);
    if (listeners?.size === 0) this.listeners.delete(name);
  }

  emit<T extends SwarmEventName>(name: T, event: SwarmEventMap[T]): void {
    for (const listener of this.listeners.get(name) || []) {
      (listener as SwarmListener<T>)(event);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
