# nuxt-vitest-shared-app

## 0.4.1

### Patch Changes

- 274f6fe: Run tests when `@nuxt/test-utils`, `nuxt`, or the library are installed outside the workspace root detected by Vite, e.g. in the package store of an outer workspace.

## 0.4.0

### Minor Changes

- 9df010f: `stubVisibleIntersectionObserver()` returns a function that changes the visibility of observed targets during the test.

## 0.3.0

### Minor Changes

- 0595269: Add `mountNuxtComposable()`, which runs a composable in a component mounted in the shared app without navigating.
- 0595269: Export `stubVisibleIntersectionObserver` from the package root and remove the `nuxt-vitest-shared-app/dom` entry point.
- 5c71d1c: Require `@nuxt/test-utils` 4.3.3 or later and use its own Nuxt app reuse.

## 0.2.0

### Minor Changes

- a1fc102: Add `onNuxtTestCleanup()` for per-test cleanup callbacks.

## 0.1.1

### Patch Changes

- c42b0c2: Restore real timers at the start of the cleanup, so a test that leaves fake timers on no longer hangs the cleanup, e.g. while navigating back to the route baseline.

## 0.1.0

### Minor Changes

- 986b99c: Initial release: one Nuxt app per Vitest worker shared by its test files, deterministic per-test cleanup with project resets, typed per-test overrides of Nuxt auto-imports, and a visible `IntersectionObserver` stub.
