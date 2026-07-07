import { $ } from "bun";
import {
  existsSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
  statSync,
  mkdirSync,
} from "fs";
import { join } from "path";

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

const extMap = {};
for (const [name, fw] of Object.entries(FRAMEWORKS)) {
  for (const ext of fw.extensions) {
    if (!extMap[ext]) extMap[ext] = [];
    extMap[ext].push(name);
  }
}

function needsRebuild(input, output) {
  if (!existsSync(output)) return true;
  return statSync(output).mtime < statSync(input).mtime;
}

function findPluginDirs(dir) {
  const dirs = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (existsSync(join(path, "plugin.json"))) dirs.push(path);
      dirs.push(...findPluginDirs(path));
    }
  }
  return dirs;
}

const buildDir = join(process.cwd(), "build", "plugins");
if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true });

const pluginDirs = findPluginDirs("plugins");
for (const dir of pluginDirs) {
  const manifest = JSON.parse(await Bun.file(join(dir, "plugin.json")).text());
  const tags = new Set();
  if (manifest.ui) tags.add(manifest.ui)
  if (manifest.components) manifest.components.forEach(t => tags.add(t))
  if (manifest.feeds)
    for (const f of manifest.feeds) if (f.card) tags.add(f.card)
  if (manifest.feeds)
    for (const f of manifest.feeds) if (f.card) tags.add(f.card);

  for (const tag of tags) {
    let file = null;
    let ext = "";
    for (const candidate of ["tsx", "jsx", "vue", "svelte"]) {
      const p = join(dir, `${tag}.${candidate}`);
      if (existsSync(p)) {
        file = p;
        ext = candidate;
        break;
      }
    }
    if (!file) {
      console.log(`  skip ${tag} (source not found in ${dir})`);
      continue;
    }

    const output = join(buildDir, tag + ".js");
    if (!needsRebuild(file, output)) {
      console.log(`  skip ${tag}`);
      continue;
    }

    console.log(`vite: ${file} => ${output}`);

    const content =
      ext === "vue" || ext === "svelte" ? "" : await Bun.file(file).text();
    const candidates = extMap[ext] || [];
    const fwName =
      candidates.length === 1
        ? candidates[0]
        : (candidates.find((n) =>
            FRAMEWORKS[n].detect?.some((s) => content.includes(s)),
          ) ?? candidates[0]);
    const fw = FRAMEWORKS[fwName];

    const configFile = join(dir, ".vite.config.mjs");
    const cssFile = join(dir, "style.css");
    const entryFile = join(dir, "entry.tsx");

    writeFileSync(
      cssFile,
      "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
    );
    if (fw.entry) writeFileSync(entryFile, fw.entry(tag, tag + "." + ext));

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
        `    lib: { entry: ${libEntry}, formats: ["iife"], name: "Widget", fileName: () => ${JSON.stringify(tag + ".js")} },`,
        `    outDir: ${JSON.stringify(buildDir)},`,
        `    emptyOutDir: false,`,
        `  }`,
        `})`,
      ].join("\n"),
    );

    await $`bunx vite build --config ${configFile}`;

    unlinkSync(configFile);
    if (fw.entry) unlinkSync(entryFile);
    unlinkSync(cssFile);
  }
}

console.log("done");
