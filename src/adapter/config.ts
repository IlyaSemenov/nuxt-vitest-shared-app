import { existsSync } from "node:fs"
import { join } from "node:path"

import type { ResolvedNuxtVitestConfig, TestUtilsInstallation } from "../config/apply"
import { SETUP_NUXT_ID } from "./setup-nuxt-id"

/**
 * Creates the Vite plugin that resolves `SETUP_NUXT_ID` to the internal `setupNuxt` module of the installation.
 *
 * @throws When the installation has no such module.
 */
export function setupNuxtPlugin(
  installation: TestUtilsInstallation,
): NonNullable<ResolvedNuxtVitestConfig["plugins"]>[number] {
  const setupNuxtPath = join(installation.runtimeDir, "shared", "nuxt.mjs")
  if (!existsSync(setupNuxtPath)) {
    throw new Error(
      `nuxt-vitest-shared-app: @nuxt/test-utils ${installation.version} has no internal ${setupNuxtPath}; this version is not supported.`,
    )
  }
  return {
    name: "nuxt-vitest-shared-app:setup-nuxt",
    enforce: "pre",
    resolveId(id) {
      // Resolves to the real file so the module instance is shared with `@nuxt/test-utils` itself.
      if (id === SETUP_NUXT_ID) return setupNuxtPath
    },
  }
}
