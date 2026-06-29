# Electro Plugins — Complete Project Knowledge Base

## CRITICAL: The Two-File Rule (ABSOLUTE)
You (the AI agent) may ONLY modify two files:
1. **This file** (`AGENTS.md`) — all project-specific knowledge
2. **`~/.config/opencode/skills/coding/SKILL.md`** — all general coding/teaching rules

NEVER create, edit, or delete any other file in this project. The user does ALL code work.

You MUST update BOTH files with every single prompt — actively check if anything changed
and record it. Never assume "the last agent already handled this." Always verify.
See the "Auto-Update Protocol" section in SKILL.md for the full rule.

---

## Quick Summary
Language-agnostic modular desktop app where every feature is a plugin communicating
via subprocess stdin/stdout JSON-RPC. Built with Electrobun (Bun/TypeScript desktop
framework). Frontend: React + Tailwind + Vite (HMR). Plugins can be any language.
Plugin UIs use Web Components (any framework bundled to self-contained .js).

Phase 1 (Plugin System) is COMPLETE — flat manifests, host manifest scanning at startup,
plugin spawning with stdin/stdout pipes, JSON-RPC routing by method prefix, Web Component
frontends (Preact + Vue), centralized build script (scripts/build-plugins.js).

Phase 2 (YouTube Explorer) is COMPLETE — Bun/TS backend with Innertube API, cookie auth
via browser DB discovery, search + home feed + auth flow, WC frontend with embedded player.

Phase 3 (Unified Feed) is COMPLETE — old per-plugin widget cards removed. App.tsx loads
manifests, injects card frontend scripts, and mounts a single <feed-widget> which discovers
feed-contributing plugins at runtime, calls their feed methods, and renders their card WCs.
Plugin manifest simplified: `run` replaces `command`+`args`, `feeds` block replaces
`frontendComponent`/`frontendFile`/`frontendSlot`. Paths derived from plugin name + tag.
Build script entry templates include `_item` and `_manifests` setters for WC data flow.

Long-term vision: a unified API client that aggregates every internet service by media
type (posts, shorts, videos, DMs, images, etc.) into one app, with community-built
generalized features per media type.

---

## Goal
Build a language-agnostic, fully modular desktop app where every feature is a plugin.
The plugin system is independent of the "skeleton" (the app framework). The same plugins
work on any skeleton — Electrobun (desktop now), Tauri or zero-native (desktop + mobile later).

Long-term vision: a unified API client that aggregates every internet service into one
interface. Content is categorized by MEDIA TYPE (posts, shorts, videos, images, DMs, etc.),
not by service. Users get one feed per media type populated from all the services they
choose. Features are generalized per media type — if someone builds auto-scroll for shorts,
ALL shorts (TikTok, Reels, YT Shorts) get it automatically. This will be built GRADUALLY,
starting with one simple API at a time.

---

## Long-Term Vision — Unified API Client

### The Problem
Currently every internet service has its own dedicated client app:
- NewPipe for YouTube, Alicord for Discord
- Separate apps for Twitter, Instagram, Telegram, Reddit, TikTok
- Different UI, different features, different codebases — no sharing between them

### The Solution: One App for Every API
A single desktop app where every internet service is a plugin.
Content is organized by MEDIA TYPE, not by service.

**Media Type Examples**
- **Posts/Threads**: Reddit posts, Twitter threads, Bluesky, Hacker News stories
- **Shorts**: TikTok, Instagram Reels, YouTube Shorts, Reddit Watch
- **Long Videos**: YouTube, PeerTube, Vimeo, Nebula
- **Images**: Instagram, Flickr, Imgur, 500px
- **DMs/Chat**: Discord DMs, Telegram, Twitter DMs, Instagram DMs
- **Live**: Twitch, YouTube Live, Kick
- **Music**: Spotify, YouTube Music, SoundCloud
- **Books**: Goodreads, Project Gutenberg, Archive.org
- **Shopping**: Amazon, eBay, Etsy — unified product feed
- **Anime/Manga**: MyAnimeList, AniList, Crunchyroll, MangaDex
- **Recipes**: AllRecipes, SeriousEats, NYT Cooking
- ...and anything else — theoretically infinite (one per API endpoint type)

Each media type has one feed in the app. The user adds/removes services from each
feed freely. Adding a new service to a feed gives you ALL that service's content
mixed in with everything else.

### Generalized Features per Media Type
Features attach to the MEDIA TYPE, not the service:
- Auto-scroll for shorts feed → ALL shorts get it (TikTok + Reels + YT Shorts)
- Ad-skip for long videos → ALL long videos get it
- Download for images → ALL images from any service get it
- Translation for posts → ALL posts get it
- Any QoL feature built by the community → works everywhere instantly

No more waiting for YouTube to add a feature you want. No more missing auto-scroll
on Reels while TikTok has it. The community builds features once, and they work for
every service with that media type.

### How We Get There (Gradual)
1. Start with simple individual API plugins (fetch data, show on screen)
2. When multiple plugins produce the same media type → build a unified feed
3. Build generalized features for that media type
4. Repeat for more APIs and media types as interest grows
5. Architecture evolves organically as patterns emerge (no premature abstraction)

**This is a long-term vision, not a right-now requirement. We're prototyping:
building the first real API plugin to fetch internet data and show it on screen.**

---

## Core Architecture

### Current Architecture (Phase 1 Complete)

