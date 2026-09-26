/** Available only in a real request, like a request context; tests replace it with a fallback. */
export function useStartupLabel(): string {
  throw new Error("useStartupLabel is not available in tests")
}
