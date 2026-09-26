// @vitest-environment node
import { expect, it } from "vitest"

it("runs without a window", () => {
  expect(typeof window).toBe("undefined")
})
