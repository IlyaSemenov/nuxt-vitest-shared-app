import { expect, it } from "vitest"

import { report } from "../../testing/report"

it("runs on exactly one mounted app with one set of subscriptions", () => {
  window.__pings = 0
  window.dispatchEvent(new Event("probe:ping"))
  const state = {
    startups: window.__startupProbe?.startups,
    mountedApps: document.querySelectorAll("[data-v-app]").length,
    pings: window.__pings,
  }
  report("startup", state)
  expect(state).toEqual({ startups: state.startups, mountedApps: 1, pings: 1 })
})
