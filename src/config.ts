import type { defineVitestConfig } from "@nuxt/test-utils/config"

import type { NuxtVitestConfig, SharedNuxtVitestOptions } from "./config/apply"
import { createSharedNuxtVitestConfig } from "./config/define"

export type { SharedNuxtVitestOptions } from "./config/apply"

/**
 * Wraps `defineVitestConfig` from `@nuxt/test-utils/config` so all test files of a Vitest worker share one Nuxt app.
 *
 * It starts Nuxt once per environment, adds the library lifecycle (readiness check, per-test cleanup, rejection of concurrent tests), and validates the settings a shared app relies on.
 *
 * @throws When the config uses an unsupported setting or the installed `@nuxt/test-utils` version was not tested.
 */
export function defineSharedNuxtVitestConfig(
  config: NuxtVitestConfig,
  options: SharedNuxtVitestOptions = {},
): ReturnType<typeof defineVitestConfig> {
  return createSharedNuxtVitestConfig(config, options, import.meta.url)
}
