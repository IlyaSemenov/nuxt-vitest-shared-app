/**
 * How the Nuxt app is started for the installed `@nuxt/test-utils` version.
 *
 * - `adapter`: the library replaces the `@nuxt/test-utils` runtime entry with its adapter entry.
 * - `native`: `@nuxt/test-utils` reuses the app itself; the library keeps its entry.
 */
export type StartupMode = "adapter" | "native"

/**
 * Tested `@nuxt/test-utils` release lines.
 *
 * Native reuse is detected by version only, until upstream offers a documented public signal:
 *
 * - https://github.com/nuxt/test-utils/issues/1750
 * - https://github.com/nuxt/test-utils/pull/1821
 */
const TESTED_VERSIONS: ReadonlyArray<{ line: string; mode: StartupMode }> = [
  { line: "4.3", mode: "adapter" },
]

/**
 * Resolves the startup mode for an installed `@nuxt/test-utils` version.
 *
 * @throws For versions that were not tested, instead of guessing.
 */
export function resolveStartupMode(version: string): StartupMode {
  const match = /^(\d+\.\d+)\.\d+$/.exec(version)
  const tested = match && TESTED_VERSIONS.find((entry) => entry.line === match[1])
  if (!tested) {
    const lines = TESTED_VERSIONS.map((entry) => `${entry.line}.x`).join(", ")
    throw new Error(
      `nuxt-vitest-shared-app: @nuxt/test-utils ${version} is not supported. Supported versions: ${lines}.`,
    )
  }
  return tested.mode
}
