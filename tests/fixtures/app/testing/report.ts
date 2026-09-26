/** Prints a value for the outer test to read from the fixture output. */
export function report(key: string, value: unknown) {
  console.log(`report:${key} ${JSON.stringify(value)}`)
}
