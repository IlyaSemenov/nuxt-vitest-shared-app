import { describe, it, test } from "vitest"

describe.concurrent("concurrent suite", () => {
  it("first", () => {})
  it("second", () => {})
})

test.concurrent("concurrent test", () => {})

test("sequential test", () => {})
