import { Window } from "happy-dom"
import { registerNuxtTestReset } from "nuxt-vitest-shared-app"
import { afterEach, expect, it } from "vitest"

import { assertAppRunning } from "#src/runtime/readiness"
import { getEnvironmentStore } from "#src/store"

// Vitest starts a new worker for every environment, so a replaced window stands in for a destroyed environment
// whose globals, like the Nuxt app context, are still around.
const original = { window: globalThis.window, document: globalThis.document }

function enterNewWindow() {
  const newWindow = new Window() as unknown as Window & { __NUXT_VITEST_ENVIRONMENT__?: boolean }
  newWindow.__NUXT_VITEST_ENVIRONMENT__ = true
  globalThis.window = newWindow as typeof globalThis.window
  globalThis.document = newWindow.document
  return newWindow
}

afterEach(() => {
  globalThis.window = original.window
  globalThis.document = original.document
})

it("does not reuse library state bound to another window", () => {
  const store = getEnvironmentStore()
  expect(store.baseline).toBeDefined()
  registerNuxtTestReset("bound-to-original", () => {})

  enterNewWindow()
  const fresh = getEnvironmentStore()
  expect(fresh).not.toBe(store)
  expect(fresh.baseline).toBeUndefined()
  expect(fresh.resets.has("bound-to-original")).toBe(false)
  expect(fresh.resets.has("probe")).toBe(false)

  globalThis.window = original.window
  globalThis.document = original.document
  expect(getEnvironmentStore()).toBe(store)
  store.resets.delete("bound-to-original")
})

it("does not reuse the adapter startup of another window", () => {
  const adapterKey = Symbol.for("nuxt-vitest-shared-app:adapter")
  const adapterState = (win: Window) => (win as unknown as Record<symbol, unknown>)[adapterKey]
  expect(adapterState(original.window)).toMatchObject({ started: true })
  expect(adapterState(enterNewWindow())).toBeUndefined()
})

it("rejects an app left in the global Nuxt context by another environment", () => {
  const app = useNuxtApp()
  const newWindow = enterNewWindow()
  expect(() => assertAppRunning(app, newWindow.document)).toThrow(
    /not running in the current test environment \(the Nuxt app is mounted in another document\)/,
  )
})
