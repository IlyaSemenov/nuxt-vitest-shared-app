import { execFileSync } from "node:child_process"

import { fixtureDir, rootDir } from "./fixture"

/** Generates the fixture's `.nuxt` directory, whose tsconfig files the fixture runs need. */
export default function prepareFixture() {
  execFileSync(process.execPath, [`${rootDir}/node_modules/nuxt/bin/nuxt.mjs`, "prepare"], {
    cwd: fixtureDir,
    stdio: "ignore",
  })
}
