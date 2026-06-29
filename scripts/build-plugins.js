import { $ } from "bun"
import { existsSync, readdirSync, unlinkSync, writeFileSync, statSync } from "fs"
import { join } from "path"

// -- Framework map: extension -> Vite plugin config --
// Add new frameworks here. That's all you need to do.
const FRAMEWORKS = {
  vue: {
    extensions: ["vue"],
    import: 'import vue from "@vitejs/plugin-vue"',
    plugin: "vue()",
  },
  svelte: {
    extensions: ["svelte"],
    import: 'import { svelte } from "@sveltejs/vite-plugin-svelte"',
    plugin: "svelte({ compilerOptions: { customElement: true } })",
  },
  react: {
    extensions: ["jsx", "tsx"],
    detect: ['"react"', "'react'", '"react-dom"', "'react-dom'"],
    import: 'import react from "@vitejs/plugin-react"',
    plugin: "react()",
    entry: (tag, file) =>
      [
        `import "./style.css"`,
        `import Component from "./${file}"`,
        `import { createRoot } from "react-dom/client"`,
        `customElements.define("${tag}", class extends HTMLElement {`,
        `  root = null`,
        `  _item = null`,
        `  _manifests = null`,
        `  connectedCallback() {`,
        `    try { this.root = createRoot(this); this._render() }`,
        `    catch (e) { this.innerHTML = \`<p style="color:red">WC error: \${e}</p>\` }`,
        `  }`,
        `  disconnectedCallback() { this.root?.unmount(); this.root = null }`,
        `  set item(d) { this._item = d; this._render() }`,
        `  set manifests(d) { this._manifests = d; this._render() }`,
        `  _render() {`,
        `    if (!this.root) return`,
        `    this.root.render(<Component item={this._item} manifests={this._manifests} />)`,
        `  }`,
        `})`,
      ].join("\n"),
  },
  preact: {
    extensions: ["jsx", "tsx"],
    detect: ['"preact"', "'preact'", '"preact/hooks"', "'preact/hooks'"],
    import: 'import preact from "@preact/preset-vite"',
    plugin: "preact()",
    entry: (tag, file) =>
      [
        `import "./style.css"`,
        `import Component from "./${file}"`,
        `import { render } from "preact"`,
        `customElements.define("${tag}", class extends HTMLElement {`,
        `  _item = null`,
        `  _manifests = null`,
        `  connectedCallback() {`,
        `    try { this._render() }`,
        `    catch (e) { this.innerHTML = \`<p style="color:red">WC error: \${e}</p>\` }`,
        `  }`,
        `  disconnectedCallback() { render(null, this) }`,
        `  set item(d) { this._item = d; this._render() }`,
        `  set manifests(d) { this._manifests = d; this._render() }`,
        `  _render() {`,
        `    render(<Component item={this._item} manifests={this._manifests} />, this)`,
        `  }`,
        `})`,
      ].join("\n"),
  },
};

const extMap = {}
for (const [name, fw] of Object.entries(FRAMEWORKS)) {
  for (const ext of fw.extensions) {
    if (!extMap[ext]) extMap[ext] = []
    extMap[ext].push(name)
  }
}


function needsRebuild(input, output) {
  if (!existsSync(output)) return true
  return statSync(output).mtime < statSync(input).mtime 
}

const frontends = readdirSync("plugins")
  .map(name => join("plugins", name, "frontend"))
  .filter(dir => existsSync(dir) && readdirSync(dir).length > 0)

for (const dir of frontends) {
  const files = readdirSync(dir)

  for (const file of files) {
    const ext = file.split(".").pop()
    const candidates = extMap[ext]
    if (!candidates) continue
    const content = ext === "vue" || ext === 'svelte' ? '' : await Bun.file(join(dir, file)).text()
    const fwName = candidates.length === 1
      ? candidates[0]
      : candidates.find(n => FRAMEWORKS[n].detect?.some(s => content.includes(s))) ?? candidates[0]
    const fw = FRAMEWORKS[fwName]

    const name = file.replace("." + ext, "");
    const input = join(dir, file);
    const output = join(dir, name + ".js");
    if (!needsRebuild(input, output)) {
      console.log(` skip ${file}`);
      continue;
    }

    console.log(`vite: ${join(dir, file)} =>${output}`);

    // Read plugin.json for the Web Component tag name
    const pluginDir = join(dir, "..");
    const pluginJsonPath = join(pluginDir, "plugin.json");
    const manifest = JSON.parse(await Bun.file(pluginJsonPath).text())
    const tag = manifest.frontendComponent || manifest.ui || manifest.feeds?.card || name

    // Temp files
    const configFile = join(dir, ".vite.config.mjs");
    const cssFile = join(dir, "style.css");
    const entryFile = join(dir, "entry.tsx");

    // Step 1: CSS (Tailwind available for ALL frameworks)
    writeFileSync(
      cssFile,
      "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
    );

    // Step 2: entry.tsx - wraps React/Preact components as Web Components
    if (fw.entry) writeFileSync(entryFile, fw.entry(tag, file))

    // Step 3: Vite config
    const libEntry = fw.entry ? '"entry.tsx"' : '"index.js"';
    writeFileSync(
      configFile,
      [
        `import { defineConfig } from "vite"`,
        `import injectCss from "vite-plugin-css-injected-by-js"`,
        fw.import,
        `export default defineConfig({`,
        `  root: ${JSON.stringify(dir)},`,
        `  plugins: [${fw.plugin}, injectCss()],`,
        `  define: { 'process.env.NODE_ENV': JSON.stringify('production') },`,
        `  build: {`,
        `    lib: { entry: ${libEntry}, formats: ["iife"], name: "Widget", fileName: () => ${JSON.stringify(name + ".js")} },`,
        `    outDir: ${JSON.stringify(".")},`,
        `    emptyOutDir: false,`,
        `  }`,
        `})`,
      ].join("\n"),
    );

    // Step 4: Build
    await $`bunx vite build --config ${configFile}`;

    // Step 5: Cleanup temp files
    unlinkSync(configFile);
    if (fw.entry) unlinkSync(entryFile);
    unlinkSync(cssFile);
  }
}

console.log("done")