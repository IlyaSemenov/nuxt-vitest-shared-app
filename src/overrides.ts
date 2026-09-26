import {
  getEnvironmentStore,
  isNuxtEnvironment,
  type ImportFunction,
  type OverridableImport,
} from "./store"

/**
 * Registry of Nuxt auto-imports that tests may override.
 *
 * Augment it once in the project setup file, mapping each import name to its type:
 *
 * ```ts
 * declare module "nuxt-vitest-shared-app" {
 *   interface TestNuxtImports {
 *     useRoute: typeof useRoute
 *   }
 * }
 * ```
 */
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- augmented by projects
export interface TestNuxtImports {}

/** Name of a registered overridable auto-import. */
export type TestNuxtImportName = keyof TestNuxtImports & string

/** Route object accepted by `overrideNuxtRoute`, derived from the registered `useRoute` type. */
export type TestNuxtRoute = TestNuxtImports extends { useRoute: (...args: never[]) => infer Route }
  ? Partial<Route>
  : never

// A global symbol, because this module may be evaluated again after `vi.resetModules()`.
const WRAPPER_MARK = Symbol.for("nuxt-vitest-shared-app:wrapper")

/**
 * Creates a `mockNuxtImport` factory that installs a stable overridable wrapper for `name`.
 *
 * The wrapper calls the implementation set with `overrideNuxtImport` for the current test, or otherwise `fallback` if given, or the original import, preserving `this` and arguments.
 * Unlike `overrideNuxtImport` in `beforeEach`, `fallback` also applies while the app starts, e.g. to auto-imports called by plugins.
 * Outside the Vitest `nuxt` environment, e.g. in a file with `@vitest-environment node`, the factory returns `fallback` or the original.
 *
 * @example
 * ```ts
 * mockNuxtImport("useRoute", overridableNuxtImport("useRoute"))
 * mockNuxtImport("useUser", overridableNuxtImport("useUser", () => ref(null)))
 * ```
 */
export function overridableNuxtImport<Name extends TestNuxtImportName>(
  name: Name,
  fallback?: TestNuxtImports[Name],
): (original: TestNuxtImports[Name]) => TestNuxtImports[Name] {
  // Mock factories are evaluated during hoisted mock setup, so this must stay free of Nuxt imports.
  return (original) => {
    if (!isNuxtEnvironment()) return fallback ?? original
    const store = getEnvironmentStore()
    const existing = store.imports.get(name)
    // A wrapper passed back as the original is unwrapped, so wrappers never delegate to wrappers.
    const originalFunction = unwrap((fallback ?? original) as ImportFunction)
    if (existing) {
      // Re-evaluated factories return the retained wrapper so the started app stays connected to the registry.
      existing.original = originalFunction
      return existing.wrapper as TestNuxtImports[Name]
    }
    const entry: OverridableImport = {
      original: originalFunction,
      wrapper(...args) {
        const implementation = store.overrides.get(name) ?? entry.original
        return implementation.apply(this, args)
      },
    }
    Object.defineProperty(entry.wrapper, WRAPPER_MARK, { value: entry })
    store.imports.set(name, entry)
    return entry.wrapper as TestNuxtImports[Name]
  }
}

function unwrap(fn: ImportFunction): ImportFunction {
  const entry = (fn as { [WRAPPER_MARK]?: OverridableImport })[WRAPPER_MARK]
  return entry ? entry.original : fn
}

/**
 * Overrides a registered Nuxt auto-import for the current test.
 *
 * Overrides are cleared after each test.
 *
 * @throws When no wrapper for `name` was installed with `mockNuxtImport(name, overridableNuxtImport(name))`.
 */
export function overrideNuxtImport<Name extends TestNuxtImportName>(
  name: Name,
  implementation: TestNuxtImports[Name],
): void {
  const store = getEnvironmentStore()
  if (!store.imports.has(name)) {
    throw new Error(
      `nuxt-vitest-shared-app: "${name}" is not overridable. Add mockNuxtImport("${name}", overridableNuxtImport("${name}")) to the project setup file.`,
    )
  }
  store.overrides.set(name, implementation as ImportFunction)
}

/**
 * Makes the registered `useRoute` wrapper return exactly `route` for the current test.
 *
 * The object is not merged with the real route, does not navigate or sync the real router, and is read by components only when they call `useRoute`, so set it before mounting.
 */
export function overrideNuxtRoute(route: TestNuxtRoute): void {
  // `useRoute` is guaranteed to be registered by the `TestNuxtRoute` parameter type.
  overrideNuxtImport("useRoute" as TestNuxtImportName, (() => route) as never)
}
