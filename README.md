# nuxt-vitest-shared-app

Run Nuxt component tests in Vitest on one shared Nuxt app per worker, with deterministic per-test cleanup and typed per-test overrides of Nuxt auto-imports.

With `isolate: false`, `@nuxt/test-utils` 4.3.3 and later start Nuxt once per Vitest worker and run all its test files on that app, instead of starting Nuxt for every test file.
In a project with many small component test files, this removes most of the run time.

The shared app also keeps whatever each test leaves behind:

- mounted wrappers, the current route, Nuxt state and data, and errors;
- nodes appended to `document.body`, `localStorage`, `sessionStorage`, and cookies;
- fake timers, stubbed globals, and envs;
- module mocks: `mockNuxtImport` in a later file does not change references that the started app already captured.

Tests that passed with per-file startup start to depend on each other and on the order of files.
This library replaces `defineVitestConfig` and makes the shared app predictable.
You keep the `@nuxt/test-utils` API you know (`environment: "nuxt"`, `mountSuspended`, `mockNuxtImport`) and get:

- deterministic cleanup of documented Nuxt and test-owned state after each test, with hooks for your own resources;
- typed per-test overrides of Nuxt auto-imports;
- checks of the config and of the running app, rejection of concurrent tests, and failing fast after a cleanup leaves the environment in an unknown state.

