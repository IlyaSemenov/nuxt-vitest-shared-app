// Calls an overridable auto-import while the app starts, before any test hook runs.
export default defineNuxtPlugin(() => {
  return { provide: { startupLabel: useStartupLabel() } }
})
