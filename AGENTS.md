# Electro Plugins — Complete Project Knowledge Base

## ALWAYS ON FIRST TURN: Load coding skill
Use `skill` tool with name `"coding", "caveman"` on every session's first turn before doing anything else.

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

Phase 1 (Plugin System) IS COMPLETE — flat manifests, host manifest scanning at startup,
plugin spawning with stdin/stdout pipes, JSON-RPC routing by method prefix, Web Component
frontends (Preact + Vue), centralized build script (scripts/build-plugins.ts).

Phase 2 (YouTube Explorer) IS COMPLETE — Bun/TS backend with Innertube API, cookie auth
via browser DB discovery, search + home feed + auth flow, WC frontend with embedded player.

Phase 3 (Unified Feed) IS COMPLETE — old per-plugin widget cards removed. App.tsx loads
manifests, injects card frontend scripts, and mounts UI plugin elements from a `uiPlugins[]`
array (not a single `uiPlugin`). A `<feed-widget>` discovers feed-contributing plugins at
runtime, calls their feed methods using `name + "." + method` RPC prefix, and renders their
card WCs via `CardRenderer`. Plugin manifest simplified: `run` replaces `command`+`args`,
`feeds` block replaces `frontendComponent`/`frontendFile`/`frontendSlot`, new `components`
field for WC tags that need building but should NOT be mounted as main UI.

Current working state: Feed-widget displays all 5 render states (loading, auth-required,
error per source, empty, cards). yt-feed (YouTube feed via Innertube API) works with
lazy cookie reload. yt-auth plugin provides login/logout/status using browser DB discovery
and writes shared cookie file. yt-card provides `yt-video-card` as a `components` entry
(not `ui` — never mounted as top-level view, only instantiated per feed item). Player modal
uses iframe and `player-load` custom event. peertube-card and peertube-feed are functional
for PeerTube. Sign-in buttons per auth plugin are shown/hidden based on searching ALL
manifests for a plugin with `methods.includes("login")`.

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

### Data Flow (End-to-End — Phase 3)
1. App starts → Host spawns all backend plugins with `run` field via recursive manifest scan
2. WebView loads → App.tsx mounts (Electroview RPC bridge initialized)
3. App.tsx calls `getPluginManifests` → gets array of all manifests
4. App.tsx collects WC tags from `feeds[*].card` and `ui` fields (dedup)
5. For each unique tag:
   - Call `getPluginFrontend({ path: "build/plugins/<tag>.js" })` → returns JS as string
   - Create `<script>` element, set `textContent` = code, append to `<body>`
   - Script calls `customElements.define()` → Web Component registered globally
6. App.tsx builds `uiPlugins[]` array, creates each UI WC imperatively via `document.createElement` in `#feed-container`, sets `.manifests = all`
7. Feed-widget (one of the UI WCs) receives manifests via `.manifests` setter, calls `loadFeed()`
8. Feed-widget discovers feed sources (plugins with `feeds[]`), calls `__pluginRpc(name + "." + method, {})` for each
9. Host `routeRequest` splits method on first dot → finds plugin by `config.name` → sends action to plugin stdin
10. Plugin reads stdin line, processes request (e.g., Innertube API call), writes response to stdout
11. Host reads stdout line, parses JSON, matches by `id`, resolves promise
12. Result flows back through RPC → `window.__pluginRpc` returns → feed-widget receives items
13. Feed-widget creates card WCs (`document.createElement(tag)`), sets `.item = rawItem`, appends to container

---

## File Structure (ACCURATE — matches code on disk as of July 2026)

