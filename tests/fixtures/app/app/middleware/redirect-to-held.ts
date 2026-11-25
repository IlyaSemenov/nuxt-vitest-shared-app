export default defineNuxtRouteMiddleware(to =>
  navigateTo({ path: "/held", query: { returnTo: to.fullPath } }),
)
