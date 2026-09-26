import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/*.test.ts"],
    globalSetup: ["tests/helpers/prepare-fixture.ts"],
    // Fixture runs share the fixture's Nuxt build directory.
    fileParallelism: false,
    testTimeout: 180_000,
  },
})
