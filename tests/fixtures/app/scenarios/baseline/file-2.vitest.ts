import { expect, it } from "vitest"

it("starts on the route set by the project beforeAll", () => {
  expect(useRouter().currentRoute.value.fullPath).toBe("/items/7")
})

it("is restored to the startup baseline after a test", () => {
  expect(useRouter().currentRoute.value.fullPath).toBe("/")
})
