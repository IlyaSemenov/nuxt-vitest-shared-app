/** Function signature stored in the override registry; public types come from `TestNuxtImports`. */
export type ImportFunction = (this: unknown, ...args: never[]) => unknown

/** A stable wrapper installed through `mockNuxtImport` and the default it delegates to: the fallback or the original. */
export interface OverridableImport {
  wrapper: ImportFunction
  defaultImplementation: ImportFunction
}

/** A project reset registered with `registerNuxtTestReset`. */
export interface ResetRegistration {
  reset: () => unknown
}

/** State captured once per environment right after a successful Nuxt startup. */
export interface EnvironmentBaseline {
  route: string
  bodyChildren: ReadonlySet<Node>
}

/**
 * Library state bound to one Nuxt environment `window`.
 *
 * It outlives module re-evaluation and test files, but never crosses environments.
 */
export interface EnvironmentStore {
  readonly window: Window
  readonly document: Document
  baseline?: EnvironmentBaseline
  /** The Nuxt startup error found by the readiness check when the startup entry cannot retry. */
  startupFailure?: Error
  /** The cleanup failure that left this environment in an unknown state. */
  contamination?: Error
  /** Set while the cleanup after a test runs; still set when the next test starts if the cleanup timed out. */
  cleanupPending?: boolean
  readonly imports: Map<string, OverridableImport>
  readonly overrides: Map<string, ImportFunction>
  readonly resets: Map<string, ResetRegistration>
  readonly workerState: Map<string, unknown>
}

const STORE_KEY = Symbol.for("nuxt-vitest-shared-app:store")

type StoreWindow = Window & {
  __NUXT_VITEST_ENVIRONMENT__?: boolean
  [STORE_KEY]?: EnvironmentStore
}

/** Whether the current test file runs in the Vitest `nuxt` environment. */
export function isNuxtEnvironment() {
  return !!(globalThis as { window?: StoreWindow }).window?.__NUXT_VITEST_ENVIRONMENT__
}

/**
 * Returns the store bound to the current environment `window`, creating it on first use.
 *
 * @throws Outside the Vitest `nuxt` environment.
 */
export function getEnvironmentStore(): EnvironmentStore {
  const win = (globalThis as { window?: StoreWindow }).window
  if (!win?.__NUXT_VITEST_ENVIRONMENT__) {
    throw new Error('nuxt-vitest-shared-app: not running in the Vitest "nuxt" environment.')
  }
  const existing = win[STORE_KEY]
  // A store copied onto another window or surviving a replaced document belongs to a different environment.
  if (existing && existing.window === win && existing.document === win.document) {
    return existing
  }
  const store: EnvironmentStore = {
    window: win,
    document: win.document,
    imports: new Map(),
    overrides: new Map(),
    resets: new Map(),
    workerState: new Map(),
  }
  Object.defineProperty(win, STORE_KEY, { value: store, configurable: true })
  return store
}
