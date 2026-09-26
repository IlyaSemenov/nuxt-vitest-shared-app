// @vitest-environment happy-dom
import { expect, it } from "vitest"
import { createApp } from "vue"

import { assertAppRunning } from "./readiness"

it("rejects an unmounted app whose container is still in the document", () => {
  const container = document.createElement("div")
  document.body.append(container)
  const vueApp = createApp({ render: () => null })
  vueApp.mount(container)
  const nuxtApp = { vueApp } as unknown as Parameters<typeof assertAppRunning>[0]
  expect(() => assertAppRunning(nuxtApp, document)).not.toThrow()
  vueApp.unmount()
  expect(() => assertAppRunning(nuxtApp, document)).toThrow(/\(the Nuxt app is not mounted\)/)
})