```
┌──────────────────────────────────────────────────────────────────┐
│  WebView (React + Tailwind + Vite HMR)                           │
│  App.tsx (~152 lines):                                           │
│  - Loads all manifests on mount                                  │
│  - Auto-loads all plugin Web Components via <script> injection   │
│  - Plugin cards with alive/dead badge + method buttons           │
│  - WebComponentSlot renders each plugin's WC directly in card    │
│  - Result display (formatted JSON)                                │
│         │                                                        │
│         │ window.__pluginRpc(method, params)                     │
│         │     → electroview.rpc.request.pluginRequest()          │
│         ▼                                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Host (Bun process — src/bun/index.ts ~272 lines)           │  │
│  │ 1. findProjectRoot() — walks up from import.meta.dir       │  │
│  │ 2. Scans plugins/*/plugin.json via readdirSync + JSON.parse│  │
│  │ 3. resolvePath() — makes relative paths absolute for spawn │  │
│  │ 4. Spawns plugins via Bun.spawn() (stdin/stdout pipes)     │  │
│  │ 5. sendToPlugin() — writes JSON to plugin stdin            │  │
│  │ 6. readStdout() — async reader with line buffering         │  │
│  │ 7. routeRequest() — method prefix match → Promise(10s)     │  │
│  │ 8. 4 RPC handlers: pluginRequest, pluginList,              │  │
│  │    getPluginManifests, getPluginFrontend                    │  │
│  │ 9. Health check (5s), SIGINT cleanup                       │  │
│  └──┬────────────────┬───────────────────────────────────────┘  │
│     │ stdin/stdout   │ stdin/stdout                              │
│  ┌──▼──────────┐  ┌─▼────────────┐                              │
│  │ Go Plugin    │  │ Python       │                              │
│  │ (greet)      │  │ Plugin       │                              │
│  │ greet.hello  │  │ (logger)     │                              │
│  │ greet.bye    │  │ log.info     │                              │
│  │              │  │ log.list     │                              │
│  └──────────────┘  └──────────────┘                              │
│                                                                  │
│  Frontend Plugins (Web Components, injected into WebView):       │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ <greet-widget>    │  │ <log-viewer>     │                     │
│  │ (Preact, esbuild) │  │ (Vue, Vite build)│                     │
│  │ Hello/Bye buttons │  │ Refresh + log    │                     │
│  │ JSON result       │  │ list display     │                     │
│  └──────────────────┘  └──────────────────┘                     │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow (End-to-End)
1. App starts → Host spawns all backend plugins, notes frontend files
2. WebView loads → App.tsx mounts
3. App.tsx calls `getPluginManifests` → gets array of all manifests
4. For each manifest with `frontendComponent`:
   - Call `getPluginFrontend(name)` → returns JS code as string
   - Create `<script>` element, set `textContent` = code, append to `<body>`
   - Script calls `customElements.define()` → Web Component registered globally
   - Render `<WebComponentSlot tag={componentName}>` in plugin card → WC mounts
5. User clicks button in WC → calls `window.__pluginRpc(method, params)`
6. This calls `pluginRequest` RPC → `routeRequest` → `sendToPlugin`
7. Plugin reads stdin line, processes request, writes response to stdout
8. Host reads stdout line, parses JSON, matches by `id`, resolves promise
9. Result flows back through RPC → `window.__pluginRpc` returns → WC re-renders

---

## File Structure (ACCURATE — matches code on disk as of June 2026)

```
/mnt/5TB/Projects/electro-plugins/
├── AGENTS.md                        ← THIS FILE (update every session!)
├── electrobun.config.ts             # Build config (copy rules commented out in dev)
├── vite.config.ts                   # Vite: React plugin, port 5173, root at src/mainview
├── package.json                     # Dependencies + scripts
│   ├─ "start": "bun run build:plugins && vite build && electrobun dev"
│   ├─ "dev": "electrobun dev --watch"
│   ├─ "dev:hmr": "concurrently \"bun run hmr\" \"bun run start\""
│   ├─ "hmr": "vite --port 5173"
│   ├─ "build:plugins": "bun scripts/build-plugins.js"
│   └─ Deps: electrobun 1.18.1, react 18, preact 10, vue 3, vite 6
├── tsconfig.json                    # TypeScript strict mode
├── postcss.config.js                # PostCSS with Tailwind + autoprefixer
├── tailwind.config.js               # Tailwind content: src/mainview/**/*
├── bun.lock                         # Bun lock file
├── .gitignore                       # node_modules/, build/, dist/, artifacts/, greet binary, *.log
│
├── scripts/
│   └── build-plugins.js             # Centralized plugin frontend build (~80 lines)
│       - Scans plugins/*/plugin.json for any field ending in a tag name (ui, feeds.card)
│       - Falls back to scanning plugins/*/frontend/ for .tsx/.jsx/.vue
│       - React/Preact: esbuild --bundle with entry template (has _item/_manifests setters)
│       - Vue: Vite build (IIFE format)
│       - Run: "bun run build:plugins" or auto-runs in "bun run start"
│
├── src/
│   ├── bun/
│   │   └── index.ts                 # HOST (~275 lines)
│   │       - Types: PendingRequest, PluginInstance
│   │       - findProjectRoot(): walks up from import.meta.dir to find package.json
│   │       - resolvePath(): makes relative paths absolute for Bun.spawn args
│   │       - Manifest scanning: readdirSync(plugins/*/plugin.json) → JSON.parse
│   │       - Plugin spawning: Bun.spawn(), push to array, start readers
│   │       - sendToPlugin(): stdin.write() (FileSink, not getWriter)
│   │       - handlePluginResponse(): JSON.parse → match by id → resolve/reject → delete
│   │       - readStdout(): async reader, buffers partial lines across chunks
│   │       - readStderr(): same pattern, logs to console
│   │       - routeRequest(): method prefix match → Promise with 10-second timeout
│   │       - 4 RPC handlers: pluginRequest, pluginList, getPluginManifests, getPluginFrontend
│   │       - getPluginManifests returns all manifests (with ui + feeds fields)
│   │       - getPluginFrontend takes { path: "plugins/x/frontend/y.js" }
│   │       - Reads `run` field (replaces old `command`+`args`)
│   │       - No backward compat with old format
│   │       - All params typed as unknown, cast internally
│   │       - getMainViewUrl(): checks Vite HMR on port 5173, falls back to bundled
│   │       - BrowserWindow creation, health check interval (5s), SIGINT cleanup
│   │
│   ├── mainview/
│   │   ├── App.tsx                  # FRONTEND (~80 lines, simplified)
│   │   │   - Electroview RPC bridge from electrobun/view
│   │   │   - maxRequestTime: 20000 set (CRITICAL)
│   │   │   - window.__pluginRpc() global bridge (simple: routes to pluginRequest, no host.*)
│   │   │   - On mount: loads manifests via electroview.rpc.request.getPluginManifests({})
│   │   │   - Injects card frontend JS for any manifest with feeds.card or ui
│   │   │   - Renders <feed-widget> and passes manifests via .manifests setter
│   │   │   - No WebComponentSlot, no plugin cards, no callMethod, no results box
│   │   ├── main.tsx                 # React entry point (StrictMode, createRoot)
│   │   ├── index.html               # HTML shell (<div id="root"> + <script>)
│   │   └── index.css                # @tailwind base/components/utilities
│   │
│   └── shared/
│       └── types.ts                 # SHARED TYPES (45 lines):
│           - PluginInfo { name, alive, methods }
│           - PluginRequestParams { method, params: any }
│           - PluginRequestResults { success, data?, error? }
│           - FeedContrib { type: string, method: string, card?: string }
│           - PluginManifest { name, version, description, author,
│               run?, methods?, ui?, feeds?: FeedContrib }
│
├── plugins/
│   ├── feed/                        # Phase 3: Feed orchestrator (no backend)
│   │   ├── plugin.json              # { name, description, author, version, ui: "feed-widget" }
│   │   └── frontend/
│   │       └── feed-widget.tsx      # React WC (~210 lines)
│   │           - Uses ReactDOM.createRoot
│   │           - Receives manifests via .manifests setter from App.tsx
│   │           - 5-state machine: loading, system error, empty, partial, loaded
│   │           - For each source with feeds: calls __pluginRpc(source.feeds.method, {})
│   │           - CardRenderer: creates card WC elements, sets .item, uses whenDefined
│   │           - Error banners per-plugin with optional "Sign in" button
│   │           - Auth: calls .auth.login from source methods, reloads feed on success
│   │
│   ├── greet-go/                    # Go plugin demo (Phase 1, backend only)
│   │   ├── plugin.json              # { name, run: "./plugins/greet-go/greet", methods }
│   │   ├── main.go                  # Go backend (~78 lines)
│   │   └── greet                    # Compiled binary (~2MB, in .gitignore)
│   │   NOTE: frontend/ dir removed — greet-widget no longer builds or loads
│   │
│   ├── logger-py/                   # Python plugin demo (Phase 1, backend only)
│   │   ├── plugin.json              # { name, run: "python3 plugins/logger-py/main.py", methods }
│   │   └── main.py                  # Python backend (~49 lines)
│   │   NOTE: frontend/ dir removed — log-viewer no longer builds or loads
│   │
│   ├── joke-fetcher/                # Bun/TS plugin demo (Phase 1, backend only)
│   │   ├── plugin.json              # { name, run, methods }
│   │   └── main.ts                  # Bun/TS backend
│   │   NOTE: frontend/ dir removed — joke-widget no longer builds or loads
│   │
│   └── youtube-explorer/            # YouTube plugin (Phase 2 + Phase 3 feed source)
│       ├── plugin.json              # { run: "bun plugins/youtube-explorer/main.ts",
│       │                              feeds: { type: "video", method: "youtube.feed",
│       │                                       card: "yt-video-card" } }
│       ├── main.ts                  # Backend (~250 lines): Innertube API, cookie auth, feed
│       └── frontend/
│           ├── yt-video-card.tsx    # React card WC (~75 lines)
│           │   - Receives item prop: { thumbnail, title, channel, viewCount, published }
│           │   - Uses _item setter from build template
│           │   - Renders thumbnail img, title H3, channel, views, published date
│           │   - No __pluginRpc calls (pure display)
│           └── youtube-widget.tsx   # DEAD CODE — old standalone widget, still builds, never loaded
│
├── build/                           # Electrobun build output (in .gitignore)
├── dist/                            # Vite build output (in .gitignore)
├── node_modules/                    # (in .gitignore)
└── electro-plugins.log              # Logger plugin output file (in .gitignore)
```

---

## Plugin Protocol (Detailed)

### Message Format
```json
{"id": 1, "method": "greet.hello", "params": {"name": "Niri"}}
```
- `id`: number — unique per request, matched in response
- `method`: string — format is `namespace.action` (e.g., `greet.hello`, `log.info`)
- `params`: optional object — any JSON structure the plugin expects
- NO `jsonrpc` field (simplified from JSON-RPC spec)

### Response Format
```json
{"id": 1, "result": {"message": "Hello Niri from Go!"}}
```
- On success: `{"id": <same id>, "result": <any>}`
- On error:   `{"id": <same id>, "error": "<message>"}`
- Messages are newline-delimited: one JSON object per line (`\n`)

### Protocol Rules
1. Plugin reads exactly one line from stdin
2. Plugin processes the request
3. Plugin writes exactly one line to stdout
4. Plugins MUST flush stdout after writing (`fmt.Println` in Go auto-flushes; Python needs `sys.stdout.flush()`)
5. Host matches response to pending request by `id`
6. If no response within 10 seconds, the Promise rejects with timeout error
7. No connection keepalive, no persistent state between requests (each request is stateless)

### Host Routing Logic
```typescript
for (const plugin of plugins) {
    if (!plugin.alive) continue
    for (const ns of plugin.config.methods) {
        if (method.startsWith(ns)) {
            // Route to this plugin
        }
    }
}
```
- Host checks method PREFIX only (e.g., `"greet."` matches `"greet.hello"` and `"greet.bye"`)
- The specific action (hello vs bye) is handled by the plugin, NOT the host
- Adding 100+ plugins requires zero changes to routing code
- Order matters: first matching plugin in the manifests array wins

---

## Host Behavior (src/bun/index.ts — ~272 lines)

### Startup Sequence
1. Import modules: `BrowserWindow, BrowserView, Updater` from electrobun/bun; `readdirSync, existsSync` from fs; `join` from path; `Subprocess` from bun; `PluginManifest` from shared/types
2. `findProjectRoot(import.meta.dir)` — walks up directory tree until `package.json` found. Works in both dev (flat source files) and production builds (bundled).
3. `baseDir = findProjectRoot(...)` — store the project root absolute path
4. `readdirSync(join(baseDir, "plugins"))` — list all directories in plugins/
5. `filter(name => existsSync(plugin.json))` — keep only directories with a manifest
6. For each matching dir: `Bun.file(...).text()` → `JSON.parse()` → push to `manifests[]`
7. For each manifest with a `"command"` field:
   a. `resolvePath(command)` — if relative (starts with "." or contains "/"), join with baseDir; if absolute, use as-is; if bare name (e.g., "bun", "python3"), return unmodified (looks up in PATH)
   b. `resolvePath(args[])` — same logic for each arg
   c. `Bun.spawn([command, ...args], { stdin: "pipe", stdout: "pipe", stderr: "pipe" })`
   d. Store as `PluginInstance { config: manifest, process: proc, alive: true }`
   e. Start async `readStdout(plugin)` — reads stdout lines in background
   f. Start async `readStderr(plugin)` — reads stderr lines in background
   g. `proc.exited.then(code => { plugin.alive = false })` — marks dead on exit
8. Define RPC handlers via `BrowserView.defineRPC()` — 4 request handlers (see RPC table below)
9. `getMainViewUrl()` — checks Vite HMR on port 5173, returns dev URL if available, else bundled HTML
10. `new BrowserWindow({ title, url, frame, rpc })` — create the app window
11. `setInterval()` — health check every 5 seconds (logs dead plugins, no auto-restart)
12. `process.on("SIGINT", ...)` — kill all plugin subprocesses on Ctrl+C

### RPC Handlers (exposed to WebView)

All handlers are defined inside `BrowserView.defineRPC()` under `handlers.requests`.
Parameters are typed as `unknown` and cast internally because Electrobun's defineRPC
requires `(params?: unknown) => unknown`.

| Handler | Params | Returns |
|---------|--------|---------|
| `pluginRequest` | `{ method: string, params: any }` | `{ success: boolean, data?: any, error?: string }` |
| `pluginList` | `{}` (ignored) | `[{ name: string, alive: boolean, methods: string[] }]` |
| `getPluginManifests` | `{}` (ignored) | `[{ name, version, description, author, methods, frontendComponent, frontendSlot }]` |
| `getPluginFrontend` | `{ name: string }` | `{ code: string }` (full JS file text) |

**getPluginFrontend details:**
- Finds manifest by `name` in the manifests array
- Reads the file at `join(baseDir, manifest.frontendFile)` using `Bun.file().text()`
- Returns the raw JS code as a string
- WebView injects this into a `<script>` tag to register the Web Component

### stdout Reader (readStdout)
- Uses Web Streams API: `plugin.process.stdout.getReader()`
- Buffers partial lines across chunks (split by `\n`, keep incomplete line in buffer)
- Each complete line passed to `handlePluginResponse()`
- This handles the case where a JSON message is split across multiple TCP packets

### Response Handling (handlePluginResponse)
1. `JSON.parse(line)` → get `msg` object
2. Check `msg.id != null && pendingRequests.has(msg.id)`
3. Get pending: `pendingRequests.get(msg.id)!`
4. `clearTimeout(pending.timer)` — cancel the 10-second timeout
5. `pendingRequests.delete(msg.id)` — remove from map (prevents memory leak)
6. If `msg.error` exists → `pending.reject(new Error(msg.error))`
7. Else → `pending.resolve(msg.result)`

### Health Check
- `setInterval()` every 5000ms
- Checks `plugin.alive` for each plugin
- If dead: logs `[name] dead. needs restart.` (no auto-restart yet)

### Cleanup
- `process.on("SIGINT", ...)` — on Ctrl+C, kills all plugin processes via `p.process.kill()`, then `process.exit()`

---

## Frontend Behavior (src/mainview/App.tsx — ~80 lines, simplified in Phase 3)

### Imports & Setup
- `useState, useEffect, useRef` from React (state, lifecycle, DOM references)
- `Electroview` from electrobun/view (Electrobun's browser-side RPC bridge)
- Type imports: `PluginManifest` from shared/types

### RPC Configuration
```typescript
const electroview = new Electroview({
  rpc: Electroview.defineRPC({
    maxRequestTime: 20000,  // MUST be >= all inner timeouts combined
    handlers: { requests: {}, messages: {} },
  }),
})
```
- `maxRequestTime: 20000` is CRITICAL. The host has `BrowserView.defineRPC({ maxRequestTime: 15000 })`.
  The routeRequest has 10s, the plugin has 8s on each API call.
  Frontend timeout must be the largest (20s) because it's the outermost caller.
  Without this, slow plugin requests (like youtube.feed at ~2.5s) silently time out
  on the frontend even though the host and plugin complete successfully.

### Global Bridge (module-level, outside App component)
```typescript
window.__pluginRpc = async (method: string, params: any) => {
  const res = await electroview.rpc?.request.pluginRequest({ method, params })
  if (!res.success) throw new Error(res.error || "RPC error")
  return res.data
}
```
- Any Web Component can call `window.__pluginRpc(method, params)` without importing Electrobun
- Checks `res.success`, throws on error (standard across all callers)
- No `host.*` routing — bridge only routes to plugin subprocesses

### App Component — State
- `manifests` — array of `PluginManifest` from `getPluginManifests` RPC
- `feedRef` — ref to `<feed-widget>` DOM element for setting `.manifests`

### On Mount — Single Effect
```typescript
useEffect(() => {
  (async () => {
    const ms = await electroview.rpc.request.getPluginManifests({})
    setManifests(ms)
  })()
}, [])
```

### Load Frontends + Pass to Feed
```typescript
useEffect(() => {
  if (manifests.length === 0 || !feedRef.current) return
  loadFrontends()
  feedRef.current.manifests = manifests
}, [manifests])
```
1. Fetches manifests on mount via host RPC directly (`electroview.rpc.request`, NOT `__pluginRpc`)
2. When manifests arrive, injects card frontend JS for any manifest with `feeds.card` or `ui`
   - Calls `electroview.rpc.request.getPluginFrontend({ path: "plugins/x/frontend/y.js" })`
   - Creates `<script>` element, sets `textContent` = returned JS code
   - Appends to `<body>` → `customElements.define()` runs
3. Passes manifests array to feed-widget via `.manifests` setter
   - `feedRef.current.manifests = manifests`
   - feed-widget's setter stores data and calls `loadFeed()`

### Render
```typescript
return <feed-widget ref={feedRef} />
```
- Only renders `<feed-widget>` — no plugin cards, no method buttons, no result box
- `WebComponentSlot`, `callMethod`, plugin cards, badges, result display all removed

---

## Build System

`scripts/build-plugins.js` (48 lines) — centralized build for all plugin frontends.

### How It Works
1. Scans `plugins/*/frontend/` directories via `readdirSync`
2. For each directory with files:
   - **.jsx files** → `esbuild <input> --bundle --outfile=<output>`
     - Used by Preact/React plugins
     - Inlines all dependencies (framework, JSX runtime, etc.)
     - Output: single self-contained .js file
   - **.vue files** (must have companion `index.js` entry) → Vite build
     - Generates a temporary `.vite.config.mjs` with:
       - `root`: plugin frontend directory
       - `build.lib.entry`: `"index.js"` (the entry glue)
       - `build.lib.formats: ["iife"]` (Immediately Invoked Function Expression)
       - `build.outDir: "."` (output in same directory as source)
       - `build.emptyOutDir: false` (don't delete other files)
     - Runs `npx vite build --config <configFile>`
     - Deletes the temp config file
3. Output file: `<name>.js` in the same frontend/ directory (e.g., `greet-widget.js`, `log-viewer.js`)

### Run Commands
```bash
bun run build:plugins          # Build all plugin frontends
bun run start                  # build:plugins + vite build + electrobun dev
```

### Framework Handling
| Framework | Source Ext | Build Tool | Bundle Size | Notes |
|-----------|-----------|------------|-------------|-------|
| Preact | .jsx | esbuild --bundle | ~3KB + plugin code | Tiny, React-compatible API |
| React | .jsx | esbuild --bundle | ~40KB + plugin code | Larger but more ecosystem |
| Vue | .vue + index.js | Vite IIFE | ~35KB + plugin code | Requires @vitejs/plugin-vue |
| Svelte/Solid | Similar approach | Respective bundler | Varies | Same WC output pattern |

"Works forever" principle: framework code is inlined into the plugin's .js file.
The plugin never depends on what version of React/Vue/Preact the host app uses.

---

## Plugin Manifest Schema (Current — Flat Format)

```json
{
  "name": "greet",
  "version": "1.0.0",
  "description": "Friendly greetings in Go",
  "author": "Community",
  "command": "./plugins/greet-go/greet",
  "args": [],
  "methods": ["greet.hello", "greet.bye"],
  "frontendComponent": "greet-widget",
  "frontendFile": "plugins/greet-go/frontend/greet-widget.js",
  "frontendSlot": "main"
}
```

### Fields (Phase 3 — simplified)
| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Unique plugin ID. Used in RPC routing (e.g., `pluginRequest`), path derivation |
| `version` | ❌ | Semver version. Display in UI. |
| `description` | ❌ | Short description. Display in UI. |
| `author` | ❌ | Creator name. Display in UI. |
| `run` | ❌ | Command to spawn subprocess. Replaces old `command`+`args`. Example: `"bun plugins/youtube-explorer/main.ts"` |
| `methods` | ❌ | Array of method prefixes for RPC routing. Example: `["youtube.feed", "youtube.auth.login"]` |
| `ui` | ❌ | WC tag for main-UI rendering. Path derived: `plugins/<name>/frontend/<tag>.js`. App.tsx loads AND mounts this. Only feed plugin uses it. |
| `feeds` | ❌ | Feed contribution object. If present, this plugin is a feed source. |
| `feeds.type` | ✅ (if feeds) | Content type: `"video"`, `"image"`, `"post"`, etc. |
| `feeds.method` | ✅ (if feeds) | RPC method name that returns feed items (array of any JSON shape). |
| `feeds.card` | ❌ | WC tag for rendering one item. Path derived: `plugins/<name>/frontend/<tag>.js`. If absent, items skipped. |

### Plugin Types (Phase 3)
- **Backend-only**: Has `run` but no `ui`/`feeds` → spawned as subprocess, no UI
- **Frontend-only (main UI)**: Has `ui` but no `run` → WC loaded and mounted by App.tsx
- **Frontend-only (card)**: Has `feeds.card` but no `run` → WC loaded by App.tsx, mounted by feed-widget
- **Fullstack**: Has `run` + `ui`/`feeds` → subprocess + frontend components
- **Feed source**: Has `run` + `feeds` → subprocess with feed method + card WC

**Path derivation**: frontend file paths NOT in manifest. Derived at runtime:
- Card: `plugins/<name>/frontend/<feeds.card>.js`
- UI WC: `plugins/<name>/frontend/<ui>.js`

Example fullstack plugin:
```json
{
  "name": "youtube-explorer",
  "run": "bun plugins/youtube-explorer/main.ts",
  "methods": ["youtube.feed", "youtube.auth.status", "youtube.auth.login", "youtube.auth.logout"],
  "version": "1.0.0",
  "description": "Browse YouTube",
  "author": "Community",
  "feeds": {
    "type": "video",
    "method": "youtube.feed",
    "card": "yt-video-card"
  }
}
```

---

## Plugin Implementations

### greet-go — Go Backend (Phase 1 demo, frontend removed in Phase 3)

#### Backend (main.go — ~78 lines)
- Uses `*json.RawMessage` for params (user's explicit choice over simpler `map[string]interface{}`)
  - Provides more type safety (each method defines its own params struct)
  - More verbose: requires intermediate struct definition + unmarshal per method
- Request struct: `Id int`, `Method string`, `Params *json.RawMessage`
- Response struct: `Id int`, `Result interface{}`, `Error string`
- stdin/stdout loop via `bufio.Scanner`
- Method handlers for `greet.hello` and `greet.bye`
- Both accept `{ name: string }` param, default to "World" if empty
- `greet.hello` returns `{ message: "Hello <name> from Go!" }`
- `greet.bye` returns `{ message: "Goodbye <name>!" }`
- Unknown methods return `{ error: "Method not found: ..." }`
- Compile: `go build -o greet main.go` in the greet-go directory
- Test standalone: `echo '{"id":1,"method":"greet.hello","params":{"name":"Niri"}}' | ./plugins/greet-go/greet`

**NOTE:** Frontend dir (greet-widget.jsx) removed in Phase 3 — no longer builds or loads.

### logger-py — Python Backend (Phase 1 demo, frontend removed in Phase 3)

#### Backend (main.py — ~49 lines)
- `send_response(req_id, result, error)` — writes JSON + `\n` to stdout, then flushes
- `handle_request(request)` — dispatches by method
- `log.info` — reads `params.message`, appends to `electro-plugins.log` (append mode), returns `"ok"`
- `log.list` — reads all lines from `electro-plugins.log`, returns array of strings
- Unknown methods return `{ error: "Method not found: ..." }`
- Main loop: reads `sys.stdin` line by line via `for line in sys.stdin:`
- `params.get("params", {})` — default empty object prevents `AttributeError` crash
- All indentation is 4 spaces (was 6 at one point — fixed in bug #6)
- Test standalone: `echo '{"id":1,"method":"log.info","params":{"message":"test"}}' | python3 plugins/logger-py/main.py`

**NOTE:** Frontend dir (log-viewer.vue + index.js) removed in Phase 3 — no longer builds or loads.

### joke-fetcher — Bun/TS Backend (Phase 1 demo, frontend removed in Phase 3)

#### Backend (main.ts — ~40 lines)
- Fetches jokes from a public API
- Methods: `joke.random`, `joke.types`

**NOTE:** Frontend dir removed in Phase 3. `index.js` was the entry glue (Vue), removed because it no longer works without `frontendComponent` manifest field.

### youtube-explorer — Bun/TS Backend + React Card WC (Phase 2 + Phase 3 feed source)

#### Backend (main.ts — ~250 lines)
- Uses Innertube API (YouTube's internal API) for feed data
- Cookie auth via browser DB discovery (Firefox SQLite, Chrome via sweet-cookie)
- SAPISID cookie extraction → SAPISIDHASH Authorization header
- ST-* cookie filter (prevents 413 Request Entity Too Large)
- Per-request `Innertube` instances (no global `tube` — eliminates race conditions)
- 8s Promise.race timeout on getHomeFeed() and search()
- Event-based stdin queue with `knownIds` dedup (defeats Bun canary re-delivery bug)
- `youtube.feed`: returns array of video items from YouTube home page
- `youtube.search`: search YouTube by query
- `youtube.auth.login`/`youtube.auth.logout`/`youtube.auth.status`: auth flow
- Test standalone: `echo '{"id":1,"method":"youtube.feed"}' | bun run plugins/youtube-explorer/main.ts`

#### Frontend — yt-video-card.tsx (~75 lines, React card WC)
```jsx
import { useState } from "react"
import { createRoot } from "react-dom/client"

function YTVideoCard({ item }) {
  if (!item) return <div className="p-4 text-gray-400">Loading...</div>
  return (
    <div className="...">
      <img src={item.thumbnail} className="..." />
      <h3>{item.title}</h3>
      <p>{item.channel}</p>
      <span>{item.viewCount} views · {item.published}</span>
    </div>
  )
}

customElements.define("yt-video-card", class extends HTMLElement {
  _item = null
  root = null
  connectedCallback() {
    this.root = createRoot(this)
    this._render()
  }
  disconnectedCallback() { this.root?.unmount(); this.root = null }
  set item(data) { this._item = data; this._render() }
  get item() { return this._item }
  _render() { if (this.root) this.root.render(<YTVideoCard item={this._item} />) }
})
```
- Build script entry template wraps this with IIFE imports (createRoot, React)
- Receives raw video data via `.item` setter from feed-widget
- Renders thumbnail image, title H3, channel name, view count, published date
- Pure display — no `__pluginRpc` calls (only receives data)

### feed-widget — React WC (Phase 3 feed orchestrator, ~210 lines)

#### plugin.json
```json
{ "name": "feed", "description": "Aggregate content", "author": "System", "version": "1.0.0", "ui": "feed-widget", "methods": [] }
```
No `run`, no `feeds` — feed IS the aggregator, not a source.

#### Frontend (feed-widget.tsx — ~210 lines)
- 5-state machine: `loading` (spinner), `error` (system failure), `empty` (no feed sources), `partial` (some errors), `loaded` (all ok)
- `loading: true` → spinner + "Loading feed..."
- `error: string` → error message + retry button (calls `loadFeed()`)
- `items.length === 0 && !loading` → "No content sources yet"
- Sources with errors get per-plugin error banner: source name + error message
  - If source's methods include `youtube.auth.login` (or any `.auth.login`): "Sign in" button appears
  - Sign-in calls `__pluginRpc(source.methods.find(m => m.endsWith(".auth.login")), {})`
  - On success: calls `loadFeed()` to refresh
  - On failure: `alert(error)`
- `CardRenderer` helper:
  - Uses `customElements.whenDefined(cardTag)` to wait for WC registration
  - When defined: `document.createElement(cardTag)`, `card.item = item`, appends to container
  - Auto-cleans container on re-render (sets `container.innerHTML = ""` first)

#### Data flow
1. App.tsx calls host RPC directly → gets manifests → sets `feedRef.current.manifests = manifests`
2. feed-widget's setter stores manifests, calls `loadFeed()`
3. `loadFeed()`: for each manifest with `feeds`, calls `__pluginRpc(feeds.method, {})`
4. Results merged into flat `items[]` array
5. `CardRenderer` creates WC for each item, sets `.item`, appends

#### __pluginRpc callers
- feed-widget calls `__pluginRpc(source.feeds.method, {})` for each feed source
- feed-widget calls `__pluginRpc(authMethod, {})` when user clicks "Sign in"
- No host.* prefix — bridge is simple, routes only to plugin subprocesses

---

## All Key Decisions Made (Chronological)

### Architecture Decisions
1. **Language-agnostic plugin system** — plugins can be written in any language (Go, Python, etc.)
2. **Subprocess stdin/stdout JSON-RPC** — simplest cross-language IPC. Each plugin is a standalone process
3. **No `jsonrpc` field** — messages are `{"id", "method", "params"}` only, cleaner than full JSON-RPC spec
4. **Host routes by method prefix** — `"greet."` matches `"greet.hello"`. Plugin handles the specific action
5. **Desktop first, mobile later** — subprocess works on desktop. Mobile will need FFI/Wasm
6. **Different skeleton per platform is fine** — Electrobun for desktop, Tauri/zero-native for mobile. Plugins don't change
7. **Everything is a plugin** — including frontend UI and eventually the skeleton itself
8. **No "core" plugin** — just feature plugins (no separate plugin for core system functionality)
9. **Companion app** (future) — a tiny binary that reads config and launches the right skeleton for the platform
10. **Manifest scanning from plugins/*/plugin.json** — replaced config.json. Host reads all plugin.json files at startup via readdirSync + JSON.parse. No central config needed.
11. **Flat manifest format** — no nested backend/frontend objects. All fields at top level. Matches VS Code/Chrome/Obsidian conventions.

### Framework Decisions
12. **Electrobun for prototyping** — easiest for a beginner (Bun/TypeScript). Native WebView, ~14MB bundle, fast startup
13. **Tauri for future mobile** — Rust, mature ecosystem, iOS + Android support, but requires learning Rust
14. **zero-native** (Vercel Labs) — alternative future option. Zig + system WebView, mobile support, but pre-release (v0.2)
15. **WebUI (webui-dev)** — interesting but no mobile path. Opens a real browser (Chrome/Firefox), not a WebView. Few KB library
16. **React + Tailwind + Vite** for the frontend (from the Electrobun template)

### Phase 3 Decisions
17. **Feed approach is THE approach** — old per-plugin widget cards are dead. App.tsx mounts only `<feed-widget>`. No WebComponentSlot, no plugin cards, no callMethod, no result box.
18. **No library sharing needed** — one WC class definition is shared across all DOM instances. Framework bundle lives in prototype. Different plugins have different bundles (their own versions). No duplication within the same WC type. Option B (per-plugin shared library) solves a non-problem.
19. **No `host.*` routing** — feed-widget does NOT call host RPCs. App.tsx calls host directly (`electroview.rpc.request.getPluginManifests({})`) and passes data via `.manifests` setter on the WC DOM element. `__pluginRpc` bridge stays simple: routes only to plugin subprocesses.
20. **No fallback cards** — postponed. Only cards from plugins are rendered. Items from plugins without `card` field are skipped.
21. **Data flow via property setters** — App.tsx uses `.manifests` setter, feed-widget uses `.item` setter on each card. Not via RPC, not via events.
22. **`_item` naming convention** — private backing field with underscore prevents infinite loop in setter. `set item(data) { this._item = data; this._render() }`. Getter: `get item() { return this._item }`.
23. **Simplified manifest** — `run` replaces `command`+`args`. `feeds` block replaces `frontendComponent`/`frontendFile`/`frontendSlot`. `ui` field for main-UI WC (only feed plugin uses it). No backward compat with old format.
24. **Path derivation** — frontend file paths NOT in manifest. Derived at runtime: `plugins/<name>/frontend/<tag>.js`. Tag comes from `ui` or `feeds.card` field.
25. **Feed is a plugin** — `plugins/feed/` with no backend. Users can swap feed implementation by installing a different feed plugin.
26. **Framework agnostic cards** — each card WC is self-contained IIFE with framework inlined. React, Preact, Vue, Svelte all work.
27. **No schema** — feed doesn't know or care about item structure. Raw data passes through to card WC. Cards written by the same person as the backend.
28. **Auth in error banners** — feed-widget shows "Sign in" button in per-plugin error banners when plugin has `.auth.login` method. Calls it, reloads feed on success.
29. **5 feed states** — loading, system error, empty, partial (some errors), loaded (all ok). Error banners per-plugin.

### Plugin Design Decisions
17. **Web Components for frontend plugins** — any framework (React, Vue, Svelte, Angular) can compile to them. Browser standard, no framework lock-in
18. **Iframes as alternative** — stronger isolation, separate JS context, communication via postMessage. Heavier. Cannot display native UI (Qt/GTK)
19. **Three plugin types** — `backend` (subprocess only), `frontend` (Web Component only), `fullstack` (both)
20. **`window.__pluginRpc()` global bridge** — simplest way for any WC framework to call backend. No imports needed.
21. **Centralized build script** — `scripts/build-plugins.js` handles all plugin types. One command for all.
22. **`findProjectRoot()` walks up from `import.meta.dir`** — works in both dev (flat) and bundled modes
23. **FileSink.write() for plugin stdin** — Bun's `Subprocess.stdin` is a `FileSink` when piped. Use `.write()` directly.
24. **RPC params typed as `unknown`** — Electrobun's `defineRPC` expects `(params?: unknown) => unknown`. All handlers cast internally.

### Go Plugin Specific
25. **`*json.RawMessage` for params** — user explicitly chose this over simpler `map[string]interface{}`. More type safety, more verbose.
26. **Nested struct for params** — each method defines its own params struct, unmarshals from RawMessage

### Teaching/Communication Decisions
27. **User is a beginner** — assume ZERO prior knowledge. Explain every concept, syntax, and line
28. **Provide full code in messages** — user copies code themselves. Never modify files without explicit permission
29. **Line-by-line explanation tables** — after every code block, explain each section in a table
30. **Multi-level zoom** — big picture → file → scope/block → line → symbol → syntax construct
31. **Be proactive** — research tools, patterns, pitfalls without being asked. Suggest better approaches
32. **Mentor, not yes-man** — correct wrong assumptions directly. Lead the project in the right direction
33. **Test standalone before integrating** — catch plugin bugs in isolation before running the full app
34. **No code comments unless asked** — don't add comments to code files
35. **Plan mode = read-only, Build mode = can write** — plan mode explains and provides code in messages, build mode can create/edit files + run commands
36. **Never commit unless asked** — no git operations without explicit instruction
37. **Two-file rule** — only modify AGENTS.md (project knowledge) and SKILL.md (general rules). Never touch project code.
38. **Update both files every prompt** — actively check for changes. Never assume "last agent handled it."

---

## Bug History

### Bug #1: `for...in` instead of `for...of` (stdout reader)
- **Location**: `readStdout()` and `readStderr()` in index.ts
- **Problem**: `for (const line in lines)` iterates over array INDICES as strings ("0", "1"), not actual line values
- **Fix**: Change to `for (const line of lines)`
- **Impact**: Plugin responses silently dropped. `JSON.parse("0")` returns `0`, then `0.id != null` is false, so every request times out after 10 seconds
- **Status**: ✅ FIXED

### Bug #2: `==` instead of `=` (alive flag)
- **Location**: `proc.exited.then()` callback
- **Problem**: `plugin.alive == false` is a comparison, not an assignment. The expression evaluates to `true` or `false` but the value is discarded. `alive` is never set to false
- **Fix**: Change `==` to `=`
- **Impact**: When a plugin crashes, the health check never detects it. Plugin stays marked as alive forever
- **Status**: ✅ FIXED

### Bug #3: Extra `}` in template literal
- **Location**: Console error message in exit handler
- **Problem**: `` `[${pc.name}] exited (code ${code}})` `` — extra `}` after `${code}`
- **Fix**: Remove the extra `}`
- **Impact**: Output shows `"exited (code 0})"` instead of `"exited (code 0)"`
- **Status**: ✅ FIXED

### Bug #4: Missing `pendingRequests.delete()`
- **Location**: `handlePluginResponse()` in index.ts
- **Problem**: After resolving/rejecting a pending request, the entry stays in the Map forever
- **Fix**: Add `pendingRequests.delete(msg.id)` after `clearTimeout(pending.timer)`
- **Impact**: Memory leak. Over time, the Map fills with resolved requests
- **Status**: ✅ FIXED

### Bug #5 (Frontend): `pluginList` instead of `pluginRequest`
- **Location**: App.tsx, `callMethod()` function
- **Problem**: `electroview.rpc?.request.pluginList({ method, params })` calls the wrong RPC method
- **Fix**: Change to `electroview.rpc.request.pluginRequest({ method, params })` and remove unnecessary `?.`
- **Impact**: Clicking a method button shows the plugin list instead of calling the plugin
- **Status**: ✅ FIXED

### Bug #6 (Python): Inconsistent indentation
- **Location**: `logger-py/main.py`, lines 11 and 13
- **Problem**: 6 spaces of indentation instead of 8 (Python requires consistent indentation level for if/else bodies)
- **Fix**: Change from 6 spaces to 8 spaces (4 for function body + 4 for if/else body)
- **Status**: ✅ FIXED

### Bug #7 (Python): Missing default for `params.get()`
- **Location**: `logger-py/main.py`, line 20
- **Problem**: `params = request.get("params")` — if the request has no "params" key, `params` becomes `None`. Then `params.get("message", "")` crashes with `AttributeError: 'NoneType' object has no attribute 'get'`
- **Fix**: `params = request.get("params", {})` — default to empty dict
- **Status**: ✅ FIXED

### Bug #8: Vite outDir doubled path
- **Location**: Generated `.vite.config.mjs` in `build-plugins.js`
- **Problem**: Setting `root` to plugin dir AND `build.outDir` relative to root caused path like `plugins/logger-py/frontend/plugins/logger-py/frontend/`
- **Fix**: Set `build.outDir` to `"."` (current directory = root) and `emptyOutDir: false`
- **Impact**: Vite build failed for Vue plugins — couldn't find output directory
- **Status**: ✅ FIXED

### Bug #9: Electrobun build.copy "plugins/**" doesn't work in dev mode
- **Location**: `electrobun.config.ts` copy rules
- **Problem**: The glob `"plugins/**"` in `build.copy` only works during production build. In dev mode, the copy step is skipped.
- **Fix**: Harmless — `resolvePath()` resolves files from source tree directly in dev mode
- **Impact**: None (works correctly, just different resolution paths per mode)
- **Status**: ✅ NO FIX NEEDED

### Bug #10: Subprocess.stdin is a FileSink, not WritableStream
- **Location**: `sendToPlugin()` in index.ts
- **Problem**: Bun's `Subprocess.stdin` when piped returns a `FileSink`, not a `WritableStream`. Calling `.getWriter()` on it fails: "FileSink doesn't have getWriter"
- **Fix**: Check `typeof stdin !== "number"`, then call `stdin.write(msg)` directly. No `getWriter()`/`releaseLock()`.
- **Impact**: Plugin requests silently failed to send. Plugin never received request, so every request timed out.
- **Status**: ✅ FIXED

### Bug #11: RPC handler params type must be `unknown`
- **Location**: All 4 RPC handler definitions in index.ts
- **Problem**: Electrobun's `defineRPC()` strictly expects `(params?: unknown) => unknown`. Using specific types causes TypeScript errors.
- **Fix**: Declare all handlers as `async (params: unknown) => { ... }` and cast internally with `params as { method: string; params: any }`
- **Impact**: TypeScript compilation errors. App wouldn't build.
- **Status**: ✅ FIXED

### Bug #12 (CRITICAL): Frontend RPC timeout default too short for slow plugins
- **Location**: `src/mainview/App.tsx`, line 7 — `Electroview.defineRPC({})`
- **Problem**: `Electroview.defineRPC()` with no `maxRequestTime` defaults to a very short timeout (~1s). The youtube-explorer feed request takes ~2.5s (Innertube.create 1.3s + getHomeFeed 1.2s). The frontend's RPC timer fired before the plugin response arrived. The host received the response and resolved it (visible in terminal logs `handleResponse pending=true`), but the frontend had already thrown "RPC request timed out." — the response was discarded because nobody was listening.
- **Fix**: Added `maxRequestTime: 20000` to BOTH `BrowserView.defineRPC()` (host, was already 15000) AND `Electroview.defineRPC()` (frontend, was missing). The frontend timeout must be >= all inner timeouts combined.
- **Impact**: Every `youtube.feed` request silently failed. User saw "Loading feed..." for ~1s then "RPC request timed out." even though the plugin processed the request successfully. Only visible in WebView dev console (F12) — no terminal log.
- **Lesson**: Every RPC layer must have a timeout >= all the layers below it combined. Always set explicit `maxRequestTime` on EVERY `defineRPC()` call.
- **Related fixes applied**: readStdout buffer fix (already done), readStderr buffer fix (was still broken — same `lines.pop()` pattern), event queue with knownIds dedup (defeats Bun canary stdin re-delivery bug), feedLoadedRef guard (React double-mount protection)
- **Status**: ✅ FIXED

---

## All Tools, Frameworks, and Concepts Discussed

### Skeletons (App Frameworks)
| Tool | Language | Approach | Bundle | Mobile | Stars | Notes |
|------|----------|----------|--------|--------|-------|-------|
| **Electrobun** | TypeScript (Bun) | System WebView | ~14MB | ❌ | Newer | Current choice for prototyping |
| **Tauri** | Rust | System WebView | ~5-40MB | ✅ iOS+Android | ~107k | Future choice for production |
| **zero-native** | Zig | System WebView | <1MB | ✅ iOS+Android | ~4.2k | Vercel Labs, pre-release v0.2 |
| **WebUI (webui-dev)** | C | Opens real browser | Few KB | ❌ | ~4.1k | Interesting but no mobile |

### Development Tools Suggested
| Tool | Purpose | Why |
|------|---------|-----|
| **jq** | CLI JSON processor | Parse and format plugin JSON output during testing |
| **watchexec** | File watcher | Auto-restart app when plugin source files change |
| **hyperfine** | Benchmarking | Measure plugin response times |
| **just / make** | Task runner | Replace long shell commands with named tasks |
| **uv** | Python package manager | Faster than pip, useful for Python plugins |
| **asdf / mise** | Version manager | Manage Go, Python, Rust versions per project |
| **printf** | Shell command | Send JSON-RPC messages to plugin stdin for standalone testing |

### Frontend Plugin Approaches
| Approach | Isolation | Performance | Framework Lock-in | Communication |
|----------|-----------|-------------|-------------------|---------------|
| **Web Components** | Medium | Lightweight | None (standard) | Direct function calls |
| **iframe** | High (separate JS context) | Heavier | None | postMessage async |
| **Dynamic React import** | Low (same context) | Lightweight | React only | Direct imports |

### iframe Details
- Embeds a completely separate HTML document within the current page
- Has its OWN JavaScript engine, its own DOM, its own CSS
- CANNOT access or modify the host page's DOM (unless same-origin)
- Communication only via `window.parent.postMessage()` and `window.addEventListener("message", ...)`
- Can be sandboxed with `sandbox` attribute (restrict scripts, forms, popups, etc.)
- Cannot display native UI (Qt, GTK, WinForms). Only HTML/CSS/JS
- Each iframe consumes memory for a separate JS engine instance

### Book Recommendations
- "Head First Design Patterns" — design patterns for beginners
- "The Pragmatic Programmer" — software craftsmanship
- "Clean Code" — code readability
- "You Don't Know JS" series — JavaScript depth
- "A Philosophy of Software Design" — complexity management

---

## Progress

### ✅ DONE — Phase 1 Complete
- [x] Researched skeleton options: Electrobun, Tauri, WebUI (webui-dev), zero-native
- [x] Chose Electrobun for prototyping (Bun/TS, easy for beginner)
- [x] Created greet-go plugin: Go backend (greet.hello, greet.bye) + Preact WC frontend
- [x] Created logger-py plugin: Python backend (log.info, log.list) + Vue WC frontend
- [x] Written .gitignore — node_modules, build, dist, greet binary, *.log
- [x] Written flat plugin manifests (plugins/*/plugin.json) — replaces old config.json
- [x] Written host src/bun/index.ts (~272 lines) — spawn, route, 4 RPC handlers, health check, cleanup
- [x] Written frontend src/mainview/App.tsx (~152 lines) — auto-load WCs, plugin cards, result display
- [x] Written src/shared/types.ts — PluginManifest, PluginInfo, PluginRequest*
- [x] Written scripts/build-plugins.js — centralized build: .jsx → esbuild, .vue → Vite
- [x] `window.__pluginRpc()` global bridge exposed for Web Components
- [x] WebComponentSlot helper for rendering WCs inside React cards
- [x] Host manifest scanning (readdirSync + JSON.parse) — no more config.json
- [x] All 11 bugs fixed
- [x] Go plugin compiled and tested standalone
- [x] Python plugin tested standalone
- [x] App boots and runs end-to-end. `greet.hello` returns "Hello World from Go!"
- [x] Full architecture documented in AGENTS.md
- [x] Teaching mode, operational rules, and auto-update protocol documented

### ✅ COMPLETED — Phase 2: YouTube Explorer Plugin
- [x] youtube-explorer plugin: Bun TS backend + React WC frontend
- [x] Cookie auth via browser DB discovery (Firefox SQLite, Chrome via sweet-cookie)
- [x] SAPISID cookie extraction → SAPISIDHASH Authorization header (innertube)
- [x] ST-* cookie filter (prevents 413 Request Entity Too Large on YouTube API)
- [x] Per-request `Innertube` instances (no global `tube` — eliminates race conditions)
- [x] 8s Promise.race timeout on getHomeFeed() and search()
- [x] Event-based stdin queue with `knownIds` dedup (defeats Bun canary re-delivery bug)
- [x] `feedLoadedRef` guard in frontend (prevents double loadFeed calls)
- [x] readStdout + readStderr buffer fix (`lines.pop()`) — prevents stale line re-emission
- [x] Frontend maxRequestTime: 20000 fix (critical — see Bug #12)
- [x] Feed renders 22 videos from YouTube home page
- [x] Search, sign in, sign out, watch video, error states all functional

### ✅ COMPLETED — Phase 3: Unified Feed Architecture
- [x] Manifest simplified: `run` replaces `command`+`args`, `ui`/`feeds` replaces `frontendComponent`/`frontendFile`/`frontendSlot`
- [x] Old prototype plugin frontends removed (greet-go, logger-py, joke-fetcher) — no longer build or load
- [x] Shared types updated: `FeedContrib` interface, `PluginManifest` with `run`/`ui`/`feeds`
- [x] Host updated: reads `run` field, returns `ui`/`feeds` in manifests, `getPluginFrontend` takes `{ path }`
- [x] App.tsx simplified: calls host RPC directly for manifests, passes them via `.manifests` setter to feed-widget
- [x] App.tsx no longer renders plugin cards, no WebComponentSlot, no callMethod, no result display
- [x] Feed plugin created (`plugins/feed/`): `plugin.json` + `frontend/feed-widget.tsx` with 5-state machine
- [x] youtube-explorer updated: `run` + `feeds` block, `frontend/yt-video-card.tsx` created
- [x] Build script updated: React/Preact entry templates with `_item`/`_manifests` setters
- [x] Auth button in error banners: calls `.auth.login`, reloads feed on success
- [x] End-to-end test: `bun run build:plugins && vite build && electrobun dev` — feed renders error banners, cards after sign-in
- [x] Full architecture documented: data flow, WC contract, `_item` pattern, 5 states, feed implementation

### ❌ PLANNED — Future Phases

**Phase 4: Multi-Source Feed + Feed Types**
- [ ] Add a second feed source plugin (e.g., mock API, Reddit, or split youtube into multiple contributions)
- [ ] Fix build script tag resolution: check `ui`/`feeds.card` instead of reading `frontendComponent` (which is gone)
- [ ] Clean up dead code: `youtube-widget.tsx` still builds but never loads
- [ ] Add sorting/interleaving across sources
- [ ] Add feeds-as-array support (a plugin contributes to multiple feed types: `feeds: [{ type: "video", ... }, { type: "short", ... }]`)
- [ ] Design generalized feed type system

**Phase 5: Plugin Store**
- [ ] Create plugin registry schema
- [ ] Add Store tab to App.tsx
- [ ] Install from URL / one-click install
- [ ] Plugins registry list RPC handler
- [ ] UI updates on install
- [ ] Auto-updates
- [ ] Plugin signing / verification

**Phase 6: Future / Stretch**
- [ ] Plugin dependencies
- [ ] Community submissions system
- [ ] Hosted remote registry (web server + JSON API)
- [ ] Plugin store website
- [ ] Mobile: Tauri or zero-native
- [ ] More skeletons: WebUI, Tauri, zero-native

**Phase 5: Plugin Store**
- [ ] Create plugin registry schema
- [ ] Add Store tab to App.tsx
- [ ] Install from URL / one-click install
- [ ] Plugins registry list RPC handler
- [ ] UI updates on install
- [ ] Auto-updates
- [ ] Plugin signing / verification

**Phase 6: Future / Stretch**
- [ ] Plugin dependencies
- [ ] Community submissions system
- [ ] Hosted remote registry (web server + JSON API)
- [ ] Plugin store website
- [ ] Mobile: Tauri or zero-native
- [ ] More skeletons: WebUI, Tauri, zero-native

---

## Relevant Commands

```bash
# Full app start (build plugins + build vite + run electrobun dev)
cd /mnt/5TB/Projects/electro-plugins && bun run start

