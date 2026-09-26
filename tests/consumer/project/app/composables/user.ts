export function useUser() {
  return ref<{ name: string } | null>({ name: "real" })
}
