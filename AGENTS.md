# Electro Plugins

Language-agnostic modular desktop app: every feature is a plugin communicating via subprocess stdin/stdout JSON-RPC. Built with Electrobun (Bun/TypeScript desktop framework). Frontend: React + Tailwind + Vite (HMR). Plugin UIs are self-contained Web Components (any framework → IIFE).

---

## Commands

```bash
bun run start                  # build:plugins → vite build → electrobun dev
bun run build:plugins          # rebuild plugin WC frontends only (scripts/build-plugins.ts)
bun run dev:hmr                # recommended dev (concurrent vite hmr + electrobun dev)
bun run hmr                    # vite dev server standalone on port 5173
bun run dev                    # electrobun dev (no HMR, uses bundled assets)
rm -rf build/plugins && bun run build:plugins  # full rebuild (fixes stale builds)
```

### Test plugin standalone (via stdin pipe)

```bash
echo '{"id":1,"method":"feed","params":{}}' | bun plugins/youtube/plugins/yt-feed/main.ts
echo '{"id":1,"method":"status"}' | bun plugins/youtube/plugins/yt-auth/main.ts
echo '{"id":1,"method":"search","params":{"query":"cats"}}' | bun plugins/youtube/plugins/yt-search/main.ts
echo '{"id":1,"method":"list"}' | bun plugins/peertube/main.ts
```

---

## Architecture

```
BrowserView (React + Tailwind + Vite HMR)
  App.tsx → electroview.rpc.request.getPluginManifests()
          → getPluginFrontend("build/plugins/<tag>.js") → <script>
          → document.createElement(tag) for each manifest.ui
          → pass .manifests via DOM property setter

  feed-widget → __pluginRpc("pluginName.method") for each feeds[] source
              → CardRenderer creates <tag> elements, sets .item

Host (src/bun/index.ts) — Bun process, system WebView
  - Recursive scan plugins/**/plugin.json
  - Spawns plugins with run field via Bun.spawn (stdin/stdout pipes)
  - routeRequest: split method on first ".", find by config.name, {id, method, params} → stdin
  - 6 RPC handlers: pluginRequest, pluginList, getPluginManifests, getPluginFrontend, resolveHook, callHook
  - Health check (5s interval, logs dead plugins), SIGINT cleanup

Plugins — any language, readline loop on stdin, write response to stdout
  - {id, method, params} → {id, result} or {id, error}
  - One line per message, newline-delimited
  - Plugin must flush stdout after each response

Data flow:
  getPluginManifests → loadFrontend (build/plugins/<tag>.js) → createElement(tag)
  → feed-widget.manifests = all → __pluginRpc("yt-feed.feed") → items[]
  → CardRenderer: document.createElement(card), el.item = rawData, feedContainer.appendChild(el)
```

---

## Plugin Manifest Schema

| Field | Required | Purpose |
|-------|----------|---------|
| `name` | ✅ | Unique ID, used in RPC routing (first `.` token) |
| `run` | ❌ | `"bun plugins/x/main.ts"` — whitespace-split → cmd+args |
| `methods` | ❌ | RPC method names (e.g. `["feed"]`, `["login","logout"]`) |
| `hooks` | ❌ | Capability tags (e.g. `["feed.video","auth"]`) |
| `ui` | ❌ | WC tag to build AND mount (e.g. `"feed-widget"`) |
| `components` | ❌ | WC tags to build-only, not mount (e.g. `["yt-video-card"]`) |
| `feeds[]` | ❌ | Feed contributions: `{type, method?, card?}` |
| `feeds[].type` | if feeds | Content type string (`"video"`, `"post"`, etc.) |
| `feeds[].method` | if feeds | RPC method; defaults to `methods[0]` |
| `feeds[].card` | if feeds | WC tag for each item; if absent, items are skipped |

Plugin types: **backend-only** (has `run`), **frontend-only** (`ui`/`components`), **fullstack** (`run` + `ui`/`feeds`).

### Current manifests (8 plugins, 4 dirs)

```
plugins/
  feed/                      — frontend-only, ui: "feed-widget"
  youtube/                   — parent container (metadata only)
    plugins/yt-feed/          — backend, run bun, feeds: [{card:"yt-video-card"}]
    plugins/yt-auth/          — backend, run bun, methods: ["login","logout","status"]
    plugins/yt-search/        — backend, run bun, methods: ["search"]
    plugins/yt-card/          — frontend-only, components: ["yt-video-card"]
  peertube/                  — fullstack, feeds: [{card:"peertube-card"}]
  video-player/              — fullstack, ui: "player-modal"
```

