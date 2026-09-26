# nuxt-vitest-shared-app

Run Nuxt component tests in Vitest on one Nuxt app per Vitest worker, shared by all test files of that worker.

The library provides:

- the shared-app lifecycle on top of `@nuxt/test-utils` (`environment: "nuxt"`, `mountSuspended`, `mockNuxtImport`);
- deterministic cleanup of documented Nuxt and test-owned state after each test, with explicit project resets for application-specific resources;
- typed per-test overrides of Nuxt auto-imports.

It does not reset the whole app state.
State created by startup plugins is not re-created between tests or files.
Tests that need plugins re-initialized or a different startup config belong in a [separate Vitest config](#startup-sensitive-tests).

- [The problem](#the-problem)
- [Install](#install)
- [Quick start](#quick-start)
- [Migrating an existing suite](#migrating-an-existing-suite)
- [Per-test overrides](#per-test-overrides)
- [Project resets](#project-resets)
- [Worker state](#worker-state)
- [DOM helpers](#dom-helpers)
- [Lifecycle](#lifecycle)
- [Cleanup](#cleanup)
- [Startup-sensitive tests](#startup-sensitive-tests)
- [Compatibility and upstream](#compatibility-and-upstream)

## The problem

`@nuxt/test-utils` adds its runtime entry to `test.setupFiles`.
The entry calls `vi.resetModules()` and starts Nuxt in `beforeAll` for every test file, so Nuxt is initialized again per file even with `isolate: false`.
In a project with many small component test files, most of the run time goes into Nuxt startup.

With this library, each Vitest worker starts Nuxt once, and all its test files run on that app.
As a data point from one application with a local workaround, [nuxt/test-utils#1750](https://github.com/nuxt/test-utils/issues/1750) reports 12 files with 22 tests going from 19.6 s to 6.6 s with one worker; your numbers will differ.

## Install

```sh
npm install -D nuxt-vitest-shared-app
```

Supported versions:

| Package            | Versions                 |
| ------------------ | ------------------------ |
| `@nuxt/test-utils` | 4.3.x                    |
| `nuxt`             | 4.4.2 and later 4.x      |
| `vitest`           | 4.1.0 and later 4.x, 5.x |
| `vue`              | 3.5.30 and later 3.x     |
| `@vue/test-utils`  | 2.4.2 and later 2.x      |
| `happy-dom`        | 20.0.11 and later        |

CI runs the whole suite with the lowest listed versions, with the versions pinned in the lockfile, and with the latest compatible Vitest 4 release.
jsdom is not supported in this version.

## Quick start

Replace `defineVitestConfig` with `defineSharedNuxtVitestConfig` in the Vitest config of your Nuxt component tests:

```ts
// vitest.config.ts
import { defineSharedNuxtVitestConfig } from "nuxt-vitest-shared-app/config"

export default defineSharedNuxtVitestConfig({
  test: {
    include: ["**/*.vitest.ts"],
    environment: "nuxt",
    pool: "threads",
    isolate: false,
  },
})
```

Keep your existing test file patterns and other settings.
Existing `mountSuspended` tests run on the shared app with the built-in cleanup as they are.
Add a project setup file only when you need [per-test overrides](#per-test-overrides) or [project resets](#project-resets).

The wrapper passes the config to `defineVitestConfig` from `@nuxt/test-utils/config`, adds the library lifecycle, and checks the settings a shared app relies on:

- `test.environment` must be `"nuxt"` at the top level; Vitest projects and browser mode are not supported;
- `test.isolate` must be `false`;
- `test.pool` must be `"threads"` or `"forks"`; `isolate` has no effect in the VM pools;
- `test.sequence.setupFiles` is set to `"list"`, and `"parallel"` is rejected;
- `test.sequence.hooks: "parallel"` and `test.sequence.concurrent: true` are rejected.

The second argument takes options:

```ts
defineSharedNuxtVitestConfig(config, { silenceSuspenseInfo: true })
```

With `silenceSuspenseInfo: true`, Vue's `<Suspense> is an experimental feature and its API will likely change.` message, which every `mountSuspended` call prints, is filtered through `test.onConsoleLog`; your own `onConsoleLog` still receives all other messages.

## Migrating an existing suite

Remove what the library now does:

- `enableAutoUnmount` calls in project setup files: the library installs its own, and `@vue/test-utils` rejects a second call;
- hooks that clean up what the library [cleans up](#cleanup), such as Nuxt state, storage, cookies, timers, and stubbed globals;
- local patches or workarounds that start Nuxt once per worker.

Keep project-specific cleanup, and move hooks that must run after every test into [project resets](#project-resets).

Because modules stay cached, objects created at module level live for the whole environment, not for one file.
A global replaced by one test file affects every file that runs after it in the worker, including objects that other modules already created from the previous global.
For example, a test file that imports a forced `Intl` polyfill replaces the global constructor, while a formatter created earlier at module level still belongs to the previous implementation.

- Install global polyfills once in a project setup file, before components are imported, and prefer polyfills that keep an existing implementation.
- Do not replace global constructors with side-effect imports in individual test files.
- Review module-level objects that depend on such globals, such as formatters, clients, and caches.
- After the migration, run the suite on one worker with shuffled files, so all files share one environment in a different order, e.g. `vitest run --maxWorkers=1 --sequence.shuffle.files --sequence.seed=1`.

## Per-test overrides

A module mock registered again in a later file does not change references that the started app already captured.
So the project installs a stable wrapper once with `mockNuxtImport`, and tests swap its implementation for one test.

Register overridable imports in a project setup file:

```ts
// vitest.config.ts
export default defineSharedNuxtVitestConfig({
  test: {
    // ...
    setupFiles: ["./testing/nuxt/setup.ts"],
  },
})
```

```ts
// testing/nuxt/setup.ts
import { mockNuxtImport } from "@nuxt/test-utils/runtime"
import { overridableNuxtImport } from "nuxt-vitest-shared-app"

import type { navigateTo, useRoute } from "#app/composables/router"

declare module "nuxt-vitest-shared-app" {
  interface TestNuxtImports {
    navigateTo: typeof navigateTo
    useRoute: typeof useRoute
  }
}

mockNuxtImport("navigateTo", overridableNuxtImport("navigateTo"))
mockNuxtImport("useRoute", overridableNuxtImport("useRoute"))
```

Override them inside a test or a test hook:

```ts
import { mountSuspended } from "@nuxt/test-utils/runtime"
import { overrideNuxtImport, overrideNuxtRoute } from "nuxt-vitest-shared-app"
import { expect, it, vi } from "vitest"

import ItemPage from "~/pages/items/[id].vue"

it("opens the edit page", async () => {
  const navigate = vi.fn()
  overrideNuxtImport("navigateTo", navigate)
  overrideNuxtRoute({ params: { id: "1" } })

  const wrapper = await mountSuspended(ItemPage)
  await wrapper.get("button").trigger("click")

  expect(navigate).toHaveBeenCalledWith("/items/1/edit")
})
```

Overrides apply to the current test only; the cleanup clears them.
Do not set them at the top level of a test file: the file is collected before the app starts, and the override would outlive the test.

Use a fallback for behavior that the app needs while it starts.
First add `useUser` and its type to `TestNuxtImports`, as in the setup file above, then:

```ts
// testing/nuxt/setup.ts
mockNuxtImport(
  "useUser",
  overridableNuxtImport("useUser", () => ref(null)),
)
```

Plugins and other startup code call auto-imports before any test hook runs, so only a fallback applies to them.

### `overridableNuxtImport(name, fallback?)`

```ts
overridableNuxtImport(name, fallback?): (original) => wrapper
```

Creates the `mockNuxtImport` factory; `mockNuxtImport` is a compile-time macro, so its calls stay in your project setup file.
The wrapper calls the current test's override, or otherwise `fallback` if given, or the original import, preserving `this` and arguments.

The project augments `TestNuxtImports` once, mapping import names to their types.
`overridableNuxtImport` and `overrideNuxtImport` accept only registered names, and implementations are typed by the registry.

The factory can run during hoisted mock evaluation: it does not initialize Nuxt or import the mocked modules.
When a mock factory is evaluated again, it returns the wrapper that the app already holds.

### `overrideNuxtImport(name, implementation)`

Overrides the import for the current test.
It throws when no wrapper for `name` was installed, so a missing `mockNuxtImport` line does not look like a working override.

### `overrideNuxtRoute(route)`

Makes the `useRoute` wrapper return exactly `route`, a `Partial` of the registered `useRoute` return type, for the current test.
It requires `useRoute` in `TestNuxtImports` and an overridable `useRoute` mock.

- It does not navigate or sync the real router.
- It does not merge `route` with the real route: missing fields are not filled in, and the object does not satisfy the full `useRoute` contract.
- Mounted components do not react to it; set it before mounting.

## Project resets

```ts
registerNuxtTestReset(key: string, reset: () => unknown): () => void
```

Registers a reset that runs after each test, see step 6 of the [cleanup](#cleanup).
Use it for application resources that the library does not know about, such as test API clients, subscriptions, and caches:

```ts
// testing/nuxt/setup.ts
import { registerNuxtTestReset } from "nuxt-vitest-shared-app"

import { testApiClient } from "./api-client"

registerNuxtTestReset("api-client", () => testApiClient.reset())
```

Registering the same key again replaces the callback and keeps its position, so a setup file that runs for every test file does not accumulate registrations.
The returned function removes the registration, unless it has already been replaced.

## Worker state

```ts
getOrCreateWorkerState<T>(name: string, create: () => T): T
```

Returns state bound to the current Nuxt environment, creating it on first use.
Use it for project helpers whose state must survive module re-evaluation between files, such as a test API client that the started app also uses.

## DOM helpers

```ts
import { stubVisibleIntersectionObserver } from "nuxt-vitest-shared-app/dom"
import { beforeEach } from "vitest"

beforeEach(() => {
  stubVisibleIntersectionObserver()
})
```

Stubs the global `IntersectionObserver` with one that reports each observed element as visible immediately in `observe()`, because happy-dom and the `@nuxt/test-utils` mock never call the observer callback.
It accepts elements and the environment's `window` and `document`, which VueUse passes for window scrolling, e.g. in `useInfiniteScroll(window)`; they are measured as `document.documentElement` and reported as the entry `target` unchanged.
Any other target throws a `TypeError`.
Entries include `time`, which vueuse `useElementVisibility` uses to pick the latest entry.
The stub is installed with `vi.stubGlobal`, so the cleanup removes it after the test; install it in `beforeEach` or in the test itself.

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

Watch mode is not tested; the guarantees in this document apply to `vitest run`.

### Tests run sequentially within a worker

All tests of a worker share one app, so they must not run concurrently.
Parallelism across workers is supported: each worker has its own environment and its own app.

### Module cache

Modules are evaluated once per environment and stay cached for the following files.
A singleton created by a plugin at startup is the same instance that components and test files see in every file of the worker.
Only the first file of an environment, or the next file after a failed startup, starts from a clean module graph.

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

If a cleanup step throws or rejects, the remaining steps still run.
Failures are reported with their step names, and all collected errors are preserved.

If the cleanup does not finish within the Vitest hook timeout, e.g. because a project reset never settles, Vitest does not cancel it, and it may still change state later.
The library then restores real timers, envs, and globals right away, because project `afterEach` and `afterAll` hooks still run, but the other remaining steps are not guaranteed to run.
A test that times out is treated the same way, because its asynchronous work may continue after Vitest stops waiting for it; its cleanup still runs.

After a failed or timed out cleanup or a timed out test, the environment is in an unknown state, even if the pending work finishes later.
Every following test in it fails with an error that references the original failure, and following files fail before their own `beforeAll` hooks.
There is no recovery in this version.

### Failed startup

If Nuxt startup fails, the file fails with the original error, and a partially created app is unmounted.
Nuxt itself catches errors of plugins during startup and continues with a partially initialized app; the library treats such an error as a startup failure too, and reports it with the Nuxt error as its cause.
If unmounting fails too, both errors are reported together in an `AggregateError`, the original one first.
The next file of the worker tries the startup again from a clean module graph.

## Startup-sensitive tests

Tests that need startup plugins re-initialized, a different runtime config, or other startup options cannot share the app.
Put them in a separate Vitest config with normal isolation and run it with its own command, because the shared-app config does not support Vitest projects:

```ts
// vitest.isolated.config.ts
import { defineVitestConfig } from "@nuxt/test-utils/config"

export default defineVitestConfig({
  test: {
    include: ["**/*.isolated.vitest.ts"],
    environment: "nuxt",
  },
})
```

```sh
vitest run
vitest run --config vitest.isolated.config.ts
```

Exclude the isolated files from the shared-app config.

## Compatibility and upstream

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
Upstream work on native reuse is tracked in [nuxt/test-utils#1750](https://github.com/nuxt/test-utils/issues/1750) and [nuxt/test-utils#1821](https://github.com/nuxt/test-utils/pull/1821).

[untestutils](https://github.com/s00d/untestutils) is a test harness whose Nuxt unit environment (`environment: "untestutils"`) has the same per-file startup.
Worker-scoped app reuse there is requested in [s00d/untestutils#1](https://github.com/s00d/untestutils/issues/1).
This library supports only `@nuxt/test-utils` for now; untestutils support may be added later, natively if that request is implemented.
