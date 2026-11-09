# swarm-cursors

Browser library for rebuilding a live DOM with the migrated Swarm Cursors engine.

```ts
import { createSwarm } from "swarm-cursors";

const swarm = createSwarm({
  target: document.body,
  cursors: { count: 24 },
  audio: { enabled: false },
});

swarm.on("progress", ({ progress }) => console.log(progress));
swarm.start();
```

The package exports ESM, CommonJS, TypeScript declarations, and optional `./react` and `./next` client adapters. See the project documentation for the full [configuration reference](https://github.com/nurmandev/swarm-cursors/tree/main/swarm-cursors/docs/configuration.md), [API reference](https://github.com/nurmandev/swarm-cursors/tree/main/swarm-cursors/docs/api.md), and media limitations.

**UNLICENSED:** source and upstream derivative rights are unresolved. Do not redistribute or publish until cleared with the relevant rights holders.
