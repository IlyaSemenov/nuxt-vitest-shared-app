import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, it } from "vitest"

import { locateTestUtils } from "#src/config/apply"

// The adapter depends on these private files of @nuxt/test-utils; a changed layout must fail here, not silently in projects.
const { runtimeDir } = locateTestUtils(import.meta.url)

it("has the runtime entry that the config wrapper replaces", async () => {
  const entry = await readFile(join(runtimeDir, "entry.mjs"), "utf8")
  expect(entry).toContain('from "./shared/nuxt.mjs"')
})

it("exports setupNuxt from the shared runtime module", async () => {
  const shared = await readFile(join(runtimeDir, "shared/nuxt.mjs"), "utf8")
  expect(shared).toMatch(/export \{[^}]*\bsetupNuxt\b[^}]*\}/)
  // setupNuxt shares the vue-wrapper-plugin state with mountSuspended.
  expect(shared).toContain('from "./vue-wrapper-plugin.mjs"')
})
