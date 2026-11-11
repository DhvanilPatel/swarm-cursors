import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    environmentOptions: {
      jsdom: { pretendToBeVisual: true, url: "http://localhost/" },
    },
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