It does not reset the whole app state.
State created by startup plugins is not re-created between tests or files.
Tests that need plugins re-initialized or a different startup config belong in a [separate Vitest config](#startup-sensitive-tests).

## Install

```sh
npm install -D nuxt-vitest-shared-app
```

Supported versions:

| Package            | Versions                 |
| ------------------ | ------------------------ |
| `@nuxt/test-utils` | 4.3.3 and later 4.x      |
| `nuxt`             | 4.4.2 and later 4.x      |
| `vitest`           | 4.1.0 and later 4.x, 5.x |
| `vue`              | 3.5.30 and later 3.x     |
| `@vue/test-utils`  | 2.4.2 and later 2.x      |
| `happy-dom`        | 20.0.11 and later        |

CI runs the whole suite with the lowest listed versions, with the versions pinned in the lockfile, and with the latest compatible Vitest 4 release.
jsdom is not supported in this version.
For `@nuxt/test-utils` 4.3.0–4.3.2, use `nuxt-vitest-shared-app` 0.2.x.

## Quick start

Replace `defineVitestConfig` with `defineSharedNuxtVitestConfig` in the Vitest config of your Nuxt component tests:

```ts
// vitest.config.ts
import { defineSharedNuxtVitestConfig } from "nuxt-vitest-shared-app/config"

export default defineSharedNuxtVitestConfig({
  test: {
    include: ["test/nuxt/**/*.test.ts"],
    environment: "nuxt",
    isolate: false,
  },
})
```

Keep your existing test file patterns and other settings.
Existing `mountSuspended` tests run on the shared app as they are.

After each test, the library unmounts wrappers, restores timers, stubbed globals, and envs, clears Nuxt data and state, storage, and cookies, and navigates back to the initial route; see [Cleanup](#cleanup) for the full list.

Add a project setup file only when you need [per-test overrides](#overriding-auto-imports-per-test) or [project resets](#project-resets).
If some tests start failing or depend on the order of files, see [Switching from per-file startup](#switching-from-per-file-startup).

### Config checks

The wrapper passes the config to `defineVitestConfig` from `@nuxt/test-utils/config`, adds the library lifecycle, and checks the settings a shared app relies on:

- `@nuxt/test-utils` must be 4.3.3 or later, because older releases start Nuxt in every test file;
- `test.environment` must be `"nuxt"` at the top level; Vitest projects and browser mode are not supported;
- `test.isolate` must be `false`;
- `test.pool` must be `"threads"` or `"forks"`; `isolate` has no effect in the VM pools;
- `test.sequence.setupFiles` is set to `"list"`, and `"parallel"` is rejected;
- `test.sequence.hooks: "parallel"` and `test.sequence.concurrent: true` are rejected.

### Options

The second argument takes options:

```ts
defineSharedNuxtVitestConfig(config, { silenceSuspenseInfo: true })
```

With `silenceSuspenseInfo: true`, Vue's `<Suspense> is an experimental feature and its API will likely change.` message, which every `mountSuspended` call prints, is filtered through `test.onConsoleLog`; your own `onConsoleLog` still receives all other messages.

## Switching from per-file startup

With per-file startup (`isolate: true`, the Vitest default), every test file starts from fresh modules and globals.
With a shared app, modules stay cached for the following files of the worker, so objects created at module level live for the whole environment.
Tests that passed with per-file startup may rely on that implicitly and start to depend on the order of files.

A typical case is a global replaced by one test file.
It affects every file that runs after it in the worker, including objects that other modules already created from the previous global.
For example, a test file that imports a forced `Intl` polyfill replaces the global constructor, while a formatter created earlier at module level still belongs to the previous implementation.

- Install global polyfills once in a project setup file, before components are imported, and prefer polyfills that keep an existing implementation.
- Do not replace global constructors with side-effect imports in individual test files.
- Review module-level objects that depend on such globals, such as formatters, clients, and caches.
- Run the suite on one worker with shuffled files, so all files share one environment in a different order, e.g. `vitest run --maxWorkers=1 --sequence.shuffle.files --sequence.seed=1`.

Remove `enableAutoUnmount` calls from project setup files: the library installs its own, and `@vue/test-utils` throws on a second call.
Hooks that clean up what the library [cleans up](#cleanup) keep working, and you can remove them.

## Overriding auto-imports per test

Swap a Nuxt auto-import for one test with `overrideNuxtImport`, or fake the current route with `overrideNuxtRoute`:

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

Tests can override only imports that the project registered once in a setup file:

```ts
// vitest.config.ts
export default defineSharedNuxtVitestConfig({
  test: {
    // ...
    setupFiles: ["./test/nuxt/setup.ts"],
  },
})
```

```ts
// test/nuxt/setup.ts
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

A module mock registered again in a later file does not change references that the started app already captured.
So the setup file installs a stable wrapper once with `mockNuxtImport`, and tests swap its implementation.

### Fallback for startup code

Plugins and other startup code call auto-imports before any test hook runs, so only a fallback applies to them.
First add `useUser` and its type to `TestNuxtImports`, as in the setup file above, then:

```ts
// test/nuxt/setup.ts
mockNuxtImport(
  "useUser",
  overridableNuxtImport("useUser", () => ref(null)),
)
```

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

## Resetting your own state

The built-in [cleanup](#cleanup) covers Nuxt and test-owned state.
For your application's resources, pick by lifetime:

- [`onNuxtTestCleanup`](#test-cleanups) undoes what one test changed;
- [`registerNuxtTestReset`](#project-resets) resets a resource after every test, whether or not the test changed it;
- [`getOrCreateWorkerState`](#worker-state) keeps a helper's state for the whole worker.

### Test cleanups

```ts
onNuxtTestCleanup(cleanup: () => unknown): void
```

Registers a cleanup callback for the current test.
Use it in project test helpers that change app state the library does not restore:

```ts
// test/nuxt/feature-flags.ts
import { onNuxtTestCleanup } from "nuxt-vitest-shared-app"

import { featureFlags } from "~/services/feature-flags"

export function enableTestFeature(name: string) {
  featureFlags.enable(name)
  onNuxtTestCleanup(() => featureFlags.disable(name))
}
```

Call it in the test, in `beforeEach` or `afterEach`, or in a helper called there; the callback belongs to that test.
Callbacks run in the cleanup after the test, see step 4 of the [cleanup](#cleanup):

- newest first, each awaited;
- after mounted wrappers are unmounted;
- before the router navigates back to the route baseline;
- while the import overrides of the test still apply.

It throws outside a running test, e.g. at the top level of a file or in `beforeAll`.

### Project resets

```ts
registerNuxtTestReset(key: string, reset: () => unknown): () => void
```

Registers a reset that runs after each test, see step 8 of the [cleanup](#cleanup).
Use it for application resources that the library does not know about, such as test API clients, subscriptions, and caches:

```ts
// test/nuxt/setup.ts
import { registerNuxtTestReset } from "nuxt-vitest-shared-app"

import { testApiClient } from "./api-client"

registerNuxtTestReset("api-client", () => testApiClient.reset())
```

Registering the same key again replaces the callback and keeps its position, so a setup file that runs for every test file does not accumulate registrations.
The returned function removes the registration, unless it has already been replaced.

### Worker state

```ts
getOrCreateWorkerState<T>(name: string, create: () => T): T
```

Returns state bound to the current Nuxt environment, creating it on first use.
Use it for project helpers whose state must survive module re-evaluation between files, such as a test API client that the started app also uses.

## Test helpers

### `mountNuxtComposable(composable)`

```ts
mountNuxtComposable<T>(composable: () => T): Promise<{ result: T; wrapper: VueWrapper }>
```

Calls `composable` in the setup of a component mounted with `mountSuspended`, so it runs with the app's `inject()` and lifecycle hooks, and returns its result with the wrapper of the host component:

```ts
import { mountNuxtComposable } from "nuxt-vitest-shared-app"
import { expect, it } from "vitest"

import { useCounter } from "~/composables/counter"

it("increments the counter", async () => {
  const { result } = await mountNuxtComposable(() => useCounter())
  result.increment()
  expect(result.count.value).toBe(1)
})
```

- It calls `composable` synchronously and does not await its return value: hooks and watchers registered after an `await` are not bound to the host component, and the cleanup does not stop them.
- It rejects with the error `composable` throws.
- It does not navigate: the composable sees the current route, the route baseline or the route the test navigated to.
- The host component is rendered outside `<RouterView>`, so in-component route guards such as `onBeforeRouteLeave` are not registered.
- The cleanup unmounts the host component after the test, which runs the composable's unmount hooks and stops its watchers; call `wrapper.unmount()` to test unmounting within the test.

`mountSuspended` itself navigates to its `route` option, `/` by default, before setup, unless the app is already on that route.
Such a navigation waits for `setTimeout`, so it never finishes under `vi.useFakeTimers()`.
If the current route may differ, e.g. because the index page redirects and the route baseline is not `/`, pass `route: false` or enable fake timers after mounting.

### `stubVisibleIntersectionObserver()`

```ts
import { stubVisibleIntersectionObserver } from "nuxt-vitest-shared-app"
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

## Startup-sensitive tests

Tests that need startup plugins re-initialized, a different runtime config, or other startup options cannot share the app.
Put them in a separate Vitest config with normal isolation and run it with its own command, because the shared-app config does not support Vitest projects:

```ts
// vitest.isolated.config.ts
import { defineVitestConfig } from "@nuxt/test-utils/config"

export default defineVitestConfig({
  test: {
    include: ["test/nuxt-isolated/**/*.test.ts"],
    environment: "nuxt",
  },
})
```

```sh
vitest run
vitest run --config vitest.isolated.config.ts
```

Keep the `include` patterns of the two configs from overlapping, so each file runs in one of them.

## Lifecycle

| What                                                                           | Lifetime                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------- |
| Started app, route baseline, project resets, overridable imports, worker state | The Nuxt environment (its `window`) of the worker |
| Library `beforeAll` / `beforeEach` hooks                                       | One test file                                     |
| Import overrides, test cleanups and per-test resources                         | One test                                          |

`@nuxt/test-utils` starts Nuxt in the first test file of an environment and reuses the app in the following files.
For each test file of a worker, the library then:

1. checks that the Nuxt app is mounted in the current environment's document, and fails the file with a clear error otherwise;
2. captures the route baseline and the direct children of `document.body` once per environment, right after the first successful startup and before any project `beforeAll` or `beforeEach`;
3. fails tests that run concurrently in the worker (`test.concurrent`, `describe.concurrent`);
4. cleans up after each test.

Vitest drops hooks between files even with `isolate: false`, so the lifecycle hooks are registered again for every file.

Library state is bound to the environment's `window` and is never reused by another environment.

Watch mode is not tested; the guarantees in this document apply to `vitest run`.

### Tests run sequentially within a worker

All tests of a worker share one app, so they must not run concurrently.
Parallelism across workers is supported: each worker has its own environment and its own app.

### Module cache

Modules are evaluated once per environment and stay cached for the following files.
A singleton created by a plugin at startup is the same instance that components and test files see in every file of the worker.
Only a file that starts Nuxt starts from a clean module graph.

### Files with another environment

Test files with another environment, such as `// @vitest-environment node`, run without the library lifecycle.
In such files, `overridableNuxtImport` factories return the fallback or the original import, and `registerNuxtTestReset` registers nothing, so the same project setup file works for them.
`overrideNuxtImport`, `overrideNuxtRoute`, `onNuxtTestCleanup` and `getOrCreateWorkerState` throw outside the `nuxt` environment.

## Cleanup

After each test, the library runs these steps in order.
They run after all `afterEach` hooks of the project, also when one of these hooks fails.

1. `vi.clearAllTimers()` and `vi.useRealTimers()`, so the following steps and project resets run under real timers and the test does not need to restore them;
2. unmounts wrappers mounted in the test through `@vue/test-utils` (including `mountSuspended`), using `enableAutoUnmount`;
3. `await nextTick()` and `await flushPromises()`;
4. runs test cleanups registered with `onNuxtTestCleanup` during the test, newest first, awaiting each;
5. navigates the app's own router back to the route baseline with `router.replace` if the route differs, and verifies the resulting route;
6. clears import overrides;
7. `await clearError()`, `clearNuxtData()`, `clearNuxtState(undefined, { reset: false })`;
8. runs project resets registered with `registerNuxtTestReset`, in registration order, awaiting each;
9. `localStorage.clear()`, `sessionStorage.clear()`, and expires every cookie visible in `document.cookie` for path `/` of the current origin;
10. `vi.unstubAllEnvs()` and `vi.unstubAllGlobals()`;
11. removes direct children of `document.body` that were not present at startup.

The exact scope:

- `flushPromises` only settles handlers of promises that are already resolved; subscriptions, requests, and other background work need their own project resets;
- step 5 uses the router instance of the app, never the overridable `useRoute`/`navigateTo`;
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
If Vitest aborts a test because the test, one of its hooks, or an `onTestFinished`/`onTestFailed` callback times out, the environment is rejected the same way, because unfinished asynchronous work may continue after Vitest stops waiting for it; the cleanup of that test still runs.

After a failed or timed out cleanup or an aborted test, the environment is in an unknown state, even if the pending work finishes later.
Every following test in it fails with an error that references the original failure, and following files fail before their own `beforeAll` hooks.
There is no recovery in this version.

### Failed startup

If Nuxt startup fails, the file fails with the original error.
Nuxt itself catches errors of plugins and of mounting during startup and leaves a partially initialized app; the library treats such an error as a startup failure too, reports it with the Nuxt error as its cause, and fails every following file of the environment with an error that references it.
After other startup errors, `@nuxt/test-utils` decides whether the next file retries the startup; when it does not, the following files fail because the Nuxt app is not running.

## Alternatives

[untestutils](https://github.com/s00d/untestutils) is a separate Nuxt test harness that replaces `@nuxt/test-utils`.
Since `@untestutils/nuxt` 0.7.2, its unit environment (`environment: "untestutils"`) can share one Nuxt app per worker with `environmentOptions.nuxt.appIsolation: "worker"`, resets app state between tests, and ships similar per-test override and worker state helpers; see [s00d/untestutils#1](https://github.com/s00d/untestutils/issues/1).

The main differences:

- this library keeps `@nuxt/test-utils` and its `nuxt` environment, while untestutils replaces them;
- here, the shared app and the cleanup always apply, while in untestutils the worker mode is opt-in and resets can be turned off per layer;
- after a failed or timed out cleanup, this library fails every following test of the environment, while untestutils can dispose and restart the shared app;
- this library fails concurrent tests in a worker, while untestutils runs them one at a time with `maxConcurrency: 1`.
