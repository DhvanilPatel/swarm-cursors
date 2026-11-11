"use client";

import { SwarmRebuild } from "swarm-cursors/next";

export default function Home() {
  return (
    <main>
      <SwarmRebuild
        options={{
          cursors: { count: 32 },
          animation: { autoplay: true },
        }}
      />
      <h1>Next.js App Router</h1>
      <p>Browser initialization happens in a React effect after hydration.</p>
    </main>
  );
}
