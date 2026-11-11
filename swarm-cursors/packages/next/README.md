# @swarm-cursors/next

Optional Next.js App Router client bindings. This package re-exports the React integration and is marked `"use client"`.

```tsx
"use client";

import { SwarmRebuild } from "swarm-cursors/next";

export default function Page() {
  return <SwarmRebuild options={{ cursors: { count: 32 } }} />;
}
```

**UNLICENSED:** see the core package and repository documentation for unresolved licensing.