```
/mnt/5TB/Projects/electro-plugins/
├── AGENTS.md                        ← THIS FILE (update every session!)
├── opencode.jsonc                   # OpenCode project config (skill auto-load, caveman plugin)
├── electrobun.config.ts             # Build config (copy rules commented out in dev)
├── vite.config.ts                   # Vite: React plugin, port 5173, root at src/mainview
├── package.json                     # Dependencies + scripts
│   ├─ "start": "bun run build:plugins && vite build && electrobun dev"
│   ├─ "dev": "electrobun dev --watch"
│   ├─ "dev:hmr": "concurrently \"bun run hmr\" \"bun run start\""
│   ├─ "hmr": "vite --port 5173"
│   ├─ "build:plugins": "bun scripts/build-plugins.ts"
│   └─ Deps: electrobun 1.18.1, react 18, preact 10, vue 3, vite 6
├── tsconfig.json                    # TypeScript strict mode
├── postcss.config.js                # PostCSS with Tailwind + autoprefixer
├── tailwind.config.js               # Tailwind content: src/mainview/**/*
├── bun.lock                         # Bun lock file
├── .gitignore                       # Build output, node_modules, .youtube-cookie, *.log
│
├── scripts/
│   └── build-plugins.ts             # Centralized plugin frontend build
│       - Scans plugin.json files under plugins/ for tag names:
│         manifest.ui, manifest.components[], manifest.feeds[*].card
│       - Each unique tag → find source .tsx/.jsx → esbuild --bundle
│         - Search source dir: plugin's own dir first
│         - Cross-directory fallback: map from plugins/ subdirs by tag name
│       - Output: build/plugins/<tag>.js
│       - Entry template has _item setter, _manifests setter, React/Preact mount
│       - Run: "bun run build:plugins" or auto-runs in "bun run start"
│
├── src/
│   ├── bun/
│   │   └── index.ts                 # HOST (~450 lines)
│   │       - Types: PendingRequest, PluginInstance
│   │       - findProjectRoot(): walks up from import.meta.dir to find package.json
│   │       - resolvePath(): makes relative paths absolute for Bun.spawn args
│   │       - Manifest scanning: recursive scan plugins/**/plugin.json + JSON.parse
│   │       - Plugin spawning: Bun.spawn(), push to array, start readers
│   │       - sendToPlugin(): stdin.write() (FileSink, not getWriter)
│   │       - handlePluginResponse(): JSON.parse → match by id → resolve/reject → delete
│   │       - readStdout(): async reader, buffers partial lines across chunks
│   │       - readStderr(): same pattern, logs to console
│   │       - routeRequest(): method prefix match → Promise with 10-second timeout
│   │       - 4 original RPC handlers + 2 new hook handlers (see RPC table)
│   │       - resolveHook(hook): finds all plugins matching a hook (e.g., "feed.video")
│   │       - callHook(hook, method?, params): calls resolveHook + pluginRequest on each
│   │       - Reads `run`, `methods`, `ui`, `feeds[]`, `components[]`, `hooks[]`
│   │       - getPluginFrontend takes { path } (e.g., "build/plugins/feed-widget.js")
│   │       - getMainViewUrl(): checks Vite HMR on port 5173, falls back to bundled
│   │       - BrowserWindow creation, health check interval (5s), SIGINT cleanup
│   │
│   ├── mainview/
│   │   ├── App.tsx                  # FRONTEND (~102 lines)
│   │   │   - Electroview RPC bridge with maxRequestTime: 20000 (CRITICAL)
│   │   │   - window.__pluginRpc() global bridge (routes to pluginRequest)
│   │   │   - window.resolveHook(hook) global — resolves hook → matching plugins
│   │   │   - window.callHook(hook, method?, args) global — calls a hook
│   │   │   - On mount: fetches manifests, loads frontends from build/plugins/<tag>.js
│   │   │   - Collects uiPlugins[] array + dedup-loaded cards from feeds[].card
│   │   │   - Creates WC elements for ALL ui plugins (not just last), appends to #feed-container
│   │   │   - Passes manifests via .manifests setter on each UI WC
│   │   │   - No React VDOM for plugin WCs — created imperatively in container div
│   │   ├── main.tsx                 # React entry point (StrictMode, createRoot)
│   │   ├── index.html               # HTML shell (<div id="root"> + <script>)
│   │   └── index.css                # @tailwind base/components/utilities
│   │
│   └── shared/
│       ├── types.ts                 # SHARED TYPES (34 lines):
│       │   - PluginInfo { name, alive, methods }
│       │   - PluginRequestParams { method, params: any }
│       │   - PluginRequestResults { success, data?, error? }
│       │   - FeedContrib { type: string, method?: string, card?: string }
│       │   - PluginManifest { name, version?, description?, author?,
│       │       run?, methods?, ui?, feeds?: FeedContrib[], hooks?: string[] }
│       └── define-wc.tsx           # Shared WC definition helper (19 lines)
│           - defineWC(tag, Component) → customElements.define + createRoot
│           - For simple WCs that don't need _item/_manifests setters
│
├── plugins/
│   ├── feed/                        # Feed orchestrator (no backend)
│   │   ├── plugin.json              # { name: "feed", ui: "feed-widget" }
│   │   └── feed-widget.tsx          # React WC — feed orchestrator
│   │       - .manifests setter from App.tsx
│   │       - 5-state machine: loading, error, empty, partial, loaded
│   │       - For each manifest with feeds[]: calls callHook(feeds[].type, feeds[].method)
│   │       - CardRenderer: creates card WCs, sets .item, uses whenDefined
│   │       - Error banners per-source with "Sign in" button
│   │       - Auth: searches ALL manifests for login method, not just source
│   │       - Uses name + "." + method RPC prefix for plugin calls
│   │
│   ├── youtube/                     # YouTube parent plugin (container only)
│   │   ├── plugin.json              # { name: "youtube", metadata only — no run, no ui }
│   │   ├── .youtube-cookie          # Shared cookie file written by yt-auth, read by yt-feed
│   │   └── plugins/
│   │       ├── yt-feed/             # YouTube feed backend (Bun/TS)
│   │       │   ├── plugin.json      # { name: "yt-feed", run, hooks: ["feed.video"],
│   │       │   │                      methods: ["feed"], feeds: [{type:"video",card:"yt-video-card"}] }
│   │       │   └── main.ts          # Innertube API, home feed, lazy cookie reload
│   │       ├── yt-auth/             # YouTube cookie auth (Bun/TS)
│   │       │   ├── plugin.json      # { name: "yt-auth", run, hooks: ["auth"],
│   │       │   │                      methods: ["login","logout","status"] }
│   │       │   └── main.ts          # Browser DB discovery (Firefox SQLite, Chrome via sweet-cookie)
│   │       ├── yt-card/             # YouTube video card WC (no backend)
│   │       │   ├── plugin.json      # { name: "yt-card", components: ["yt-video-card"] }
│   │       │   └── yt-video-card.tsx # React card WC — thumbnail, title, channel, views
│   │       └── yt-search/           # YouTube search backend (Bun/TS)
│   │           ├── plugin.json      # { name: "yt-search", run, hooks: ["search"],
│   │           │                      methods: ["search"] }
│   │           └── main.ts          # Innertube search
│   │
│   ├── peertube/                    # PeerTube plugin (Bun/TS + React WC)
│   │   ├── plugin.json              # { name: "peertube", run, hooks: ["feed.video"],
│   │   │                              methods: ["list"], feeds: [{type:"video",card:"peertube-card"}] }
│   │   ├── main.ts                  # PeerTube API feed
│   │   └── peertube-card.tsx        # React card WC
│   │
│   └── video-player/                # Video player modal (Bun/TS + React WC)
│       ├── plugin.json              # { name: "video-player", run, ui: "player-modal",
│       │                              hooks: ["player"], methods: ["load"] }
│       ├── main.ts                  # Backend (metadata, empty methods)
│       └── player-modal.tsx        # React WC — iframe-based player
│           - Listens for "player-load" custom event on window
│           - Renders <iframe> (not <video>) for embed URLs
│           - Calls __pluginRpc("load", {url}) when event fires
│
├── build/
│   └── plugins/                     # Build output (built frontend .js files)
│       ├── feed-widget.js
│       ├── yt-video-card.js
│       ├── peertube-card.js
│       └── player-modal.js
├── dist/                            # Vite build output (in .gitignore)
├── node_modules/                    # (in .gitignore)
└── electro-plugins.log              # (obsolete — from old logger-py, in .gitignore)
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

## Host Behavior (src/bun/index.ts — ~340 lines)

### Startup Sequence
1. `findProjectRoot(import.meta.dir)` — walks up directory tree until `package.json` found. Works in both dev and bundled modes.
2. `baseDir = findProjectRoot(...)` — store the project root absolute path
3. `getAllPluginManifests(join(baseDir, "plugins"))` — recursive directory scan: for each dir with `plugin.json`, parse JSON; recurse into subdirectories. Supports nested plugins (e.g., `plugins/youtube/plugins/yt-feed/`).
4. For each manifest with `run` field (formerly `"command"`):
   a. Split `run` by whitespace → `[cmd, ...args]` (single string for command + args)
   b. `resolvePath(cmd)` and `resolvePath(args)` — if relative, join with baseDir; absolute as-is; bare name (bun/python3) returned unmodified
   c. `Bun.spawn([cmd, ...args], { stdin: "pipe", stdout: "pipe", stderr: "pipe" })`
   d. Store as `PluginInstance { config: manifest, process: proc, alive: true }`
   e. Start async `readStdout(plugin)` + `readStderr(plugin)`
   f. `proc.exited.then(code => { plugin.alive = false })` — marks dead on exit
5. Define RPC handlers via `BrowserView.defineRPC()` — 6 request handlers (see RPC table)
6. If bundled mode (no Vite): start static server via `startStaticServer()` -> `Bun.serve()` that serves `dist/` or `views/mainview/`
7. `getMainViewUrl()` — checks Vite HMR on port 5173 (in dev channel), returns dev URL if available, else bundled HTML via static server
8. `new BrowserWindow({ title, url, frame, rpc })` — create the app window
9. `setInterval()` — health check every 5 seconds (logs dead plugins, no auto-restart)
10. `process.on("SIGINT")` — stop server, kill all plugin processes, exit

### RPC Handlers

All handlers use `(params: unknown) =>` with internal casts.

| Handler | Params (cast from unknown) | Returns |
|---------|---------------------------|---------|
| `pluginRequest` | `{ method: string, params: any }` | `{ success, data?, error? }` |
| `pluginList` | ignored | `[{ name, alive, methods }]` |
| `getPluginManifests` | ignored | `[{ name, version?, description?, author?, methods[], hooks[], ui?, feeds? }]` |
| `getPluginFrontend` | `{ path: string }` | `{ code: string }` or `{ error: string }` |
| `resolveHook` | `{ hook: string }` | `{ success, data: { name, methods } }` or `{ success: false, error }` |
| `callHook` | `{ hook: string, method?: string, params: any }` | `{ success, data? }` or `{ success: false, error }` |

**RPC details:**
- `pluginRequest(method, params)`: calls `routeRequest(method, params)` which splits method by `.` — first part is plugin name, rest is action. Finds plugin by `config.name`, sends `{id, method: action, params}` via stdin. Returns Promise with 10s timeout.
- `getPluginManifests`: returns all manifests with fields: name, version, description, author, methods, hooks, ui, feeds. No `components` field returned (yet — yt-card still identified for frontend loading by App.tsx scanning feeds[].card + ui).
- `getPluginFrontend({ path })`: restricted to `build/plugins/` directory (security). Reads file via `Bun.file().text()`.
- `resolveHook({ hook })`: finds first plugin with `config.hooks.includes(hook)`. Returns `{name, methods}`.
- `callHook({ hook, method?, params })`: finds plugin for hook, calls `routeRequest(name.method, params)`. Defaults to `methods[0]` if no method specified.

### stdout Reader (readStdout)
- Web Streams API: `plugin.process.stdout.getReader()`
- Buffers partial lines across chunks (split by `\n`, keep incomplete line in buffer via `lines.pop()`)
- Each complete line passed to `handlePluginResponse()`

### Response Handling (handlePluginResponse)
1. `JSON.parse(line)` → get `msg`
2. Match by `msg.id` to pending request
3. `clearTimeout(timer)` + `pendingRequests.delete(id)`
4. `msg.error` exists → `reject(new Error(msg.error))`
5. Else → `resolve(msg.result)`

### Health Check
- `setInterval()` every 5000ms
- Logs dead plugins (no auto-restart)

### Cleanup
- `process.on("SIGINT")` — kills all plugin subprocesses, stops static server

---

## Frontend Behavior (src/mainview/App.tsx — ~102 lines)

### Imports & Setup
- `useState, useEffect` from React
- `Electroview` from electrobun/view (Electrobun's browser-side RPC bridge)
- Type imports: `PluginManifest` from shared/types
- NO `useRef` — UI plugin elements created imperatively, not via React refs

### RPC Configuration
```typescript
const electroview = new Electroview({
  rpc: Electroview.defineRPC({
    maxRequestTime: 20000,  // MUST be >= all inner timeouts combined
    handlers: { requests: {}, messages: {} },
  }),
})
```
- `maxRequestTime: 20000` is CRITICAL. Host has 15000ms, routeRequest has 10s, plugin has 8s.
  Frontend timeout must be the largest (20s) because it's the outermost caller.

### Global Bridges (module-level, outside App component)
```typescript
window.__pluginRpc = async (method: string, params: any) => {
  const res = await electroview.rpc?.request.pluginRequest({ method, params })
  if (!res.success) throw new Error(res.error || "RPC error")
  return res.data
}
```
- Any WC can call `window.__pluginRpc(method, params)` without importing Electrobun
- No `host.*` routing — bridge only routes to plugin subprocesses
- Method format: `"name.action"` (e.g., `"yt-feed.feed"`) — host splits on first dot to find plugin by name

```typescript
window.resolveHook = async (hook: string) => {
  const res = await electroview.rpc.request.resolveHook({ hook })
  if (!res.success) throw new Error(res.error || "Hook resolution failed")
  return res.data
}
window.callHook = async (hook: string, methodOrArgs: any, args?: any) => {
  const method = args !== undefined ? methodOrArgs : undefined
  const params = args !== undefined ? args : methodOrArgs
  const res = await electroview.rpc.request.callHook({ hook, method, params })
  if (!res.success) throw new Error(res.error || "callHook failed")
  return res.data
}
```
- `resolveHook(hook)` → finds plugin providing that hook (e.g., `"feed.video"` → yt-feed)
- `callHook(hook, method?, args)` → resolves hook + calls plugin method

### App Component — State
- `manifests` — array of `PluginManifest` from `getPluginManifests` RPC

### On Mount — Init Function
```typescript
useEffect(() => { init().catch(e => { ... }) }, [])
```
`init()` does:
1. Fetches manifests via `electroview.rpc.request.getPluginManifests({})`
2. For each manifest, collects WC tags from `feeds[].card` and `ui` (dedup by tag)
3. Loads each frontend JS via `getPluginFrontend({ path: "build/plugins/<tag>.js" })`
   - `path` starts with `build/plugins/` (NOT `plugins/x/frontend/y.js`)
   - Restricted to `build/plugins/` directory by host security check
4. Builds `uiPlugins[]` array — all manifests with `ui` field
5. For each UI plugin: waits for WC definition, creates element imperatively, sets `.manifests = all`, appends to `#feed-container`
   - Creates elements for ALL UI plugins (not just last one)
   - Uses `document.getElementById("feed-container")` — not React refs

