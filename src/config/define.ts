import { fileURLToPath } from "node:url"

import { defineVitestConfig } from "@nuxt/test-utils/config"

import {
  applySharedApp,
  locateTestUtils,
  type NuxtVitestConfig,
  type SharedNuxtVitestOptions,
} from "./apply"
import type { StartupMode } from "./versions"

/**
 * Creates the config function; `mode` bypasses the version policy and is used only by this library's own tests.
 */
export function createSharedNuxtVitestConfig(
  config: NuxtVitestConfig,
  options: SharedNuxtVitestOptions,
  libraryUrl: string,
  mode?: StartupMode,
): ReturnType<typeof defineVitestConfig> {
  // The setup files sit next to the config entry: `.ts` sources in development, `.mjs` in the published package.
  const extension = libraryUrl.endsWith(".ts") ? ".ts" : ".mjs"
  const files = {
    adapterEntry: fileURLToPath(new URL(`./adapter/entry${extension}`, libraryUrl)),
    lifecycle: fileURLToPath(new URL(`./runtime/lifecycle${extension}`, libraryUrl)),
  }
  const resolveConfig = defineVitestConfig(config)
  return async (...args: Parameters<typeof resolveConfig>) =>
    applySharedApp(await resolveConfig(...args), {
      options,
      // The same installation whose `defineVitestConfig` produced the config.
      installation: locateTestUtils(libraryUrl),
      files,
      mode,
    })
}