---

## Build System Gotchas

`scripts/build-plugins.ts` (191 lines):
- Scans `plugins/**/plugin.json` recursively
- Collects WC tags from `ui`, `components[]`, `feeds[*].card` across all manifests
- For each unique tag: finds source `<dir>/<tag>.<ext>`, auto-detects framework (React/Preact/Vue/Svelte), builds via Vite IIFE → `build/plugins/<tag>.js`
- **Cross-directory source**: build script searches only the declaring plugin's dir. If not found, it **skips silently**. Fix: add `components: ["<tag>"]` to the plugin that owns the source file.
- **Stale builds**: `needsRebuild()` checks mtime. If changes aren't reflected, nuke `build/plugins/` and rebuild.
- **Framework auto-detection**: reads source, checks for `"react"`/`"react-dom"` (React) vs `"preact"`/`"preact/hooks"` (Preact). Falls back to first match.

---

## RPC Protocol

```
Request:  {"id": 1, "method": "pluginName.action", "params": {...}}
Response: {"id": 1, "result": ...}  or  {"id": 1, "error": "..."}
```

- No `jsonrpc` field. Messages are newline-delimited (one JSON per line).
- Host splits method on first `.` → plugin name. Plugin receives the rest (`action`) as-is.
- Plugin reads one line from stdin, writes one line to stdout.
- 10s timeout per request in host `routeRequest`. No response → Promise rejects.
- Host's `BrowserView.defineRPC` has `maxRequestTime: 15000`. Frontend's `Electroview.defineRPC` has `maxRequestTime: 20000`. **Must be outermost > inner** — frontend timeout is the largest.

### Window.__pluginRpc bridge

```typescript
window.__pluginRpc = async (method: string, params: any) => {
  const res = await electroview.rpc.request.pluginRequest({ method, params })
  if (!res.success) throw new Error(res.error || "RPC error")
  return res.data
}
```

App.tsx calls host RPCs directly (getPluginManifests, getPluginFrontend) — not through `__pluginRpc`. The bridge only routes to plugin subprocesses. No `host.*` prefix.

---

## Critical Bug Patterns

1. **RPC timeout layering**: frontend `maxRequestTime: 20000` must be >= host `15000` >= routeRequest `10000` >= plugin internal timeout `8000`. If the frontend timeout fires, the host still gets the response but discards it — silent failure visible only in WebView F12 console.

2. **Single-field conflation**: `ui` controls **both** build and mount. `components` = build only. A card component in `ui` gets mounted as a standalone view (renders nothing, no `item`). Never put cards in `ui`.

3. **Cross-plugin auth resolution**: When a feed source fails with auth error, search ALL manifests for login method — not just the errored source. Auth lives on a separate plugin (yt-auth) from the feed source (yt-feed).

4. **Long-lived process stale state**: Don't cache shared state at module level at startup. Lazy-reload on each request (yt-feed re-reads cookie file at request time, not process start).

5. **Stale builds from cross-directory sources**: Build script only searches the declaring plugin's directory. If a feed references `card: "yt-video-card"` but the .tsx is in yt-card's directory, the build skips it silently. The owning plugin must declare `components: ["yt-video-card"]` to trigger the build.

6. **Subprocess.stdin is FileSink, not WritableStream**: Bun `Subprocess.stdin` returns a `FileSink` when piped. Call `stdin.write(msg)` directly — no `getWriter()`/`releaseLock()`.

---

## File Entrypoints

```
src/bun/index.ts              — host: spawn, route, 6 RPC handlers, health check (~340 lines)
src/mainview/App.tsx          — frontend: manifest fetch, WC loading, imperative createElement (~102 lines)
src/mainview/main.tsx          — React entry (StrictMode, createRoot)
src/mainview/index.html        — HTML shell
src/shared/types.ts            — PluginManifest, FeedContrib, PluginInfo types (~35 lines)
scripts/build-plugins.ts       — build all plugin WCs via Vite IIFE (~191 lines)

plugins/<name>/plugin.json     — plugin manifest
plugins/<name>/main.ts         — backend (if run field present)
plugins/<name>/<tag>.tsx       — frontend WC source (if ui/components/feeds[*].card present)
```

Output: `build/plugins/<tag>.js` for every WC tag across all manifests.
