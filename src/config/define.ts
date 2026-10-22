import { fileURLToPath } from "node:url"

import { defineVitestConfig } from "@nuxt/test-utils/config"

import {
  applySharedApp,
  locateTestUtils,
  type NuxtVitestConfig,
  type SharedNuxtVitestOptions,
} from "./apply"

/** Creates the config function for the library loaded from `libraryUrl`. */
export function createSharedNuxtVitestConfig(
  config: NuxtVitestConfig,
  options: SharedNuxtVitestOptions,
  libraryUrl: string,
): ReturnType<typeof defineVitestConfig> {
  // The setup file sits next to the config entry: `.ts` sources in development, `.mjs` in the published package.
  const extension = libraryUrl.endsWith(".ts") ? ".ts" : ".mjs"
  const lifecycle = fileURLToPath(new URL(`./runtime/lifecycle${extension}`, libraryUrl))
  const resolveConfig = defineVitestConfig(config)
  return async (...args: Parameters<typeof resolveConfig>) =>
    applySharedApp(await resolveConfig(...args), {
      options,
      // The same installation whose `defineVitestConfig` produced the config.
      installation: locateTestUtils(libraryUrl),
      lifecycle,
    })
}
