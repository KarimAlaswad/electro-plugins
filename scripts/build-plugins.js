import { $ } from "bun"
import { existsSync, readdirSync, unlinkSync, writeFileSync } from "fs"
import { join } from "path"

const frontends = readdirSync("plugins")
  .map(name => join("plugins", name, "frontend"))
  .filter(dir => existsSync(dir) && readdirSync(dir).length > 0)

for (const dir of frontends) {
  const files = readdirSync(dir)

  // .jsx files => esbuild
  for (const file of files.filter(f => f.endsWith(".jsx"))) {
    const input = join(dir, file)
    const output = join(dir, file.replace(".jsx", ".js"))
    console.log(`esbuild: ${input} => ${output}`)
    await $`esbuild ${input} --bundle --outfile=${output}`
  }

  // .vue files => Vite
  for (const file of files.filter(f => f.endsWith(".vue"))) {
    const name = file.replace(".vue", "")
    const configFile = join(dir, ".vite.config.mjs")
    writeFileSync(configFile, [
      `import { defineConfig } from "vite"`,
      `import vue from "@vitejs/plugin-vue"`,
      `export default defineConfig({`,
      `  root: ${JSON.stringify(dir)},`,
      `  plugins: [vue()],`,
      `  build: {`,
      `    lib: {`,
      `      entry: ${JSON.stringify("index.js")},`,
      `      formats: ["iife"],`,
      `      name: "Widget",`,
      `      fileName: () => ${JSON.stringify(name + ".js")},`,
      `    },`,
      `    outDir: ${JSON.stringify(".")},`,
      `    emptyOutDir: false,`,
      `  }`,
      `})`,
    ].join("\n"));
    console.log(`vite: ${join(dir, file)} => ${join(dir, name + ".js")}`)
    await $`npx vite build --config ${configFile}`
    unlinkSync(configFile)
  }
}

console.log("done")