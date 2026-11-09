# API reference

## `createSwarm(options?)`

Creates a `Swarm` controller without accessing `window` or `document`. Browser work begins only when `start()` is called.

## `Swarm`

- `start(): this` captures the selected target and begins autoplay after preparation, unless `animation.autoplay` is `false`.
- `pause(): this` freezes engine updates; `resume(): this` resumes them.
- `stop(): this` removes the overlay and exposes the original page.
- `replay(): this` captures the target again and starts a fresh run.
- `destroy(): void` stops and permanently disposes this controller and its listeners.
- `setSpeed(speed: number): this` applies an animation multiplier (greater than 0 through 5).
- `setCursorCount(count: number): this` changes the preferred agent count, bounded by configured min/max.
- `setBackground(background: string): this` updates the overlay background.
- `setOptions(options: SwarmOptions): this` validates and merges runtime options.
- `on(event, listener): () => void` subscribes and returns an unsubscribe function.
- `off(event, listener): void` removes a listener.
- `state` reports `created`, `starting`, `ready`, `running`, `paused`, `complete`, `stopped`, or `destroyed`.

## Events

`ready` reports `{ itemCount, taskCount }`. `start`, `pause`, and `resume` carry empty objects. `progress` reports `{ completed, total, progress, workers }`. `complete` reports `{ completed, total, duration }`. `stop` reports completed and total task counts. `error` reports an `Error`; `warning` reports recoverable media-capture failures.

```ts
const off = swarm.on("progress", ({ progress }) => {
  progressElement.textContent = `${Math.round(progress * 100)}%`;
});

off();
// Or: swarm.off("progress", listener)
```

## React and Next.js

The `swarm-cursors/react` and `swarm-cursors/next` entry points export `SwarmProvider`, `SwarmRebuild`, `useSwarm`, and `useSwarmEvents`. They initialize in effects and destroy their controller on unmount. The Next entry is marked `"use client"`; it performs no browser-global access at import time and is safe to include in App Router client components.
