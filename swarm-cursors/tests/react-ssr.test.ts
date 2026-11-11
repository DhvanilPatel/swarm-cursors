import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SwarmRebuild } from "../packages/react/src";

describe("React adapter", () => {
  it("renders on the server without reading window or document", () => {
    const markup = renderToString(createElement(SwarmRebuild, null, createElement("main", null, "SSR safe")));

    expect(markup).toContain("SSR safe");
  });
});
