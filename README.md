# nuxt-vitest-shared-app

Run Nuxt component tests in Vitest on one Nuxt app per Vitest worker, shared by all test files of that worker.

The library provides:

- the shared-app lifecycle on top of `@nuxt/test-utils` (`environment: "nuxt"`, `mountSuspended`, `mockNuxtImport`);
- deterministic cleanup of documented Nuxt and test-owned state after each test, with explicit project resets for application-specific resources;
- typed per-test overrides of Nuxt auto-imports.

It does not reset the whole app state.
State created by startup plugins is not re-created between tests or files.
Tests that need plugins re-initialized or a different startup config belong in a [separate Vitest project](#startup-sensitive-tests).

## The problem

`@nuxt/test-utils` adds its runtime entry to `test.setupFiles`.
The entry calls `vi.resetModules()` and starts Nuxt in `beforeAll` for every test file, so Nuxt is initialized again per file even with `isolate: false`.
In a project with many small component test files, most of the run time goes into Nuxt startup.

With this library, each Vitest worker starts Nuxt once, and all its test files run on that app.
As a data point from one application with a local workaround, [nuxt/test-utils#1750](https://github.com/nuxt/test-utils/issues/1750) reports 12 files with 22 tests going from 19.6 s to 6.6 s with one worker; your numbers will differ.

Upstream work on native reuse is tracked in [nuxt/test-utils#1750](https://github.com/nuxt/test-utils/issues/1750) and [nuxt/test-utils#1821](https://github.com/nuxt/test-utils/pull/1821).

[untestutils](https://github.com/s00d/untestutils) is a test harness whose Nuxt unit environment (`environment: "untestutils"`) has the same per-file startup.
Worker-scoped app reuse there is requested in [s00d/untestutils#1](https://github.com/s00d/untestutils/issues/1).
This library supports only `@nuxt/test-utils` for now; untestutils support may be added later, natively if that request is implemented.

## Install

```sh
npm install -D nuxt-vitest-shared-app
```

Tested versions:

| Package            | Versions                 |
| ------------------ | ------------------------ |
| `@nuxt/test-utils` | 4.3.x                    |
| `nuxt`             | 4.4.2 and later 4.x      |
| `vitest`           | 4.1.0 and later 4.x, 5.x |
| `@vue/test-utils`  | 2.4.2 and later 2.x      |
| `happy-dom`        | 20.0.11 and later        |

jsdom is not supported in this version.

## Setup

Wrap the Vitest config with `defineSharedNuxtVitestConfig` instead of `defineVitestConfig`:

```ts
// vitest.config.ts
import { defineSharedNuxtVitestConfig } from "nuxt-vitest-shared-app/config"

export default defineSharedNuxtVitestConfig(
  {
    test: {
      include: ["**/*.vitest.ts"],
      environment: "nuxt",
      pool: "threads",
      isolate: false,
      setupFiles: ["./testing/nuxt/setup.ts"],
    },
  },
  { silenceSuspenseInfo: true },
)
```

Register overridable imports and project resets in the project setup file:

```ts
// testing/nuxt/setup.ts
import { mockNuxtImport } from "@nuxt/test-utils/runtime"
import { overridableNuxtImport, registerNuxtTestReset } from "nuxt-vitest-shared-app"

import type { navigateTo, useRoute } from "#app/composables/router"
import type { useUser } from "~/composables/authUser"

declare module "nuxt-vitest-shared-app" {
  interface TestNuxtImports {
    navigateTo: typeof navigateTo
    useRoute: typeof useRoute
    useUser: typeof useUser
  }
}

mockNuxtImport("navigateTo", overridableNuxtImport("navigateTo"))
mockNuxtImport("useRoute", overridableNuxtImport("useRoute"))
// The fallback replaces the original in every test and while the app starts.
mockNuxtImport(
  "useUser",
  overridableNuxtImport("useUser", () => ref(null)),
)

registerNuxtTestReset("api-client", resetTestApiClient)
```

Override imports in a test:

```ts
import { overrideNuxtImport, overrideNuxtRoute } from "nuxt-vitest-shared-app"

overrideNuxtImport("navigateTo", vi.fn())
overrideNuxtRoute({ params: { id: "1" } })
```

### Config wrapper

`defineSharedNuxtVitestConfig(config, options?)` passes `config` to `defineVitestConfig` from `@nuxt/test-utils/config`, then:

- starts the app once per worker instead of once per file (see [Version policy](#version-policy));
- inserts the library lifecycle setup file right after the app startup entry, so setup files always run as app startup, library lifecycle, project setup files;
- requires `test.environment: "nuxt"` at the top level; Vitest projects and browser mode are not supported;
- requires `test.isolate: false`;
- sets `test.sequence.setupFiles` to `"list"` and rejects `"parallel"`;
- rejects `test.sequence.concurrent: true`;
- keeps all other settings.

With `silenceSuspenseInfo: true`, Vue's `<Suspense> is an experimental feature and its API will likely change.` message, which every `mountSuspended` call prints, is filtered through `test.onConsoleLog`; your own `onConsoleLog` still receives all other messages.

## Lifecycle

| What                                                                           | Lifetime                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------- |
| Started app, route baseline, project resets, overridable imports, worker state | The Nuxt environment (its `window`) of the worker |
| Library `beforeAll` / `beforeEach` hooks                                       | One test file                                     |
| Import overrides and per-test resources                                        | One test                                          |

For each test file of a worker, the library:

1. starts Nuxt if this environment has no app yet, or awaits the startup in progress;
2. checks that the Nuxt app is mounted in the current environment's document, and fails the file with a clear error otherwise;
3. captures the route baseline and the direct children of `document.body` once per environment, right after the first successful startup and before any project `beforeAll` or `beforeEach`;
4. fails tests that run concurrently in the worker (`test.concurrent`, `describe.concurrent`);
5. cleans up after each test.

Vitest drops hooks between files even with `isolate: false`, so the lifecycle hooks are registered again for every file.

Library state is bound to the environment's `window` and is never reused by another environment.

### Tests run sequentially within a worker

All tests of a worker share one app, so they must not run concurrently.
Parallelism across workers is supported: each worker has its own environment and its own app.

### Module cache

Modules are evaluated once per environment and stay cached for the following files.
A singleton created by a plugin at startup is the same instance that components and test files see in every file of the worker.
Only the first file of an environment, or the next file after a failed startup, starts from a clean module graph.

A module mock registered again in a later file does not change references that the started app already captured.
This is why overridable imports use a stable wrapper, see below.

### Files with another environment

Test files with another environment, such as `// @vitest-environment node`, run without the library lifecycle.
In such files, `overridableNuxtImport` factories return the fallback or the original import, and `registerNuxtTestReset` registers nothing, so the same project setup file works for them.
`overrideNuxtImport`, `overrideNuxtRoute` and `getOrCreateWorkerState` throw outside the `nuxt` environment.

## Cleanup

After each test, the library runs these steps in order.
They run after all `afterEach` hooks of the project, also when one of these hooks fails.

1. unmounts wrappers mounted in the test through `@vue/test-utils` (including `mountSuspended`), using `enableAutoUnmount`;
2. `await nextTick()` and `await flushPromises()`;
3. navigates the app's own router back to the route baseline with `router.replace` if the route differs, and verifies the resulting route;
4. clears import overrides;
5. `await clearError()`, `clearNuxtData()`, `clearNuxtState(undefined, { reset: false })`;
6. runs project resets registered with `registerNuxtTestReset`, in registration order, awaiting each;
7. `localStorage.clear()`, `sessionStorage.clear()`, and expires every cookie visible in `document.cookie` for path `/` of the current origin;
8. `vi.clearAllTimers()`, `vi.useRealTimers()`, `vi.unstubAllEnvs()`, `vi.unstubAllGlobals()`;
9. removes direct children of `document.body` that were not present at startup.

The exact scope:

- `flushPromises` only settles handlers of promises that are already resolved; subscriptions, requests, and other background work need their own project resets;
- step 3 uses the router instance of the app, never the overridable `useRoute`/`navigateTo`;
- DOM cleanup removes only new direct children of `document.body`; changes to nodes that existed at startup are not reverted;
- cookies are expired only as listed above; `HttpOnly` cookies and cookies of other paths or domains are not touched;
- state created by startup plugins is not re-created.

The library does not touch Vitest mocks (`vi.fn`, `vi.spyOn`, call history).
Configure `clearMocks`, `mockReset`, or `restoreMocks` in your Vitest config as needed.

### Failed cleanup

A failing step does not prevent the remaining steps; real timers and unstubbing always run.
Failures are reported with their step names, and all collected errors are preserved.

After a failed cleanup the environment is in an unknown state.
Every following test in it fails with an error that references the original failure.
There is no recovery in this version.

### Failed startup

If Nuxt startup fails, the file fails with the original error, and a partially created app is unmounted.
Nuxt itself catches errors of plugins during startup and continues with a partially initialized app; the library treats such an error as a startup failure too, and reports it with the Nuxt error as its cause.
If unmounting fails too, both errors are reported together in an `AggregateError`, the original one first.
The next file of the worker tries the startup again from a clean module graph.

## Project resets

```ts
registerNuxtTestReset(key: string, reset: () => unknown): () => void
```

Registers a reset that runs after each test, see step 6 of the cleanup.
Registering the same key again replaces the callback and keeps its position, so a setup file that runs for every test file does not accumulate registrations.
The returned function removes the registration, unless it has already been replaced.

## Overridable imports

`mockNuxtImport` is a compile-time macro, so its calls stay in your project setup file; the library provides the factory.

The project augments `TestNuxtImports` once, mapping import names to their types.
`overridableNuxtImport` and `overrideNuxtImport` accept only registered names, and implementations are typed by the registry.

```ts
overridableNuxtImport(name, fallback?): (original) => wrapper
```

Creates the `mockNuxtImport` factory.
The wrapper calls the current test's override, or otherwise `fallback` if given, or the original import, preserving `this` and arguments.

Use `fallback` for a project default.
Plugins and other startup code call auto-imports before any test hook runs, so a default set with `overrideNuxtImport` in `beforeEach` does not apply to them, and it cannot be set earlier because the wrapper is installed only when the app starts.

The factory can run during hoisted mock evaluation: it does not initialize Nuxt or import the mocked modules.
When a mock factory is evaluated again, it returns the wrapper that the app already holds.

```ts
overrideNuxtImport(name, implementation): void
```

Overrides the import for the current test.
It throws when no wrapper for `name` was installed, so a missing `mockNuxtImport` line does not look like a working override.

```ts
overrideNuxtRoute(route): void
```

Makes the `useRoute` wrapper return exactly `route`, a `Partial` of the registered `useRoute` return type, for the current test.
It requires `useRoute` in `TestNuxtImports` and an overridable `useRoute` mock.

- It does not navigate or sync the real router.
- It does not merge `route` with the real route: missing fields are not filled in, and the object does not satisfy the full `useRoute` contract.
- Mounted components do not react to it; set it before mounting.

## Worker state

```ts
getOrCreateWorkerState<T>(name: string, create: () => T): T
```

Returns state bound to the current Nuxt environment, creating it on first use.
Use it for project helpers whose state must survive module re-evaluation between files, such as a test API client that the started app also uses.

## DOM helpers

```ts
import { stubVisibleIntersectionObserver } from "nuxt-vitest-shared-app/dom"

stubVisibleIntersectionObserver()
```

Stubs the global `IntersectionObserver` with one that reports each observed element as visible immediately in `observe()`, because happy-dom and the `@nuxt/test-utils` mock never call the observer callback.
Entries include `time`, which vueuse `useElementVisibility` uses to pick the latest entry.
The stub is installed with `vi.stubGlobal`, so the cleanup removes it after the test.

## Startup-sensitive tests

Tests that need startup plugins re-initialized, a different runtime config, or other startup options cannot share the app.
Put them in a separate Vitest project that uses `defineVitestConfig` or `defineVitestProject` from `@nuxt/test-utils/config` with normal isolation.

## Version policy

Until `@nuxt/test-utils` reuses the app natively, the library replaces its runtime entry with an adapter that follows the lifecycle of [nuxt/test-utils#1821](https://github.com/nuxt/test-utils/pull/1821).
The adapter loads the internal `setupNuxt` from `@nuxt/test-utils/dist/runtime/shared/nuxt.mjs` through the Vitest module runner, because it shares state with `mountSuspended`.
This internal module is not part of the public `@nuxt/test-utils` API, so each supported release line is tested explicitly.

| Installed `@nuxt/test-utils`                            | Behavior                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| 4.3.x                                                   | The adapter replaces the upstream runtime entry                 |
| A tested release with native reuse (none published yet) | The upstream entry is kept; the library lifecycle runs after it |
| Any other version                                       | The config throws an error with the installed version           |

Native reuse is detected by version, not by inspecting `@nuxt/test-utils` internals.
Your tests and setup files stay the same when the library switches to native reuse.
