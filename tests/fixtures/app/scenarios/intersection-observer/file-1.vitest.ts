import { mountSuspended } from "@nuxt/test-utils/runtime"
import { stubVisibleIntersectionObserver } from "nuxt-vitest-shared-app"
import { expect, it } from "vitest"
import { nextTick } from "vue"

import InfiniteScrollProbe from "~/components/InfiniteScrollProbe.vue"
import VisibilityProbe from "~/components/VisibilityProbe.vue"

const upstreamObserver = globalThis.IntersectionObserver

it("reports observed elements as visible", async () => {
  stubVisibleIntersectionObserver()
  const wrapper = await mountSuspended(VisibilityProbe)
  await nextTick()
  expect(wrapper.text()).toBe("visible")
})

it("reports the visibility set by the test to the observers of the target", async () => {
  const setVisible = stubVisibleIntersectionObserver()
  const changed = await mountSuspended(VisibilityProbe)
  const unchanged = await mountSuspended(VisibilityProbe)
  await setVisible(false, changed.element)
  expect(changed.text()).toBe("hidden")
  expect(unchanged.text()).toBe("visible")
  await setVisible(false)
  await setVisible(true)
  expect(changed.text()).toBe("visible")
  expect(unchanged.text()).toBe("visible")
})

it("stops reporting targets that are unobserved or disconnected", async () => {
  const setVisible = stubVisibleIntersectionObserver()
  const reports: boolean[] = []
  const observer = new IntersectionObserver((entries) => {
    reports.push(...entries.map((entry) => entry.isIntersecting))
  })
  const unobserved = document.createElement("div")
  const disconnected = document.createElement("div")
  observer.observe(unobserved)
  observer.unobserve(unobserved)
  await setVisible(false)
  observer.observe(disconnected)
  observer.disconnect()
  await setVisible(false)
  expect(reports).toEqual([true, true])
})

it("reports the window as visible for infinite scroll", async () => {
  stubVisibleIntersectionObserver()
  const wrapper = await mountSuspended(InfiniteScrollProbe)
  await nextTick()
  expect(wrapper.text()).toBe("loads: 1")
})

it("accepts the document and rejects targets that are not elements", () => {
  stubVisibleIntersectionObserver()
  const targets: unknown[] = []
  const observer = new IntersectionObserver((entries) => {
    targets.push(...entries.map((entry) => entry.target))
  })
  observer.observe(document as unknown as Element)
  expect(targets).toEqual([document])
  expect(() => observer.observe({} as Element)).toThrow(TypeError)
})

it("is removed by the per-test cleanup", async () => {
  expect(globalThis.IntersectionObserver).toBe(upstreamObserver)
  const wrapper = await mountSuspended(VisibilityProbe)
  await nextTick()
  expect(wrapper.text()).toBe("hidden")
})
