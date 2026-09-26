import { mountSuspended } from "@nuxt/test-utils/runtime"
import { stubVisibleIntersectionObserver } from "nuxt-vitest-shared-app/dom"
import { expect, it } from "vitest"
import { nextTick } from "vue"

import VisibilityProbe from "~/components/VisibilityProbe.vue"

const upstreamObserver = globalThis.IntersectionObserver

it("reports observed elements as visible", async () => {
  stubVisibleIntersectionObserver()
  const wrapper = await mountSuspended(VisibilityProbe)
  await nextTick()
  expect(wrapper.text()).toBe("visible")
})

it("is removed by the per-test cleanup", async () => {
  expect(globalThis.IntersectionObserver).toBe(upstreamObserver)
  const wrapper = await mountSuspended(VisibilityProbe)
  await nextTick()
  expect(wrapper.text()).toBe("hidden")
})