### Render
```typescript
return (
  <div className="...">
    <h1>Electro Plugins</h1>
    <div id="feed-container" />
  </div>
)
```
- Only renders a container div — UI plugin elements are created imperatively inside it
- No React refs to web components — elements managed via `document.getElementById`
- No `<feed-widget>` in JSX — created imperatively

---

## Build System

`scripts/build-plugins.ts` (~191 lines) — centralized build for all plugin frontends.

### How It Works
1. Scans `plugins/` recursively via `findPluginDirs()` — finds all directories containing `plugin.json` (supports nested plugins like `plugins/youtube/plugins/yt-card/`)
2. For each plugin dir, reads `plugin.json` and collects WC tag names from:
   - `manifest.ui` (single tag, e.g., `"feed-widget"`)
   - `manifest.components[]` (array of tags, e.g., `["yt-video-card"]`)
   - `manifest.feeds[*].card` (card tags from each feed contribution, e.g., `"yt-video-card"`)
3. Deduplicates tags across plugins (`new Set()`)
4. For each unique tag:
   a. Finds source file: checks `<dir>/<tag>.tsx`, `.jsx`, `.vue`, `.svelte` in order
   b. If not found in plugin's dir, skips (defers to plugin that declares it — cross-directory ownership via `components` field)
   c. Reads source content to auto-detect framework (React vs Preact) via import string matching
   d. Generates a temporary `.vite.config.mjs`, `entry.tsx` (with WC boilerplate), and `style.css`
   e. Runs `bunx vite build --config <configFile>` targeting IIFE format
   f. Output: `build/plugins/<tag>.js` (deleted temp files after build)
5. Framework auto-detection: reads source file, checks for `"react"`/`"react-dom"` imports (React) vs `"preact"`/`"preact/hooks"` (Preact). Falls back to first match if ambiguous.

### Entry Template (React example)
Generated by the build script's `entry()` function:
```typescript
import Component from "./yt-video-card.tsx"
import { createRoot } from "react-dom/client"
customElements.define("yt-video-card", class extends HTMLElement {
  root = null
  _item = null
  _manifests = null
  connectedCallback() { this.root = createRoot(this); this._render() }
  disconnectedCallback() { this.root?.unmount(); this.root = null }
  set item(d) { this._item = d; this._render() }
  set manifests(d) { this._manifests = d; this._render() }
  _render() { this.root.render(<Component item={this._item} manifests={this._manifests} />) }
})
```
- All WCs get `_item` and `_manifests` setters (even non-card WCs — harmless)
- CSS inlined via `vite-plugin-css-injected-by-js` (Tailwind classes included)

