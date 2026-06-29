import { defineConfig } from "vite"
import injectCss from "vite-plugin-css-injected-by-js"
import { svelte } from "@sveltejs/vite-plugin-svelte"
export default defineConfig({
  root: "plugins/joke-fetcher/frontend",
  plugins: [svelte({ compilerOptions: { customElement: true } }), injectCss()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: { entry: "index.js", formats: ["iife"], name: "Widget", fileName: () => "joke-widget.js" },
    outDir: ".",
    emptyOutDir: false,
  }
})