import { readFileSync, realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, isAbsolute, join, resolve } from "node:path"

import type { defineVitestConfig } from "@nuxt/test-utils/config"

import { setupNuxtPlugin } from "../adapter/setup-nuxt-plugin"
import { resolveStartupMode, type StartupMode } from "./versions"

/** Config accepted by `defineVitestConfig` from `@nuxt/test-utils/config`. */
export type NuxtVitestConfig = NonNullable<Parameters<typeof defineVitestConfig>[0]>

/** Config resolved by `defineVitestConfig`. */
export type ResolvedNuxtVitestConfig = Awaited<ReturnType<ReturnType<typeof defineVitestConfig>>>

/** Options of `defineSharedNuxtVitestConfig`. */
export interface SharedNuxtVitestOptions {
  /** Hide Vue's `<Suspense> is an experimental feature` console message, which every `mountSuspended` call prints. */
  silenceSuspenseInfo?: boolean
}

/** The `@nuxt/test-utils` installation that resolved the config. */
export interface TestUtilsInstallation {
  version: string
  /** `dist/runtime` directory of the installation. */
  runtimeDir: string
}

/** Setup files of this library. */
export interface LibraryFiles {
  adapterEntry: string
  lifecycle: string
}

const SUSPENSE_INFO = "<Suspense> is an experimental feature and its API will likely change."

/** Locates the `@nuxt/test-utils` installation that `@nuxt/test-utils/config` resolves to from `from`. */
export function locateTestUtils(from: string): TestUtilsInstallation {
  const require = createRequire(from)
  const configPath = require.resolve("@nuxt/test-utils/config")
  const packageJson = JSON.parse(
    readFileSync(require.resolve("@nuxt/test-utils/package.json"), "utf8"),
  ) as { version: string }
  return { version: packageJson.version, runtimeDir: join(dirname(configPath), "runtime") }
}

/**
 * Turns a config resolved by `defineVitestConfig` into a shared-app config, in place.
 *
 * @throws When the config is incompatible with a shared app or the installed `@nuxt/test-utils` is not supported.
 */
export function applySharedApp(
  config: ResolvedNuxtVitestConfig,
  {
    options,
    installation,
    files,
    mode = resolveStartupMode(installation.version),
  }: {
    options: SharedNuxtVitestOptions
    installation: TestUtilsInstallation
    files: LibraryFiles
    mode?: StartupMode
  },
): ResolvedNuxtVitestConfig {
  const test = (config.test ??= {})
  const fail = (message: string) => {
    throw new Error(`nuxt-vitest-shared-app: ${message}`)
  }

  if (test.environment !== "nuxt") {
    fail(
      'set test.environment to "nuxt"; Vitest projects and other environments are not supported.',
    )
  }
  if (test.browser?.enabled) fail("Vitest browser mode is not supported.")
  if (test.isolate !== false) fail("set test.isolate to false so test files share the Nuxt app.")
  // `isolate` has no effect in the VM pools, and other pools are not tested.
  if (test.pool !== undefined && test.pool !== "threads" && test.pool !== "forks") {
    fail(`test.pool must be "threads" or "forks", got ${JSON.stringify(test.pool)}.`)
  }

  const sequence = (test.sequence ??= {})
  // Vitest 4 and 5 differ in the default, and the startup entry must finish before the lifecycle and project setup files.
  if (sequence.setupFiles === "parallel") fail('test.sequence.setupFiles must be "list".')
  sequence.setupFiles = "list"
  // Parallel hooks would let the lifecycle and project hooks run before the startup has finished.
  if (sequence.hooks === "parallel") fail('test.sequence.hooks must be "stack" or "list".')
  if (sequence.concurrent) fail("test.sequence.concurrent is not supported.")

  const root = config.root ? resolve(config.root) : process.cwd()
  const setupFiles = toArray(test.setupFiles)
  const upstreamEntry = join(installation.runtimeDir, "entry.mjs")
  const entryIndexes = setupFiles.flatMap((file, index) =>
    samePath(isAbsolute(file) ? file : resolve(root, file), upstreamEntry) ? [index] : [],
  )
  if (entryIndexes.length !== 1) {
    fail(
      `expected exactly one @nuxt/test-utils ${installation.version} runtime entry (${upstreamEntry}) in test.setupFiles, found ${entryIndexes.length}. Setup files: ${setupFiles.join(", ") || "(none)"}.`,
    )
  }
  const entryIndex = entryIndexes[0]!
  const entry = mode === "adapter" ? files.adapterEntry : setupFiles[entryIndex]!
  // Always app startup, then the library lifecycle, then project setup files.
  test.setupFiles = [
    entry,
    files.lifecycle,
    ...setupFiles.filter((_, index) => index !== entryIndex),
  ]

  if (mode === "adapter") (config.plugins ??= []).push(setupNuxtPlugin(installation))

  // The runtime files import `nuxt/app` and need Nuxt aliases, so they must go through the module runner.
  const deps = ((test.server ??= {}).deps ??= {})
  if (deps.inline !== true) {
    deps.inline = [...(deps.inline ?? []), /[\\/]node_modules[\\/]nuxt-vitest-shared-app[\\/]/]
  }

  if (options.silenceSuspenseInfo) {
    const onConsoleLog = test.onConsoleLog
    test.onConsoleLog = (log, ...args) => {
      if (log.includes(SUSPENSE_INFO)) return false
      return onConsoleLog?.(log, ...args)
    }
  }

  return config
}

function toArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value]
}

function samePath(left: string, right: string) {
  return realpath(left) === realpath(right)
}

function realpath(path: string) {
  try {
    return realpathSync(path)
  } catch {
    return resolve(path)
  }
}
