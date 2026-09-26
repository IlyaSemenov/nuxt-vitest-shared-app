import { vi } from "vitest"

/**
 * Stubs the global `IntersectionObserver` with one that reports every observed target as visible immediately in `observe()`.
 *
 * happy-dom and the `@nuxt/test-utils` mock never call the observer callback, so components that wait for visibility never render their content.
 * The stub is installed with `vi.stubGlobal`, so the per-test cleanup removes it.
 */
export function stubVisibleIntersectionObserver(): void {
  vi.stubGlobal("IntersectionObserver", VisibleIntersectionObserver)
}

class VisibleIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null
  readonly rootMargin: string
  readonly scrollMargin = "0px"
  readonly thresholds: readonly number[]
  readonly #callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.#callback = callback
    this.root = options.root ?? null
    this.rootMargin = options.rootMargin ?? "0px"
    const threshold = options.threshold ?? 0
    this.thresholds = Array.isArray(threshold) ? threshold : [threshold]
  }

  observe(target: Element): void {
    const rect = target.getBoundingClientRect()
    const entry: IntersectionObserverEntry = {
      target,
      isIntersecting: true,
      intersectionRatio: 1,
      boundingClientRect: rect,
      intersectionRect: rect,
      rootBounds: null,
      // vueuse `useElementVisibility` keeps the entry with the latest `time`.
      time: performance.now(),
    }
    this.#callback([entry], this)
  }

  unobserve(): void {}

  disconnect(): void {}

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}
