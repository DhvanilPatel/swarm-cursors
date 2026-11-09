import { SwarmRebuild } from "swarm-cursors/react";

export default function App() {
  return (
    <>
      <SwarmRebuild
        options={{
          cursors: { count: 24, colors: ["#ff4d4d", "#377dff", "#19c37d"] },
          audio: { enabled: false },
        }}
      />
      <main>
        <h1>React integration</h1>
        <p>The adapter initializes after mount and destroys its engine on unmount.</p>
      </main>
    </>
  );
}
