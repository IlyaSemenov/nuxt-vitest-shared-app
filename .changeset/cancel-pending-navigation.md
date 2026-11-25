---
"nuxt-vitest-shared-app": patch
---

Fix `mountSuspended` hanging under fake timers after an earlier test left a navigation unfinished, e.g. by clicking a `NuxtLink`.
