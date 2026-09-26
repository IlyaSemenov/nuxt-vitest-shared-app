// Installs the packed package into a Nuxt project outside the repository and runs its tests and type check.
//
// Run `bun run build` first.

import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dir, "../..")
const workspace = await mkdtemp(join(tmpdir(), "nuxt-vitest-shared-app-consumer-"))
const project = join(workspace, "project")

async function run(command: string[], cwd: string) {
  const child = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit" })
  if ((await child.exited) !== 0) throw new Error(`Command failed: ${command.join(" ")}`)
}

try {
  await run(["npm", "pack", "--pack-destination", workspace], root)
  const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"))
  const { version } = rootPackage as { version: string }
  const tarball = join(workspace, `nuxt-vitest-shared-app-${version}.tgz`)

  await cp(join(import.meta.dir, "project"), project, { recursive: true })
  // The host versions installed in the repository, so a version matrix applies to both.
  const hostVersions = Object.fromEntries(
    await Promise.all(
      ["@nuxt/test-utils", "@vue/test-utils", "happy-dom", "nuxt", "vitest", "vue"].map(
        async (name) => {
          const manifest = join(root, "node_modules", name, "package.json")
          const { version } = JSON.parse(await readFile(manifest, "utf8")) as { version: string }
          return [name, version]
        },
      ),
    ),
  )
  // vue-tsc does not support TypeScript 7 yet.
  const typeCheckVersions = { typescript: "~5.9.3", "vue-tsc": "^3.3.11" }
  await writeFile(
    join(project, "package.json"),
    JSON.stringify(
      {
        name: "consumer",
        private: true,
        type: "module",
        devDependencies: {
          ...hostVersions,
          ...typeCheckVersions,
          "nuxt-vitest-shared-app": `file:${tarball}`,
        },
      },
      null,
      2,
    ),
  )

  await run(["bun", "install"], project)
  await run(["bunx", "nuxt", "prepare"], project)
  await run(["bunx", "vitest", "run"], project)
  // Checks declarations, subpath exports and the TestNuxtImports augmentation in tests/nuxt.
  const typeCheck = ["bunx", "vue-tsc", "--noEmit", "-p", ".nuxt/tsconfig.app.json"]
  const files = Bun.spawnSync([...typeCheck, "--listFilesOnly"], { cwd: project }).stdout.toString()
  if (!files.includes("/tests/nuxt/overrides.vitest.ts")) {
    throw new Error("The type check does not include the consumer tests")
  }
  await run(typeCheck, project)
} finally {
  await rm(workspace, { recursive: true, force: true })
}
