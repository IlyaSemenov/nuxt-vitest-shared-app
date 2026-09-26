// A window subscription released on app unmount; a stale app left behind by a failed startup would duplicate it.
export default defineNuxtPlugin((nuxtApp) => {
  const onPing = () => {
    window.__pings = (window.__pings ?? 0) + 1
  }
  window.addEventListener("probe:ping", onPing)
  nuxtApp.vueApp.onUnmount(() => {
    // Unmount callbacks may use the app context, also during a startup rollback.
    useNuxtApp()
    window.removeEventListener("probe:ping", onPing)
  })
})
