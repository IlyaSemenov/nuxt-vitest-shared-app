// @vitest-environment node
import { onNuxtTestCleanup } from "nuxt-vitest-shared-app"
import { expect, it } from "vitest"

it("runs without a window", () => {
  expect(typeof window).toBe("undefined")
})

it("rejects test cleanups", () => {
  expect(() => onNuxtTestCleanup(() => {})).toThrow('not running in the Vitest "nuxt" environment')
})
