import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreDist = resolve(root, "packages/core/dist");
const reactDist = resolve(root, "packages/react/dist");
const nextDist = resolve(root, "packages/next/dist");

await mkdir(coreDist, { recursive: true });
for (const extension of ["js", "cjs", "js.map", "cjs.map"]) {
  await cp(resolve(reactDist, `index.${extension}`), resolve(coreDist, `react.${extension}`));
  await cp(resolve(nextDist, `index.${extension}`), resolve(coreDist, `next.${extension}`));
}
await cp(resolve(reactDist, "types/index.d.ts"), resolve(coreDist, "react.d.ts"));
await cp(resolve(reactDist, "types/index.d.ts.map"), resolve(coreDist, "react.d.ts.map"));
await writeFile(
  resolve(coreDist, "next.d.ts"),
  'export { SwarmProvider, SwarmRebuild, useSwarm, useSwarmEvents } from "./react.js";\n' +
    'export type { SwarmProviderProps, SwarmRebuildProps, SwarmEventHandlers } from "./react.js";\n',
);
