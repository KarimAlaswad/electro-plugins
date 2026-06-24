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
frontends (Preact + Vue), centralized build script (scripts/build-plugins.js), auto-load
all plugin UIs on startup via window.__pluginRpc() global bridge. Two demo plugins exist:
greet (Go + Preact) and logger (Python + Vue).

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
│   └── build-plugins.js             # Centralized plugin frontend build (48 lines)
│       - Scans plugins/*/frontend/ for .jsx → esbuild --bundle
│       - Scans plugins/*/frontend/ for .vue → Vite build (IIFE format)
│       - Run: "bun run build:plugins" or auto-runs in "bun run start"
│
├── src/
│   ├── bun/
│   │   └── index.ts                 # HOST (~272 lines)
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
│   │       - All params typed as unknown, cast internally (Electrobun defineRPC requirement)
│   │       - getMainViewUrl(): checks Vite HMR on port 5173, falls back to bundled
│   │       - BrowserWindow creation, health check interval (5s), SIGINT cleanup
│   │
│   ├── mainview/
│   │   ├── App.tsx                  # FRONTEND (~152 lines)
│   │   │   - Electroview RPC bridge from electrobun/view
│   │   │   - window.__pluginRpc() global bridge for Web Components
│   │   │   - Auto-loads all plugin frontends on mount (getPluginFrontend → inject <script>)
│   │   │   - WebComponentSlot(): creates <tag> element inside <div> for each WC
│   │   │   - Plugin card list (name + desc + alive/dead badge + method buttons)
│   │   │   - callMethod() → pluginRequest RPC → display JSON result
│   │   │   - Result box (preformatted JSON in <pre>)
│   │   ├── main.tsx                 # React entry point (StrictMode, createRoot)
│   │   ├── index.html               # HTML shell (<div id="root"> + <script>)
│   │   └── index.css                # @tailwind base/components/utilities
│   │
│   └── shared/
│       └── types.ts                 # SHARED TYPES (29 lines):
│           - PluginInfo { name, alive, methods }
│           - PluginRequestParams { method, params: any }
│           - PluginRequestResults { success, data?, error? }
│           - PluginManifest { name, version, description, author,
│               command?, args?, methods?, frontendComponent?,
│               frontendFile?, frontendSlot? }
│
├── plugins/
│   ├── greet-go/
│   │   ├── plugin.json              # Flat manifest (12 lines)
│   │   │   - name: "greet", command: "./plugins/greet-go/greet"
│   │   │   - methods: ["greet.hello", "greet.bye"]
│   │   │   - frontendComponent: "greet-widget"
│   │   │   - frontendFile: "plugins/greet-go/frontend/greet-widget.js"
│   │   ├── main.go                  # Go backend (~78 lines)
│   │   │   - Request/Response structs with *json.RawMessage params
│   │   │   - stdin/stdout loop via bufio.Scanner
│   │   │   - greet.hello: returns greeting with param name (default "World")
│   │   │   - greet.bye: returns farewell with param name
│   │   ├── greet                    # Compiled binary (~2MB, in .gitignore)
│   │   └── frontend/
│   │       ├── greet-widget.jsx     # Preact Web Component source (42 lines)
│   │       │   - Text input + Hello/Bye buttons + JSON result display
│   │       │   - Calls window.__pluginRpc() for backend communication
│   │       └── greet-widget.js      # Built output (~139KB, esbuild --bundle)
│   │
│   └── logger-py/
│       ├── plugin.json              # Flat manifest (13 lines)
│       │   - name: "logger", command: "python3"
│       │   - args: ["plugins/logger-py/main.py"]
│       │   - methods: ["log.info", "log.list"]
│       │   - frontendComponent: "log-viewer"
│       │   - frontendFile: "plugins/logger-py/frontend/log-viewer.js"
│       ├── main.py                  # Python backend (~49 lines)
│       │   - send_response(): JSON + \n to stdout, then flush
│       │   - handle_request(): dispatches by method
│       │   - log.info: appends to electro-plugins.log, returns "ok"
│       │   - log.list: reads all lines from log file, returns array
│       │   - sys.stdin loop line by line
│       │   - params.get("params", {}) prevents AttributeError crash
│       │   - All indentation: 4 spaces (was 6 — fixed in bug #6)
│       └── frontend/
│           ├── log-viewer.vue       # Vue SFC source (27 lines)
│           │   - Refresh button + log entry list + error/loading states
│           │   - Calls window.__pluginRpc() for backend communication
│           ├── index.js             # Vue entry glue (8 lines)
│           │   - Imports .vue, creates Vue app, registers as WC
│           └── log-viewer.js        # Built output (~99KB, Vite IIFE build)
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

## Frontend Behavior (src/mainview/App.tsx — ~152 lines)

### Imports & Setup
- `useState, useEffect, useRef` from React (state, lifecycle, DOM references)
- `Electroview` from electrobun/view (Electrobun's browser-side RPC bridge)
- Type imports: `PluginInfo`, `PluginManifest` from shared/types

### Global Bridge (module-level, outside App component)
```typescript
window.__pluginRpc = async (method: string, params: any) => {
  const res = await electroview.rpc?.request.pluginRequest({ method, params })
  return res.data
}
```
- Any Web Component can call `window.__pluginRpc(method, params)` without importing Electrobun
- Extracts `.data` from the `{ success, data, error }` response envelope

### WebComponentSlot (Helper Component)
```typescript
function WebComponentSlot({ tag }: { tag: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const el = document.createElement(tag);
    ref.current.appendChild(el);
  }, [tag]);
  return <div ref={ref} />;
}
```
- Takes a `tag` prop (e.g., `"greet-widget"`)
- Creates a DOM element with that tag name inside a `<div>`
- If the WC was already registered via `customElements.define()`, the browser auto-instantiates it
- Clears previous content before mounting (prevents duplicates on re-render)

### App Component — State
- `manifests` — array of `PluginManifest` from `getPluginManifests` RPC
- `plugins` — array of `PluginInfo` from `pluginList` RPC (alive/dead status)
- `result` — JSON string to display in the result box
- `loading` — currently loading method (disables buttons while in progress)
- `loadedPlugins` — `Set<string>` tracking which frontends have been injected (prevents double-loading)

### On Mount — Two Effects

**Effect 1: Load manifests and plugin status**
```typescript
useEffect(() => { loadManifests(); loadPlugins() }, [])
```
Runs once when App mounts. Fetches both manifest data and alive/dead status.

**Effect 2: Auto-load all frontend Web Components**
```typescript
useEffect(() => {
  if (manifests.length === 0) return
  loadAllFrontends()
}, [manifests])
```
Runs when `manifests` state array is populated. For each manifest with a `frontendComponent`:
1. Skip if already loaded (checked via `loadedPlugins` Set)
2. Call `getPluginFrontend({ name })` → get JS code string
3. Create `<script>` element, set `textContent` = code
4. Append to `<body>` → browser executes script → `customElements.define()` called
5. Any `<tag-name>` elements on the page now render the WC

### Plugin Cards
- Rendered from `plugins.map()` — one card per plugin
- Top bar: plugin name (heading) + description + version + alive/dead badge
- Badge: green `● Alive` or red `● Dead` (conditional CSS classes)
- Method buttons: one per method name (e.g., "greet.hello", "log.list")
- All buttons disabled while `loading !== null`
- Below buttons: if manifest has `frontendComponent`, render `<WebComponentSlot tag={...} />`

### Calling a Plugin (from host method buttons)
1. Click a method button → `callMethod(method)`
2. Sets `loading` to method name (disables all buttons)
3. Calls `electroview.rpc.request.pluginRequest({ method, params: {} })`
4. On success: `JSON.stringify(res, null, 2)` → display in `<pre>` result box
5. On error: display error message
6. `finally { setLoading(null) }` — re-enable buttons

### Result Box
- Only visible when `result !== ""`
- Uses short-circuit `{result && (<div>...<pre>{result}</pre>...</div>)}`
- Pre-formatted JSON in a gray `<pre>` block with `overflow-x-auto` (horizontal scroll)

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

### Fields
| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | ✅ | string | Unique identifier. Used in RPC (e.g., getPluginFrontend), displayed as card title |
| `version` | ✅ | string | Semver version (e.g., "1.0.0"). Displayed in card header |
| `description` | ✅ | string | Short description. Displayed in card header |
| `author` | ✅ | string | Creator name. Displayed in card header |
| `command` | ❌ | string | Executable path. Absolute, relative to project root, or bare name in PATH (e.g., "bun", "python3"). Omit for frontend-only plugins |
| `args` | ❌ | string[] | Arguments to pass to command. Paths resolved relative to project root via `resolvePath()` |
| `methods` | ❌ | string[] | Array of exact method names (e.g., `["greet.hello", "greet.bye"]`). Used for routing AND displayed as buttons in the plugin card |
| `frontendComponent` | ❌ | string | HTML tag name for custom element (e.g., `"greet-widget"` → `<greet-widget>`). Must match the name passed to `customElements.define()` |
| `frontendFile` | ❌ | string | Path to built Web Component .js file (relative to project root). Read by `getPluginFrontend` RPC |
| `frontendSlot` | ❌ | string | Where in the UI this WC appears. Currently only `"main"` is supported. Future: `sidebar`, `header`, `statusbar`, `settings` |

### Plugin Types (Determined by Fields Present)
- **Backend-only**: Has `command` but no `frontend*` fields → spawned as subprocess, no UI
- **Frontend-only**: Has `frontendComponent`/`frontendFile` but no `command` → loaded as WC, no subprocess
- **Fullstack**: Has BOTH → spawned as subprocess AND WC auto-loaded in plugin card

---

## Plugin Implementations

### greet-go — Go Backend + Preact Frontend

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

#### Frontend (greet-widget.jsx — 42 lines) — Preact Web Component
```jsx
import { useState } from "preact/hooks"
import { render } from "preact"

function GreetUI() {
  const [name, setName] = useState("World")
  const [result, setResult] = useState(null)

  async function call(method) {
    setResult("Loading...")
    try {
      const res = await window.__pluginRpc(method, { name })
      setResult(res)
    } catch (e) {
      setResult({ error: e.message })
    }
  }

  return (
    <div>
      <input type="text" value={name} onInput={e => setName(e.target.value)} />
      <button onClick={() => call("greet.hello")}>Hello</button>
      <button onClick={() => call("greet.bye")}>Bye</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}

class GreetWidget extends HTMLElement {
  connectedCallback() { this.root = render(<GreetUI />, this) }
  disconnectedCallback() { render(null, this) }
}
customElements.define("greet-widget", GreetWidget)
```
- Uses Preact (3KB React-like library with same API). Full Preact inlined into bundle by esbuild.
- Text input bound to `name` state via `useState`
- Hello/Bye buttons call `window.__pluginRpc(method, { name })` and display JSON result
- `GreetWidget` extends `HTMLElement` — the browser standard for custom elements
- `connectedCallback()` — lifecycle hook called when element is added to the DOM. Renders Preact inside the element.
- `disconnectedCallback()` — lifecycle hook called when element is removed. Cleans up Preact render.
- `customElements.define("greet-widget", GreetWidget)` — registers the element globally
- Built by esbuild: `esbuild greet-widget.jsx --bundle --outfile=greet-widget.js`
- Output: ~139KB (includes Preact + dependencies, all self-contained in a single file)

### logger-py — Python Backend + Vue Frontend

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

#### Frontend (log-viewer.vue — 27 lines + index.js — 8 lines) — Vue Web Component
**log-viewer.vue:**
```vue
<template>
  <div>
    <button @click="refresh">Refresh</button>
    <p v-if="entries === null">Click Refresh to load logs.</p>
    <ul v-else-if="Array.isArray(entries)">
      <li v-if="entries.length === 0">No log entries yet.</li>
      <li v-for="(e, i) in entries" :key="i">{{ e }}</li>
    </ul>
    <pre v-else>{{ typeof entries === 'string' ? entries : JSON.stringify(entries, null, 2) }}</pre>
  </div>
</template>

<script setup>
import { ref } from "vue"
const entries = ref(null)
async function refresh() {
  entries.value = "Loading..."
  try {
    const res = await window.__pluginRpc("log.list", {})
    entries.value = res.data || res
  } catch (e) {
    entries.value = [{ error: e.message }]
  }
}
</script>
```
- Single File Component (SFC) — `<template>` for HTML + `<script setup>` for logic
- Refresh button calls `window.__pluginRpc("log.list", {})` to fetch log entries
- Shows entries as `<ul><li>` list
- Handles all states: null (initial), empty array, array with entries, loading string, error objects
- Uses `v-if`/`v-else-if`/`v-else` chain for conditional rendering

**index.js (entry glue):**
```javascript
import { createApp } from "vue"
import LogViewer from "./log-viewer.vue"
customElements.define("log-viewer", class extends HTMLElement {
  connectedCallback() { createApp(LogViewer).mount(this) }
})
```
- Imports the Vue component
- Defines a Web Component class that mounts a fresh Vue app on `connectedCallback()`
- `createApp(LogViewer)` — creates a new Vue application instance
- `.mount(this)` — mounts the Vue app into the custom element as its host

**Build:** Vite generates a temp config, runs `npx vite build`, deletes the config.
Output: ~99KB (IIFE format, includes Vue runtime, all self-contained).

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

### ⚠️ IN PROGRESS — Phase 2: Real API Plugins
- [ ] Planning the first real API plugin (simple public API → fetch → display data)
- [ ] Choose API: Dog API (dog.ceo), Pokémon API, Joke API, or Weather API
- [ ] Create plugin directory + manifest
- [ ] Write backend — fetch from API, serve via JSON-RPC
- [ ] Write frontend Web Component — display fetched data with UI
- [ ] Build and test end-to-end
- [ ] Show real internet data rendered in the app

### ❌ PLANNED — Future Phases

**Phase 3: Second API Plugin + Same Media Type**
- [ ] Add another API plugin producing the same media type
- [ ] Start designing the unified feed concept
- [ ] Build a combined feed view for that media type

**Phase 4: Media Type Architecture**
- [ ] Design the category/feed system
- [ ] Build generalized features for a media type
- [ ] Plugin registry for feature sharing

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
