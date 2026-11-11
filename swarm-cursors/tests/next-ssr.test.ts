import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SwarmRebuild } from "../packages/next/src";

describe("Next.js adapter", () => {
  it("can render a client adapter placeholder during server rendering", () => {
    const markup = renderToString(createElement(SwarmRebuild, null, createElement("h1", null, "Hydrated later")));

    expect(markup).toContain("Hydrated later");
  });
});