# Build only plugin frontends (.jsx→esbuild, .vue→Vite)
bun run build:plugins

# Development with HMR (Vite dev server + Electrobun dev)
bun run dev:hmr

# Vite dev server only (for HMR when electrobun dev is running separately)
bun run hmr

# Electrobun dev only (no HMR, uses bundled assets)
bun run dev

# Compile Go plugin
cd plugins/greet-go && go build -o greet main.go

# Test Go plugin standalone
echo '{"id":1,"method":"greet.hello","params":{"name":"Niri"}}' | ./plugins/greet-go/greet
echo '{"id":1,"method":"greet.bye","params":{"name":"Niri"}}' | ./plugins/greet-go/greet

# Test Python plugin standalone
echo '{"id":1,"method":"log.info","params":{"message":"test"}}' | python3 plugins/logger-py/main.py
echo '{"id":2,"method":"log.list"}' | python3 plugins/logger-py/main.py

# Run the standalone test script (if test.sh exists)
./test.sh
```

---

## Teaching/Communication Rules (for agents working here)

### The Two-File Rule (ABSOLUTE)
1. **MODIFY ONLY** `AGENTS.md` (project-specific knowledge) and `~/.config/opencode/skills/coding/SKILL.md` (general coding rules)
2. **NEVER TOUCH** any other project file — the user handles ALL code
3. **UPDATE BOTH FILES EVERY PROMPT** — actively check if anything changed. See the "Auto-Update Protocol" in SKILL.md.
4. **Always verify** — never assume "the last agent already updated this"

### Teaching Style
1. **User is a beginner** — assume ZERO prior knowledge. Explain every concept, every syntax construct, every line
2. **Provide full code in messages** — user copies code themselves. Never modify files without explicit build mode permission
3. **Line-by-line explanation tables** — after every code block, explain each section in a table
4. **Multi-level zoom** — big picture → file → block → line → symbol → syntax construct
5. **Re-read files before every response** — stay in sync with what the user has written
6. **Research before speaking** — check latest docs for libraries, APIs, frameworks. Don't guess
7. **Surface better approaches** — if there's a better way, explain the tradeoffs and let the user decide
8. **Be proactive** — research and suggest relevant tools, patterns, and pitfalls without being asked
9. **Mentor, don't just answer** — correct wrong assumptions directly. Lead the project
10. **Test standalone before integrating** — always suggest testing plugins in isolation first
11. **No code comments unless asked** — don't add comments to source files
12. **Never commit unless asked** — no git operations without explicit instruction
13. **Never force push to main/master** — warn user if they request this
14. **Never amend unless the commit was just created by you and not pushed** — make a new commit for hook rejections

---

## Registry Schema (future)

```json
{
  "plugins": [
    {
      "name": "greet",
      "version": "1.0.0",
      "description": "Friendly greetings in Go",
      "author": "Community",
      "downloadUrl": "https://example.com/plugins/greet-v1.0.0.zip",
      "type": "fullstack",
      "checksum": "sha256-..."
    }
  ]
}
```

### Plugin Types
- `backend` — only a subprocess, no UI contribution
- `frontend` — only a Web Component, no subprocess
- `fullstack` — both backend subprocess AND frontend Web Component

### Slots (for frontend components)
- `main` — primary content area (where plugin widgets display)
- Future: `sidebar`, `header`, `statusbar`, `settings`

---

## Phase 3 Architecture: Unified Feed

### Core Shift
Phase 1-2 built per-plugin standalone widgets (each plugin in its own card, rendered by App.tsx).
Phase 3 replaces this with a SINGLE feed that aggregates items from all content plugins.

The feed itself is a plugin (`plugins/feed/`), swappable by the user. It has no backend — just a
frontend Web Component (`feed-widget`). App.tsx loads manifests from the host and passes them
directly to feed-widget via the `.manifests` property setter. Feed-widget then discovers
feed-contributing plugins, calls their feed methods via `__pluginRpc`, and renders their card WCs.

Each content plugin provides:
- **Backend**: RPC method that returns feed items (any shape)
- **Frontend**: A Web Component "card" that renders ONE feed item
- **Manifest**: Declares `feeds` — what type of content, which RPC method, which card WC

### Architecture Diagram
```
┌──────────────────────────────────────────────────────────────────┐
│  WebView (React + Tailwind + Vite HMR)                          │
│                                                                  │
│  App.tsx:                                                        │
│  1. electroview.rpc.request.getPluginManifests({}) → manifests   │
│  2. For plugins with feeds.card or ui: injects frontend JS       │
│     (getPluginFrontend → <script> → customElements.define())     │
│  3. Renders <feed-widget> as main content                        │
│  4. Sets feedRef.current.manifests = manifests (pass via setter) │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ <feed-widget> (plugin: feed/)                        │        │
│  │ set manifests(data) {                                │        │
│  │   this._manifests = data;                            │        │
│  │   this.loadFeed(); // trigger re-fetch               │        │
│  │ }                                                    │        │
│  │                                                      │        │
│  │ loadFeed():                                          │        │
│  │   1. Filter _manifests by has feeds                   │        │
│  │   2. For each source:                                │        │
│  │      a. __pluginRpc(source.feeds.method, {})         │        │
│  │      b. Receives items (any shape, no schema)         │        │
│  │   3. Merges items (grouped by source order)           │        │
│  │   4. For each item:                                   │        │
│  │      cr = document.createElement(source.feeds.card)  │        │
│  │      cr.item = rawItem (ALL data)                     │        │
│  │      feedContainer.appendChild(cr)                   │        │
│  │                                                      │        │
│  │ States: loading|error|empty|partial|loaded           │        │
│  │ Error banners per-source with optional Sign In       │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ yt-card    │  │ (future)   │  │ yt-card    │                 │
│  │ (React 18) │  │            │  │ (React 18) │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
```

Each card instance shares its WC class definition — no framework duplication across instances.
Framework bundle lives in the prototype, shared by all DOM elements of that tag.

### Data Flow (Detailed)
1. **App.tsx mounts** → `electroview.rpc.request.getPluginManifests({})` → gets array of manifests
2. **App.tsx loads frontend JS**: for each manifest with `feeds.card` or `ui`:
   - Calls `electroview.rpc.request.getPluginFrontend({ path: "plugins/x/frontend/y.js" })`
   - Creates `<script>` element, sets `textContent` = JS code, appends to `<body>`
   - `customElements.define()` registers the WC globally
3. **App.tsx passes manifests**: renders `<feed-widget>`, sets `feedRef.current.manifests = manifests`
   → feed-widget's setter triggers `loadFeed()`
4. **feed-widget**: for each source with `feeds`:
   - Calls `__pluginRpc(source.feeds.method, {})` → gets array of items (any JSON shape, no schema)
5. **Merges** items from all sources into one array (grouped by source, in registration order)
6. **For each item**: `customElements.whenDefined(source.feeds.card).then(() => {...})`
   - `card = document.createElement(source.feeds.card)`
   - `card.item = rawItem` (passes EVERYTHING — no schema)
   - `feedContainer.appendChild(card)`
7. **Error handling**: per-source. If a feed method call fails, that source's items are skipped,
   an error banner is shown (with optional "Sign in" button if source has `.auth.login` method)

### Key Design Decisions
- **No schema**: Feed doesn't know or care about item structure. Raw data passed through to card WC.
  Cards are written by the same person who wrote the backend, so they know the data shape.
- **Feed is a plugin**: Users can swap feed implementation by installing a different feed plugin.
  The default feed plugin lives at `plugins/feed/`.
- **Framework agnostic**: Each card WC is a self-contained IIFE with its framework inlined.
  Multiple instances of the same card share the framework (single WC definition, many DOM elements).
- **Language agnostic**: Backend plugins can be any language (Go, Python, Bun/TS).
- **No fallback cards (Phase 3a)**: Cards come from plugins. If a plugin doesn't provide a card,
  its items are skipped or shown in raw form. Fallback cards postponed.
- **No library sharing needed**: All instances of the same WC share one framework bundle.
  Different plugins use different bundles (their own versions). No duplication.
- **Path derivation**: Frontend file paths are NOT in manifest. Derived at runtime:
  - Card: `plugins/<name>/frontend/<feeds.card>.js`
  - UI WC: `plugins/<name>/frontend/<ui>.js`
- **Custom DOM events for card ↔ feed communication**: Cards dispatch events
  (`new CustomEvent("item-action", { bubbles: true, composed: true, detail: ... })`) that
  bubble up through shadow DOMs to the feed widget.

### Simplified Plugin Manifest (Phase 3)

```json
{
  "name": "youtube-explorer",
  "run": "bun plugins/youtube-explorer/main.ts",
  "methods": ["youtube.auth.status", "youtube.auth.login", "youtube.auth.logout", "youtube.feed"],
  "version": "1.0.0",
  "description": "Browse YouTube",
  "author": "Community",
  "feeds": {
    "type": "video",
    "method": "youtube.feed",
    "card": "yt-video-card"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Unique plugin ID |
| `run` | ❌ | Command to spawn subprocess. Required for backend plugins. |
| `methods` | ❌ | RPC method prefixes for routing. `"youtube.feed"` matches calls to `"youtube.feed"`. |
| `version` | ❌ | Semver version. For marketplace and display. |
| `description` | ❌ | Short description. For display. |
| `author` | ❌ | Creator name. For display. |
| `ui` | ❌ | Web Component tag name for a main-UI WC. Path derived: `plugins/<name>/frontend/<tag>.js`. Only the feed plugin uses this. The WC is loaded AND mounted by App.tsx. |
| `feeds` | ❌ | Contributions to the unified feed. If present, this plugin is a feed source. |
| `feeds.type` | ✅ (if feeds) | Content type: `"video"`, `"image"`, `"post"`, `"short"`, etc. |
| `feeds.method` | ✅ (if feeds) | RPC method to call for items. Returns array of any-shaped objects. |
| `feeds.card` | ❌ | WC tag for rendering one item. Path: `plugins/<name>/frontend/<tag>.js`. If absent, item is skipped (no fallback yet). |

Minimum plugin (backend-only):
```json
{ "name": "hello-world", "run": "bun main.ts", "methods": ["hello.world"] }
```

### Simplified `ui` field meaning (Phase 3)
In Phase 1-2, `ui` meant a standalone widget card rendered by App.tsx. In Phase 3, `ui` simply means
"this plugin has a frontend WC that App.tsx should load AND mount as the main app content." The path
is derived: `plugins/<name>/frontend/<tag>.js`. Only the `feed` plugin uses this. Other plugins use
`feeds.card` to contribute card WCs (loaded, not mounted by App.tsx — mounted by feed-widget).

### Backward Compatibility
- Old format (`command`+`args`, `frontendComponent`, `frontendSlot`) is phased out.
- Host reads ONLY new format. All existing plugin.json files must be updated.
- Prototype plugins (greet-go, logger-py, joke-fetcher) are NOT updated. They remain as docs but
  won't work with the Phase 3 host.

### The `feed` Plugin

```
plugins/feed/
├── plugin.json         → { name: "feed", ui: "feed-widget" }
└── frontend/
    └── feed-widget.tsx  ← orchestrator WC (React via build system)
```

`plugin.json`:
```json
{
  "name": "feed",
  "description": "Aggregate content from all your plugins into a single feed",
  "author": "System",
  "version": "1.0.0",
  "ui": "feed-widget",
  "methods": []
}
```

- No `run` — no backend process needed
- No `feeds` — it IS the feed, not a contributor
- `ui: "feed-widget"` — App.tsx loads `plugins/feed/frontend/feed-widget.js` and renders `<feed-widget>`

### __pluginRpc Bridge (Phase 3 — Simple, No host.*)

The `__pluginRpc` bridge stays simple: it only routes to plugin subprocesses. No `host.*` prefix.

```javascript
window.__pluginRpc = async (method, params) => {
  const res = await electroview.rpc?.request.pluginRequest({ method, params })
  if (!res.success) throw new Error(res.error || "RPC error")
  return res.data
}
```

App.tsx calls host RPCs directly via `electroview.rpc.request.getPluginManifests({})` and
`electroview.rpc.request.getPluginFrontend({ path })` — NOT through `__pluginRpc`.

**Why no `host.*`?** The feed-widget doesn't need to call host RPCs. App.tsx (which has
`electroview` in scope) calls the host directly and passes data to feed-widget via
the `.manifests` property setter. This keeps `__pluginRpc` simple (one routing path)
and avoids adding host routing logic to the bridge.

### Per-Instance Framework Sharing (No Action Needed)
When the feed has 20 `<yt-video-card>` elements, they all share ONE WC class definition.
The framework (React, etc.) is in the class prototype, not in each DOM element.
`customElements.define("yt-video-card", YTVideoCard)` registers one class.
Each `<yt-video-card>` is just an instance — they share the prototype.
**No build-time sharing optimization needed. Ever.**

### Plugin.json Path Derivation Rules

| Manifest field | Purpose | Frontend path derived |
|----------------|---------|----------------------|
| `ui: "feed-widget"` | Main UI WC to mount | `plugins/feed/frontend/feed-widget.js` |
| `feeds.card: "yt-video-card"` | Card WC to register | `plugins/youtube-explorer/frontend/yt-video-card.js` |

Both are loaded by App.tsx. Card WCs are just registered (not mounted). Feed-widget is mounted.

### Card WC Contract

The feed passes data to card WCs via a `.item` property setter. Each card WC is a Web Component
wrapping a React component. The card's `.item` setter stores data AND triggers a React re-render.

#### The Pattern (React entry template)

Build script generates this `entry.tsx` for every React/Preact frontend:

```javascript
import Component from "./yt-video-card.tsx"
import { createRoot } from "react-dom/client"

customElements.define("yt-video-card", class extends HTMLElement {
  _item = null           // private storage (backing field for the setter)
  root = null

  connectedCallback() {
    this.root = createRoot(this)   // React takes over this element
    this._render()                  // initial render (item is null → shows "Loading...")
  }

  disconnectedCallback() {
    this.root?.unmount()
    this.root = null
  }

  // PUBLIC setter — called when feed does: card.item = { ... }
  set item(data) {
    this._item = data              // store in private field (NO setter → NO infinite loop)
    this._render()                 // tell React: re-render with new data!
  }

  // PUBLIC getter — called when feed reads: const data = card.item
  get item() {
    return this._item              // read from private storage
  }

  _render() {
    if (!this.root) return
    this.root.render(<Component item={this._item} />)
    // When _item is null → component receives item={null}
    // When _item is data → component receives item={ title: "Cats", ... }
  }
})
```

#### Data Flow (One Item)

1. Feed calls `youtube.feed` → gets array of items
2. Feed loops: `for (const item of items)`
3. `document.createElement("yt-video-card")` → browser creates WC → `connectedCallback()` runs
   - React mount: `createRoot(this)` → `_render()` → `<Component item={null} />` → shows "Loading..."
4. `card.item = item` → setter fires:
   - `this._item = item` — stores the data
   - `this._render()` — `root.render(<Component item={{ title: "Cats", ... }} />)`
   - React re-renders component with real data → shows title, thumbnail, etc.
5. `feedContainer.appendChild(card)` — adds to page display

API calls = number of PLUGINS (not items). One `youtube.feed` call returns 30 items → 30 cards, each with `.item` set to one array element.

#### Why `_item` (underscore)?

A setter cannot store data in a variable with the same name (`item`), because `this.item = data`
inside a `set item()` would call itself forever (infinite loop). So we separate:

| Name | Role | Type |
|------|------|------|
| `item` (setter) | PUBLIC — called by feed | Function (runs on `=`) |
| `_item` | PRIVATE storage | Regular variable (no setter) |
| `item` (getter) | PUBLIC — read by feed | Function (runs on read) |

The underscore `_` is a naming convention meaning "internal, don't touch directly."

#### Impact on Old Widgets

Old widgets (greet-widget, log-viewer, youtube-widget) also get the `.item` setter. It's harmless —
`_item` stays null forever (no one calls `card.item = ...` on them), so their React component
receives `item={null}` and ignores it. The widget continues calling `window.__pluginRpc()` directly
as before. No behavioral change.

#### Framework-Specific Entry Templates

The `.item` setter pattern applies to React and Preact (the two JSX frameworks). Vue/Svelte entries
keep their current pattern. When someone needs a Vue/Svelte feed card, the setter can be added to
those entries.

#### Build Script Tag Resolution (Needs Fix)

The build script currently tries to read `frontendComponent` from plugin.json — this field is gone
in Phase 3. It falls back to filename without extension (e.g., `yt-video-card.tsx` → tag
`"yt-video-card"`). This works coincidentally because:
- `feeds.card: "yt-video-card"` in manifest matches the filename
- The fallback produces the correct tag

**Fix needed**: Check `ui` and `feeds.card` fields first, fall back to filename if neither found.
Currently deferred — works by coincidence but should be explicit.

### Phase 3 Implementation — DONE

All 8 steps implemented and tested end-to-end. See Progress section for details.

Key differences from the original plan:
- **No `host.*` routing** — Step 3 was changed: `__pluginRpc` bridge was NOT extended with
  `host.` prefix. App.tsx calls host RPCs directly via `electroview.rpc.request`.
  Manifests are passed to feed-widget via `.manifests` setter, not via feed-widget calling host.
- **No separate `getPluginFrontend` handler with `name` param** — Instead takes `{ path }`
  parameter for more explicit path derivation.
- **`customElements.whenDefined()`** — Used in CardRenderer instead of `customElements.get()`
  to handle race conditions where card WC isn't registered yet.
- **Auth button in error banners** — Not in original plan. Added during implementation:
  feed-widget shows "Sign in" button when source has `.auth.login` method.