### Tag Sources
| Manifest Field | Type | Purpose |
|---------------|------|---------|
| `ui: "feed-widget"` | string | Main UI WC (built + mounted by App.tsx) |
| `components: ["yt-video-card"]` | string[] | Built-only WCs (not mounted by App.tsx) |
| `feeds[i].card: "yt-video-card"` | string | Feed item card WCs (loaded, mounted by feed-widget) |

### Cross-Directory Source Discovery
When a plugin references a WC tag (via `feeds[].card`) but the source file isn't in that plugin's directory:
- Build script logs `skip <tag> (source not found in <dir>)`
- The tag WILL be built if ANOTHER plugin declares it in `components[]` or `ui`
- Fix: Declare `components: ["<tag>"]` on the plugin that owns the source file
- Example: `plugins/youtube/plugins/yt-card/plugin.json` has `components: ["yt-video-card"]` — builds the source in its own directory

### Entry Template Paths (at runtime, in App.tsx)
Frontend JS is loaded from `build/plugins/<tag>.js` via `getPluginFrontend({ path })`.
Previously: `plugins/<name>/frontend/<tag>.js`. Now: `build/plugins/<tag>.js`.

### Run Commands
```bash
bun run build:plugins          # Build all plugin frontends (output to build/plugins/)
bun run start                  # build:plugins + vite build + electrobun dev
```

### Framework Handling
| Framework | Source Ext | Build Tool | Bundle Size |
|-----------|-----------|------------|-------------|
| React | .tsx/.jsx | Vite (IIFE) | ~40KB + code |
| Preact | .tsx/.jsx | Vite (IIFE) | ~3KB + code |
| Vue | .vue | Vite (IIFE) | ~35KB + code |
| Svelte | .svelte | Vite (IIFE) | varies |

"Works forever" principle: framework code inlined into the plugin's .js file.
The plugin never depends on what version of React/Vue/Preact the host app uses.

---

## Plugin Manifest Schema (Current — Flat Format)

```json
{
  "name": "yt-feed",
  "run": "bun plugins/youtube/plugins/yt-feed/main.ts",
  "hooks": ["feed.video"],
  "methods": ["feed"],
  "feeds": [
    { "type": "video", "card": "yt-video-card" }
  ]
}
```

### Fields
| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Unique plugin ID. Used in RPC routing, path derivation |
| `version` | ❌ | Semver version. |
| `description` | ❌ | Short description. |
| `author` | ❌ | Creator name. |
| `run` | ❌ | Command to spawn subprocess. Example: `"bun plugins/youtube/plugins/yt-feed/main.ts"` |
| `methods` | ❌ | Array of method prefixes for direct RPC routing. Example: `["feed", "login", "logout", "status"]` |
| `hook` | ❌ | Alias for `hooks` (single string). Which hooks this plugin satisfies. |
| `hooks` | ❌ | Array of hook strings. Which hooks this plugin satisfies. Example: `["feed.video", "auth"]` |
| `ui` | ❌ | WC tag for main-UI rendering. Path: `build/plugins/<tag>.js`. App.tsx loads AND mounts this. |
| `components` | ❌ | Array of WC tag names that need building but are neither `ui` nor `feeds[].card`. Example: `["yt-video-card"]` |
| `feeds` | ❌ | Array of feed contribution objects. If present, this plugin is a feed source. |
| `feeds[].type` | ✅ (if feeds) | Content type: `"video"`, `"image"`, `"post"`, etc. Also used as default hook for resolution. |
| `feeds[].method` | ❌ | RPC method to call. Defaults to `methods[0]`. |
| `feeds[].card` | ❌ | WC tag for rendering one item. Path: `build/plugins/<tag>.js`. If absent, items skipped. |

### Plugin Types
- **Backend-only**: Has `run` but no `ui`/`feeds` → spawned as subprocess, no UI
- **Frontend-only (main UI)**: Has `ui` but no `run` → WC loaded and mounted by App.tsx
- **Frontend-only (card/component)**: Has `components` or `feeds[].card` but no `run` → WC loaded by App.tsx, mounted by feed-widget
- **Fullstack**: Has `run` + `ui`/`feeds` → subprocess + frontend components
- **Feed source**: Has `run` + `feeds` → subprocess with feed method + card WC

**Frontend path derivation** (build time and runtime):
- Build script collects tags from: `ui`, `components[]`, `feeds[*].card`
- Output: `build/plugins/<tag>.js`
- Search: plugin's own directory first, then cross-directory fallback by tag name

### Example Manifests

**yt-feed (feed source, backend + card)**:
```json
{
  "name": "yt-feed",
  "run": "bun plugins/youtube/plugins/yt-feed/main.ts",
  "hooks": ["feed.video"],
  "methods": ["feed"],
  "feeds": [{ "type": "video", "card": "yt-video-card" }]
}
```

**yt-auth (auth provider, backend-only)**:
```json
{
  "name": "yt-auth",
  "run": "bun plugins/youtube/plugins/yt-auth/main.ts",
  "hooks": ["auth"],
  "methods": ["login", "logout", "status"]
}
```

**yt-card (component provider, frontend-only)**:
```json
{
  "name": "yt-card",
  "components": ["yt-video-card"]
}
```

**feed (main UI, frontend-only)**:
```json
{
  "name": "feed",
  "description": "Aggregate content from all your plugins into a single feed",
  "author": "Me",
  "version": "1.0.0",
  "ui": "feed-widget"
}
```

**video-player (fullstack with ui)**:
```json
{
  "name": "video-player",
  "run": "bun plugins/video-player/main.ts",
  "hooks": ["player"],
  "methods": ["load"],
  "ui": "player-modal"
}
```

---

## Plugin Implementations

### Phase 1/2 Demo Plugins (REMOVED FROM DISK — Historical Reference Only)
- **greet-go** — Go backend (greet.hello, greet.bye). Frontend (greet-widget) removed in Phase 3. REMOVED from disk.
- **logger-py** — Python backend (log.info, log.list). Frontend (log-viewer) removed in Phase 3. REMOVED from disk.
- **joke-fetcher** — Bun/TS backend (joke.random, joke.types). REMOVED from disk.
- **youtube-explorer** — Original monolithic YouTube plugin. Split into yt-feed, yt-auth, yt-search, yt-card. REMOVED from disk.

### yt-feed — YouTube Feed Backend (Bun/TS)

#### Backend (plugins/youtube/plugins/yt-feed/main.ts)
- Uses Innertube API for YouTube home feed
- Lazily loads cookie from shared file (`.youtube-cookie` written by yt-auth)
  - Cookie read at request time, not startup — catches file written by yt-auth after process start
- `feed` method: calls `tube.getHomeFeed()`, returns array of video items
- Methods are simple (no prefix): just `"feed"` — prefix added by feed-widget as `name + "." + method`
- 8s Promise.race timeout on API calls
- No `feeds.method` in manifest — defaults to `methods[0]` ("feed")

### yt-auth — YouTube Cookie Auth (Bun/TS)

#### Backend (plugins/youtube/plugins/yt-auth/main.ts)
- Browser cookie database discovery:
  - Firefox: finds `cookies.sqlite` via `find ~/.mozilla -name "cookies.sqlite" 2>/dev/null`
  - Chrome/Chromium: tries sweet-cookie library, falls back to `find` for Cookies DB
