import { expect, it } from "vitest"

import { assertSupportedTestUtils } from "./versions"

it("accepts versions with app reuse", () => {
  for (const version of ["4.3.3", "4.3.10", "4.4.0", "5.0.0", "5.0.0-beta.1", "4.3.3+build.1"]) {
    expect(() => assertSupportedTestUtils(version)).not.toThrow()
  }
})

it("points 4.3.0–4.3.2 to the library line that supports them", () => {
  for (const version of ["4.3.0", "4.3.2"]) {
    expect(() => assertSupportedTestUtils(version)).toThrow(
      `@nuxt/test-utils ${version} is not supported. Install @nuxt/test-utils 4.3.3 or later, or use nuxt-vitest-shared-app 0.2.x with @nuxt/test-utils ${version}.`,
    )
  }
})

it("rejects other versions without app reuse", () => {
  for (const version of ["4.2.9", "3.23.0", "4.3.3-beta.1", "4.3.3-beta.1+build.1", "latest"]) {
    expect(() => assertSupportedTestUtils(version)).toThrow(
      `@nuxt/test-utils ${version} is not supported. Install @nuxt/test-utils 4.3.3 or later.`,
    )
  }
})
