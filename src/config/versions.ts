/** The first `@nuxt/test-utils` release that starts Nuxt once per worker with `isolate: false`. */
const MIN_VERSION = [4, 3, 3] as const

/**
 * Checks that the installed `@nuxt/test-utils` version reuses the Nuxt app across test files.
 *
 * @throws For older versions, their prereleases, and versions that cannot be parsed.
 */
export function assertSupportedTestUtils(version: string) {
  // Build metadata does not affect precedence.
  const match = /^(\d+)\.(\d+)\.(\d+)(-[^+]+)?(\+.+)?$/.exec(version)
  const parts = match ? match.slice(1, 4).map(Number) : []
  const index = parts.findIndex((part, i) => part !== MIN_VERSION[i])
  const order = index === -1 ? 0 : parts[index]! - MIN_VERSION[index]!
  if (!match || order < 0 || (order === 0 && match[4])) {
    // Releases 4.3.0–4.3.2 start Nuxt in every file; the 0.2 line of this library replaces their runtime entry.
    const legacyLine = match && !match[4] && !match[5] && parts[0] === 4 && parts[1] === 3
    throw new Error(
      `nuxt-vitest-shared-app: @nuxt/test-utils ${version} is not supported. Install @nuxt/test-utils ${MIN_VERSION.join(".")} or later${legacyLine ? `, or use nuxt-vitest-shared-app 0.2.x with @nuxt/test-utils ${version}` : ""}.`,
    )
  }
}
