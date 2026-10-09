---
"nuxt-vitest-shared-app": patch
---

Restore real timers at the start of the cleanup, so a test that leaves fake timers on no longer hangs the cleanup, e.g. while navigating back to the route baseline.
