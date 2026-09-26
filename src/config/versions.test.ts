import { expect, it } from "vitest"

import { resolveStartupMode } from "./versions"

it("uses the adapter for 4.3.x", () => {
  expect(resolveStartupMode("4.3.0")).toBe("adapter")
  expect(resolveStartupMode("4.3.2")).toBe("adapter")
})

it("rejects untested versions", () => {
  for (const version of ["4.2.0", "4.4.0", "5.0.0", "4.3.3-beta.1"]) {
    expect(() => resolveStartupMode(version)).toThrow(
      `@nuxt/test-utils ${version} is not supported. Supported versions: 4.3.x.`,
    )
  }
})