- Copies DB to temp file (avoids SQLite locking issues)
- Queries: `SELECT name, value, host FROM moz_cookies WHERE host LIKE '%youtube.com'`
- Extracts SAPISID cookie → constructs SAPISIDHASH Authorization header
- Filters ST-* cookies (avoids 413 Request Entity Too Large on YouTube API)
- Writes cookie to shared `.youtube-cookie` file (read by yt-feed)
- Methods: `login` (discover+write), `logout` (delete file), `status` (check file exists)

### yt-card — YouTube Video Card WC (React, no backend)

#### Frontend (plugins/youtube/plugins/yt-card/yt-video-card.tsx)
- React card WC built via esbuild entry template
- Receives item prop: `{ thumbnail, title, channel, viewCount, published }`
- Renders thumbnail img, title H3, channel, views, published date
- Handles click on thumbnail → calls `window.__pluginRpc("video-player.load", {url, title})` then dispatches `new CustomEvent("player-load", {detail: {url, title}})` on window
- Player-modal listens for `player-load` to auto-open
- Manifest uses `components: ["yt-video-card"]` — built but NOT mounted as top-level view

### yt-search — YouTube Search Backend (Bun/TS)

#### Backend (plugins/youtube/plugins/yt-search/main.ts)
- Uses Innertube API for YouTube search
- `search` method: takes query param, calls `tube.search()`, returns results

### feed-widget — Feed Orchestrator WC (React, no backend)

#### Frontend (plugins/feed/feed-widget.tsx)
- 5-state machine: `loading` (spinner), `error` (system error), `empty` (no sources), `partial` (some errors), `loaded` (all ok)
- Loads feed via `callHook("feed.video")` — uses hook resolution, not direct source.feeds.method calls
- Uses `name + "." + method` RPC prefix: calls `__pluginRpc(source.name + "." + source.feeds[0].method)` = `__pluginRpc("yt-feed.feed")`
- Error banners per source with "Sign in" button:
  - Searches ALL manifests for a plugin with `methods.includes("login")` (not just errored source)
  - Shows sign-in button if such a plugin exists
  - Calls login method, reloads feed on success
- `CardRenderer`: creates card WCs via `document.createElement(tag)`, sets `.item`, appends to container
- Uses `customElements.whenDefined()` to wait for WC registration before creating elements

### peertube — PeerTube Feed Backend + Card WC (Bun/TS + React)

#### Backend (plugins/peertube/main.ts)
- Fetches videos from a PeerTube instance API
- `list` method: returns array of video items from PeerTube instance

#### Frontend (plugins/peertube/peertube-card.tsx)
- React card WC similar to yt-video-card
- Handles click → dispatches `player-load` custom event with `{url, title}`
- Manifest: `feeds: [{type:"video", card:"peertube-card"}]`

### video-player — Player Modal (Bun/TS + React WC)

#### Backend (plugins/video-player/main.ts)
- Lightweight backend, `load` method is a placeholder
- Manifest: `ui: "player-modal"`, `hooks: ["player"]`

#### Frontend (plugins/video-player/player-modal.tsx)
- Uses `<iframe>` (not `<video>`) — service embed URLs are HTML pages, not direct media files
- Listens for `"player-load"` custom event on `window` (dispatched by card WCs)
- On event: calls `__pluginRpc("load", {url})` and shows modal with iframe
- Handles close button, click-outside-to-close, Escape key

#### Data flow
1. App.tsx calls host RPC → gets manifests → loads frontends from `build/plugins/<tag>.js`
2. App.tsx creates UI WC elements imperatively in `#feed-container`, sets `.manifests = all`
3. feed-widget's `.manifests` setter stores manifests, calls `loadFeed()`
4. `loadFeed()`: for each source with `feeds[]`, calls `__pluginRpc(source.name + "." + method, {})`
5. Results merged into flat `items[]` array
6. `CardRenderer` creates WC for each item, sets `.item`, appends

#### __pluginRpc callers
- feed-widget calls `__pluginRpc(source.name + "." + method, {})` (e.g., `"yt-feed.feed"`)
- feed-widget calls `__pluginRpc(authPlugin.name + "." + method, {})` when user clicks "Sign in"
- Auth method found by searching ALL manifests for `methods.includes("login")`
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

### Session 2026-07-07 Decisions (Plugin Refactor — youtube-explorer split, hooks, components, feeds array)
39. **`components` manifest field** — separates build concern from mount concern. `ui` → build AND mount (views). `components` → build only (cards, sub-components). Fixes the Single-Field Conflation Antipattern where `ui` was the only way to trigger a build.
40. **`hooks` manifest field** — decentralized capability discovery. A plugin declares what hooks it satisfies (e.g., `"feed.video"`, `"auth"`, `"search"`, `"player"`). The host resolves hooks at runtime. Replaces hardcoded method prefix routing for capability discovery.
41. **`callHook`/`resolveHook` RPC handlers** — new host RPCs for hook-based discovery. `callHook` finds the first plugin matching a hook and calls its method. Enables feed-widget to use `callHook("feed.video")` instead of iterating manifests.
42. **`feeds` as array** — `feeds: [{type:"video", card:"yt-video-card"}]` (was a single object). Enables a single plugin to contribute to multiple feed types. The `feeds-as-array` future plan is now implemented.
43. **Plugin nesting** — plugins can live under other plugins: `plugins/youtube/plugins/yt-feed/`. The host uses recursive directory scanning (`getAllPluginManifests`). Parent `plugin.json` (youtube) has metadata only. Enables logical grouping.
44. **Monolithic plugin split** — `youtube-explorer` (one big plugin) split into `yt-feed`, `yt-auth`, `yt-search`, `yt-card`. Each has a single responsibility. yt-feed handles feed, yt-auth handles auth, yt-search handles search, yt-card provides the video card WC.
45. **Lazy cookie reload** — yt-feed re-reads cookie file on each request if `cookieStr` is null. Catches file written by yt-auth after startup. Fixes the "auth before feed" timing issue for long-lived processes.
46. **`name + "." + method` RPC prefix** — feed-widget calls `__pluginRpc("yt-feed.feed")` instead of `__pluginRpc("feed")`. The host splits on first dot to find plugin by `config.name`. This is needed because simple method names ("feed", "list") would overlap between plugins.
47. **Sign-in button searches ALL manifests** — feed-widget searches `manifests.find(m => m.methods?.includes("login"))` rather than checking only the errored source's methods. Auth methods live on a separate plugin (yt-auth) from the feed source (yt-feed).
48. **`components` as declarative ownership** — when source not found in referencing dir, use `components` field on the owning plugin's manifest. yt-card declares `components: ["yt-video-card"]` so the build script finds the source in yt-card's directory.
49. **Build output path changed** — frontend JS loads from `build/plugins/<tag>.js` (was `plugins/<name>/frontend/<tag>.js`). Centralized build output directory. Host security restricts `getPluginFrontend` to `build/plugins/` path.
50. **Vite as universal build tool** — replaced ad-hoc esbuild-only approach. Now all frameworks (React, Preact, Vue, Svelte) build via Vite IIFE. Build script auto-detects framework by scanning imports in source files.
51. **Build script entry template includes `_manifests`** — all WCs get both `_item` and `_manifests` setters. Allows any WC to access the full manifests array for self-discovery.
52. **Player modal uses `<iframe>`** — embed URLs from YouTube/PeerTube are HTML pages, not direct media files. `<video>` tag cannot play them. iframe is the standard approach for embed URLs.
53. **Event bridge for card→modal** — cards dispatch `CustomEvent("player-load", {detail: {url, title}})` on `window`. Player-modal listens in `useEffect(() => { window.addEventListener("player-load", handler) })`. Decoupled communication.
54. **Plugin UI elements created imperatively** — App.tsx uses `document.getElementById("feed-container")` and `document.createElement(tag)` instead of React refs or JSX. WCs created outside React's VDOM to avoid framework conflicts.
55. **No `frontend/` subdirectory** — source files alongside `plugin.json` (e.g., `plugins/feed/feed-widget.tsx`). The build script finds source by `<dir>/<tag>.<ext>`. Previously required `frontend/` subdirectory.
56. **Recursive manifest scanning** — `getAllPluginManifests()` walks directory tree recursively. Supports nested plugins under `plugins/*/plugins/*/`. Flat scan (`readdirSync(plugins/*)`) doesn't find deeply nested manifests.

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

