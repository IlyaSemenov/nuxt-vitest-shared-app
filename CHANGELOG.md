# nuxt-vitest-shared-app

## 0.2.0

### Minor Changes

- a1fc102: Add `onNuxtTestCleanup()` for per-test cleanup callbacks.

## 0.1.1

### Patch Changes

- c42b0c2: Restore real timers at the start of the cleanup, so a test that leaves fake timers on no longer hangs the cleanup, e.g. while navigating back to the route baseline.

## 0.1.0

### Minor Changes

- 986b99c: Initial release: one Nuxt app per Vitest worker shared by its test files, deterministic per-test cleanup with project resets, typed per-test overrides of Nuxt auto-imports, and a visible `IntersectionObserver` stub.