### Bug #13: Single `uiPlugin` variable overwritten by last manifest with `ui`
- **Location**: `App.tsx` — `let uiPlugin: PluginManifest | null = null`
- **Problem**: Loop iterated manifests and set `uiPlugin = m` for each plugin with `ui` field. Last one won (yt-card's `yt-video-card` overrides feed's `feed-widget`). feed-widget element never created.
- **Fix**: Changed to `uiPlugins[]` array, loop over all, create elements for ALL UI plugins, not just the last one.
- **Impact**: White screen — feed-widget never mounted. Only `<yt-video-card>` created (renders nothing without item).
- **Status**: ✅ FIXED

### Bug #14: `yt-card/plugin.json` uses `ui` field for card component
- **Location**: `plugins/youtube/plugins/yt-card/plugin.json` — `ui: "yt-video-card"`
- **Problem**: `ui` field caused both loading AND mounting. yt-video-card is a card component, not a standalone view. But removing `ui` broke the build (build script couldn't find source).
- **Fix**: Removed `ui`, added `components: ["yt-video-card"]` to manifest. Build script collects from `components` too.
- **Impact**: Stale build — yt-video-card.js never rebuilt after dispatchEvent added, because build script couldn't find a tag referencing yt-video-card.
- **Design decision**: New `components` field separates "build this WC" from "mount this WC"
- **Status**: ✅ FIXED

### Bug #15: Sign-in button not appearing for yt-feed auth errors
- **Location**: `feed-widget.tsx` — `source?.methods?.includes("login")`
- **Problem**: Error came from `yt-feed` (methods: `["feed"]`), but login method is on `yt-auth` (different plugin). Source methods don't include "login". Sign-in button never showed.
- **Fix**: Search ALL manifests for a plugin with `"login"` in methods: `manifests.find(m => m.methods?.includes("login"))`.
- **Impact**: User sees "Not authenticated" but no way to sign in.
- **Status**: ✅ FIXED

### Bug #16: yt-feed doesn't re-read cookie after login
- **Location**: `plugins/youtube/plugins/yt-feed/main.ts`
- **Problem**: yt-feed read cookie only at process startup (`const cached = loadCookie()`). After yt-auth wrote cookie to shared file, yt-feed's `cookieStr` was still null.
- **Fix**: Lazy reload in "feed" handler: `if (!cookieStr) { const fresh = loadCookie(); if (fresh) cookieStr = fresh }`.
- **Impact**: Even after successful login, feed says "Not authenticated" because yt-feed never re-reads the cookie file.
- **Status**: ✅ FIXED

### Bug #17: yt-video-card never dispatches `player-load` event
- **Location**: `plugins/youtube/plugins/yt-card/yt-video-card.tsx` — `handleClick()`
- **Problem**: `handleClick` called RPC but had no `dispatchEvent(new CustomEvent("player-load", ...))`. Player-modal was never notified.
- **Fix**: Added `window.dispatchEvent(new CustomEvent("player-load", { detail: { url, title } }))` after RPC call.
- **Impact**: Clicking yt-video-card did nothing. peertube-card already had dispatchEvent and worked.
- **Status**: ✅ FIXED

### Bug #18: Player-modal uses `<video>` with embed URLs
- **Location**: `plugins/video-player/player-modal.tsx`
- **Problem**: Both services passed embed page URLs (`youtube.com/embed/...`, `peertube.cpy.re/videos/embed/...`). `<video>` expects direct media file URLs.
- **Fix**: Changed `<video src={...}>` to `<iframe src={...}>`.
- **Impact**: Player-modal showed but video didn't play (blank/error).
- **Status**: ✅ FIXED

### Bug #19: Build script can't find source across directories (stale build)
- **Location**: `scripts/build-plugins.ts`
- **Problem**: When `yt-feed`'s manifest referenced `card: "yt-video-card"`, build script searched for source only in yt-feed's directory → not found → skip. Source was in yt-card's directory. yt-card no longer had `ui` → no tags → nothing built. Stale `.js` persisted.
- **Fix**: yt-card declares `components: ["yt-video-card"]` → build script finds tag from `components[]` → finds source in yt-card's dir. Cross-directory ownership via `components` field.
- **Impact**: Source changes to yt-video-card.tsx never got compiled. Only old .js served.
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

### ✅ COMPLETED — Phase 2: YouTube Explorer (Original monolithic plugin, since replaced)
- [x] youtube-explorer plugin: Bun TS backend + React WC frontend
- [x] Cookie auth via browser DB discovery (Firefox SQLite, Chrome via sweet-cookie)
- [x] SAPISID cookie extraction → SAPISIDHASH Authorization header (innertube)
- [x] ST-* cookie filter (prevents 413 Request Entity Too Large on YouTube API)
- [x] Per-request `Innertube` instances (no global `tube` — eliminates race conditions)
- [x] 8s Promise.race timeout on getHomeFeed() and search()
- [x] Event-based stdin queue with `knownIds` dedup (defeats Bun canary re-delivery bug)
- [x] readStdout + readStderr buffer fix (`lines.pop()`) — prevents stale line re-emission
- [x] Frontend maxRequestTime: 20000 fix (critical — see Bug #12)

### ✅ COMPLETED — Phase 3: Unified Feed Architecture
- [x] Manifest simplified: `run` replaces `command`+`args`, `ui`/`feeds` replaces `frontendComponent`/`frontendFile`/`frontendSlot`
- [x] Old prototype plugin frontends removed (greet-go, logger-py, joke-fetcher) — removed from disk
- [x] Shared types updated: `FeedContrib[]`, `PluginManifest` with `run`/`ui`/`feeds`/`hooks`
- [x] Host updated: recursive manifest scanning, 6 RPC handlers, hook resolution
- [x] App.tsx simplified: uiPlugins[] array, imperative WC creation, hooks globals
- [x] App.tsx no longer uses React refs for WCs — creates elements via document.createElement
- [x] Feed plugin created (`plugins/feed/feed-widget.tsx`) with 5-state machine
- [x] Build script rewritten in TypeScript: Vite-based, multi-framework auto-detect
- [x] Auth button in error banners: searches ALL manifests for login method, not just source
- [x] peertube plugin added (second feed source — multi-source working)
- [x] video-player plugin added (player modal with iframe, custom event bridge)
- [x] youtube-explorer split into yt-feed, yt-auth, yt-search, yt-card (single responsibility)
- [x] `components` manifest field added (separates build from mount)
- [x] `hooks` manifest field + `callHook`/`resolveHook` RPCs added
- [x] `feeds` changed from object to array (feeds-as-array)
- [x] `name + "." + method` RPC prefix routing (host splits on first dot by plugin name)
- [x] Lazy cookie reload (yt-feed re-reads cookie on each request)
- [x] No `frontend/` subdirectory — source files alongside plugin.json
- [x] Build output to `build/plugins/<tag>.js` (centralized, security-restricted)
- [x] Recursive manifest scanning for nested plugins
- [x] 7 new bugs fixed (#13-#19) — all from this session
- [x] All new architecture documented in AGENTS.md

### ❌ PLANNED — Future Work

**Phase 4: Feed Polish**
- [ ] Add sorting/interleaving across sources in feed
- [ ] Design generalized feed type system (video, short, image, post, etc.)
- [ ] Add "media-type" tab navigation in feed-widget
- [ ] Plugin-provided search UI integration (yt-search exists but no search tab in feed-widget)
- [ ] Error recovery: auto-retry failed feed sources
- [ ] Real-time updates / polling for feed sources

**Phase 5: General Improvements**
- [ ] Add plugin store / registry schema
- [ ] Plugin dependencies
- [ ] Community submissions system
- [ ] Mobile: Tauri or zero-native
- [ ] More skeletons: WebUI, Tauri, zero-native
- [ ] Remove old demo plugins from disk (greet-go, logger-py, joke-fetcher) — already gone
- [ ] Remove `electro-plugins.log` (obsolete)

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
frontend Web Component (`feed-widget`). App.tsx loads manifests from the host, loads all frontend
JS from `build/plugins/`, creates UI WC elements imperatively in a container div (passing manifests
via `.manifests` setter). Feed-widget discovers feed-contributing plugins, calls their feed methods
via `callHook()` or `__pluginRpc("name.method")`, and renders their card WCs.

Each content plugin provides:
- **Backend**: RPC method that returns feed items (any shape)
- **Frontend**: A Web Component "card" that renders ONE feed item
- **Manifest**: Declares `feeds` array, `hooks` for capability discovery, `components` for WC tags

### Architecture Diagram
```
┌──────────────────────────────────────────────────────────────────┐
│  WebView (React + Tailwind + Vite HMR)                          │
│                                                                  │
│  App.tsx:                                                        │
│  1. electroview.rpc.request.getPluginManifests({}) → manifests   │
│  2. Collects WC tags: feeds[].card + ui → dedup                  │
│  3. For each tag: loadFrontend("build/plugins/<tag>.js")         │
│     (getPluginFrontend → <script> → customElements.define())     │
│  4. Builds uiPlugins[] = manifests with ui field                 │
│  5. For each ui plugin: createElement(tag), set .manifests,      │
│     appendChild to #feed-container (imperative, not React)       │
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
│  │   1. Filter _manifests by has feeds[]                 │        │
│  │   2. For each source:                                │        │
│  │      a. __pluginRpc(name + "." + method, {})         │        │
│  │      b. Receives items (any shape, no schema)         │        │
│  │   3. Merges items (by source order)                   │        │
│  │   4. For each item:                                   │        │
│  │      cr = document.createElement(feeds[0].card)      │        │
│  │      cr.item = rawItem (ALL data)                     │        │
│  │      feedContainer.appendChild(cr)                   │        │
│  │                                                      │        │
│  │ States: loading|error|empty|partial|loaded           │        │
│  │ Error banners with Sign In (searches all manifests   │        │
│  │ for plugin with "login" method, not just source)     │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │ yt-video-card    │  │ peertube-card    │  │ player-modal │   │
│  │ (from yt-card)   │  │ (from peertube)  │  │ (from vid-   │   │
│  │ React 18         │  │ React 18         │  │  player)     │   │
│  │ click→player-load│  │ click→player-load│  │ Listens for  │   │
│  │ custom event     │  │ custom event     │  │ player-load  │   │
│  └──────────────────┘  └──────────────────┘  └──────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ player-modal (ui: "player-modal", created in #feed- │        │
│  │ container by App.tsx alongside feed-widget)         │        │
│  │ - Listens for "player-load" event on window        │        │
│  │ - Opens iframe modal when event fires               │        │
│  │ - Closes on Escape / click-outside / close button   │        │
│  └─────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow (Detailed)
1. **App.tsx mounts** → `electroview.rpc.request.getPluginManifests({})` → gets array of all manifests
2. **App.tsx collects WC tags**: for each manifest, collects `feeds[*].card` and `ui` tags (dedup)
3. **App.tsx loads frontend JS**: for each unique tag:
   - Calls `electroview.rpc.request.getPluginFrontend({ path: "build/plugins/<tag>.js" })`
   - Creates `<script>` element, sets `textContent` = JS code, appends to `<body>`
   - `customElements.define()` registers the WC globally
4. **App.tsx creates UI elements**: builds `uiPlugins[]` (manifests with `ui`), waits for each WC definition, creates element via `document.createElement(tag)`, sets `el.manifests = all`, appends to `#feed-container` div
5. **feed-widget receives manifests**: via `.manifests` setter (set by App.tsx's imperative code) → triggers `loadFeed()`
6. **feed-widget loads items**: for each source with `feeds[]`:
   - Calls `__pluginRpc(source.name + "." + source.feeds[0].method, {})` (e.g., `"yt-feed.feed"`)
   - Host splits method on first dot, finds plugin by `config.name`, routes to it
   - Gets array of items (any JSON shape, no schema)
7. **Merges** items from all sources into one array (grouped by source, in registration order)
8. **For each item**: `customElements.whenDefined(source.feeds[0].card).then(() => {...})`
   - `card = document.createElement(source.feeds[0].card)`
   - `card.item = rawItem` (passes EVERYTHING — no schema)
   - `feedContainer.appendChild(card)`
9. **Error handling**: per-source. If a feed method call fails, that source's items are skipped, an error banner is shown with optional "Sign in" button (searches ALL manifests for a plugin with `"login"` in methods, not just the errored source)

### Key Design Decisions
- **No schema**: Feed doesn't know or care about item structure. Raw data passed through to card WC.
- **Feed is a plugin**: Swappable. Lives at `plugins/feed/` with no backend.
- **Framework agnostic**: Each card WC is a self-contained IIFE with framework inlined.
- **Language agnostic**: Backend plugins can be any language.
- **No fallback cards**: Cards must come from plugins. Items without cards are skipped. Postponed.
- **Path derivation**: Frontend file paths NOT in manifest. Loaded from `build/plugins/<tag>.js`.
  Build script finds source by `<pluginDir>/<tag>.<ext>`. No `frontend/` subdirectory.
- **Custom DOM events for card ↔ modal communication**: Cards dispatch `CustomEvent("player-load", {detail: {url, title}})` on `window`. Player-modal listens via `addEventListener`.
- **`name + "." + method` RPC prefix**: Host routes by finding plugin with `config.name === firstPart`. Enables simple method names ("feed", "list") without namespace pollution.

### Simplified Plugin Manifest (Phase 3 — Current)

```json
{
  "name": "yt-feed",
  "run": "bun plugins/youtube/plugins/yt-feed/main.ts",
  "hooks": ["feed.video"],
  "methods": ["feed"],
  "feeds": [{ "type": "video", "card": "yt-video-card" }]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Unique plugin ID |
| `run` | ❌ | Command to spawn subprocess. |
| `methods` | ❌ | Array of method names. Method called as `name + "." + method` (e.g., `"yt-feed.feed"`). |
| `hooks` | ❌ | Array of hook strings for capability discovery (e.g., `"feed.video"`, `"auth"`). |
| `version` | ❌ | Semver version. |
| `description` | ❌ | Short description. |
| `author` | ❌ | Creator name. |
| `ui` | ❌ | WC tag for main-UI WC. Loaded from `build/plugins/<tag>.js`. Mounted by App.tsx. |
| `components` | ❌ | Array of WC tags to build but NOT mount. Example: `["yt-video-card"]`. |
| `feeds` | ❌ | Array of feed contribution objects. |
| `feeds[].type` | ✅ (if feeds) | Content type: `"video"`, `"image"`, `"post"`, `"short"`, etc. |
| `feeds[].method` | ❌ | RPC method to call. Defaults to `methods[0]`. |
| `feeds[].card` | ❌ | WC tag for rendering one item. Loaded from `build/plugins/<tag>.js`.

### `ui` field meaning (Phase 3)
In Phase 1-2, `ui` meant a standalone widget card rendered by App.tsx. In Phase 3, `ui` simply means
"this plugin has a frontend WC that App.tsx should load AND mount." The frontend file is loaded from
`build/plugins/<tag>.js`. The `feed` plugin uses `ui: "feed-widget"`. The `video-player` plugin uses
`ui: "player-modal"`. App.tsx creates WC elements for ALL ui plugins, not just the last one.

### Backward Compatibility
- Old format (`command`+`args`, `frontendComponent`, `frontendSlot`) is phased out completely.
- Host reads ONLY new format. Old prototype plugins removed from disk.
- Phase 1/2 demo plugins (greet-go, logger-py, joke-fetcher, youtube-explorer) removed entirely.

### The `feed` Plugin

```
plugins/feed/
├── plugin.json         → { name: "feed", ui: "feed-widget" }
└── feed-widget.tsx      ← orchestrator WC (React via build system, no frontend/ subdir)
```

`plugin.json`:
```json
{
  "name": "feed",
  "description": "Aggregate content from all your plugins into a single feed",
  "author": "Me",
  "version": "1.0.0",
  "ui": "feed-widget"
}
```

- No `run` — no backend process needed
- No `feeds` — it IS the feed, not a contributor
- `ui: "feed-widget"` — App.tsx loads `build/plugins/feed-widget.js` and creates `<feed-widget>` in `#feed-container`

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

### Frontend Path Derivation

| Manifest field | Purpose | Build source | Runtime load path |
|----------------|---------|-------------|-------------------|
| `ui: "feed-widget"` | Main UI WC to mount | `plugins/feed/feed-widget.tsx` | `build/plugins/feed-widget.js` |
| `components: ["yt-video-card"]` | WC to build only | `plugins/youtube/plugins/yt-card/yt-video-card.tsx` | `build/plugins/yt-video-card.js` |
| `feeds[i].card: "yt-video-card"` | Card WC for register | (same as components — see above) | `build/plugins/yt-video-card.js` |

Build script searches for source: `<pluginDir>/<tag>.<ext>` where ext is tsx, jsx, vue, svelte.
Cross-directory: if not found in declaring plugin's dir, it must be declared in another plugin's `components` or `ui`.

### Card WC Contract

The feed passes data to card WCs via a `.item` property setter. All WCs also get `.manifests`.
Each card WC is a Web Component wrapping a React/Preact component.

#### The Pattern (React entry template — current)

Build script generates this `entry.tsx` for every React frontend:

```javascript
import Component from "./yt-video-card.tsx"
import { createRoot } from "react-dom/client"
customElements.define("yt-video-card", class extends HTMLElement {
  root = null
  _item = null
  _manifests = null
  connectedCallback() {
    try { this.root = createRoot(this); this._render() }
    catch (e) { this.innerHTML = `<p style="color:red">WC error: ${e}</p>` }
  }
  disconnectedCallback() { this.root?.unmount(); this.root = null }
  set item(d) { this._item = d; this._render() }
  set manifests(d) { this._manifests = d; this._render() }
  _render() {
    if (!this.root) return
    this.root.render(<Component item={this._item} manifests={this._manifests} />)
  }
})
```

#### Data Flow (One Item)

1. Feed calls `__pluginRpc("yt-feed.feed", {})` → gets array of items
2. Feed loops: `for (const item of items)`
3. `document.createElement("yt-video-card")` → browser creates WC → `connectedCallback()` runs
   - React mount: `createRoot(this)` → `_render()` → `<Component item={null} />` → shows "Loading..."
4. `card.item = item` → setter fires:
   - `this._item = item` — stores the data
   - `this._render()` — `root.render(<Component item={{ title: "Cats", ... }} />)`
   - React re-renders component with real data → shows title, thumbnail, etc.
5. `feedContainer.appendChild(card)` — adds to page display

API calls = number of PLUGINS (not items). One `"yt-feed.feed"` call returns N items → N cards.

#### Why `_item` (underscore)?

A setter cannot store data in a variable with the same name (`item`), because `this.item = data`
inside a `set item()` would call itself forever (infinite loop). So we separate:

| Name | Role | Type |
|------|------|------|
| `item` (setter) | PUBLIC — called by feed | Function (runs on `=`) |
| `_item` | PRIVATE storage | Regular variable (no setter) |
| `item` (getter) | PUBLIC — read by feed | Function (runs on read) |

The underscore `_` is a naming convention meaning "internal, don't touch directly."

#### Entry Templates

All frameworks (React, Preact, Vue, Svelte) get entry templates with both `_item` and `_manifests`
setters. The template is auto-generated by the build script based on detected framework.

#### Build Script Tag Resolution (FIXED)

The build script now correctly checks `manifest.ui`, `manifest.components[]`, and
`manifest.feeds[*].card` to discover WC tags. Old `frontendComponent` field is not checked.
If a tag is referenced (e.g., `feeds[0].card: "yt-video-card"`) but source not found in that
plugin's directory, the build script skips it. The tag WILL be built if another plugin declares
it in `components[]` (yt-card does: `components: ["yt-video-card"]`).

Design: **Declarative ownership via `components`** — each plugin declares what WCs it owns.
The build script doesn't cross-search. If a plugin references a card from another plugin,
the source is found only in the owning plugin's directory.

### Phase 3 Implementation — DONE (Extended)

Phase 3 core was completed earlier. This session extended it with:
- **`components` field** — separates "build this WC" from "mount this WC"
- **`hooks` field** — decentralized capability discovery instead of hardcoded routing
- **`feeds` as array** — a single plugin can contribute to multiple feed types
- **Plugin nesting** — plugins under `plugins/youtube/plugins/*/` for logical grouping
- **`name + "." + method` routing** — host splits on first dot, routes by plugin name
- **Monolithic plugin split** — youtube-explorer → yt-feed, yt-auth, yt-search, yt-card
- **Multiple UI plugins** — App.tsx mounts ALL plugins with `ui`, not just the last one
- **Locked auth resolution** — sign-in button searches ALL manifests, not just errored source
- **Lazy cookie reload** — yt-feed re-reads cookie at request time, not startup
- **Custom event bridge** — cards dispatch `player-load` event, player-modal listens
- **Iframe-based player** — `<iframe>` instead of `<video>` for embed URLs
- **Vite-based build** — all frameworks via Vite IIFE, auto-detect by import scanning
