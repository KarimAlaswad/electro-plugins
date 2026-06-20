# Electro Plugins — Complete Project Knowledge Base

**⚠️ CRITICAL RULE: NEVER TOUCH ANY PROJECT CODE.** Your job is knowledge management only.
- Modify ONLY this file (`AGENTS.md`) with project-specific information
- Modify ONLY `~/.config/opencode/skills/coding/SKILL.md` with general coding instructions
- NEVER create, edit, or delete any other files in the project
- The user handles ALL code changes themselves
- This rule exists because the user wants full control over their code

---

## Quick Summary
Language-agnostic modular desktop app where every feature is a plugin. Plugins communicate with the host via subprocess stdin/stdout JSON-RPC. Desktop prototype built with Electrobun (Bun/TypeScript). Frontend is React + Tailwind + Vite (HMR). Two demo plugins exist: greet (Go) and logger (Python). Currently expanding to: plugin manifests, frontend Web Components for plugin UIs, and an in-app plugin Store with one-click install from URL.

---

## Goal
Build a language-agnostic, fully modular desktop app where every feature is a plugin. The plugin system is independent of the "skeleton" (the app framework). The same plugins work on any skeleton — Electrobun (desktop now), Tauri or zero-native (desktop + mobile later). Everything is a plugin, including the frontend and eventually the skeleton itself.

---

## Core Architecture

```
┌──────────────────────────────────────────────────────┐
│  WebView (React + Tailwind + Vite HMR)                │
│  - Plugin cards with alive/dead status                │
│  - Method buttons (click → call plugin)               │
│  - Result display (JSON formatted)                    │
│  - FUTURE: Web Component slot for plugin UIs          │
│  - FUTURE: Store tab for browsing + installing        │
│         │                                             │
│         │ electroview.rpc.request.pluginRequest()      │
│         ▼                                             │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Host (Bun process — src/bun/index.ts)           │ │
│  │  - Reads config.json (future: scans manifests)   │ │
│  │  - Spawns plugins via Bun.spawn()                │ │
│  │  - Routes JSON-RPC by method prefix match        │ │
│  │    ("greet." → greet plugin, "log." → logger)    │ │
│  │  - Health check every 5s (logs dead, no restart) │ │
│  │  - Cleanup: kills all subprocesses on SIGINT     │ │
│  │  - 10-second timeout per plugin request          │ │
│  └──┬──────────────┬───────────────────────────────┘ │
│     │ stdin/stdout  │ stdin/stdout                    │
│  ┌──▼─────────┐  ┌─▼───────────┐                     │
│  │ Go Plugin   │  │ Python      │                     │
│  │ (greet)     │  │ Plugin      │                     │
│  │ greet.hello │  │ (logger)    │                     │
│  │ greet.bye   │  │ log.info    │                     │
│  │             │  │ log.list    │                     │
│  └─────────────┘  └─────────────┘                     │
└──────────────────────────────────────────────────────┘
```

---

## File Structure

```
/mnt/5TB/Projects/electro-plugins/
├── AGENTS.md                        ← THIS FILE
├── config.json                      # Plugin list (temporary — will be replaced by manifest scan)
├── electrobun.config.ts             # Electrobun build configuration
├── vite.config.ts                   # Vite config (React plugin, port 5173, root at src/mainview)
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript strict mode, noUnusedLocals, noUnusedParameters
├── postcss.config.js                # PostCSS with Tailwind + autoprefixer
├── tailwind.config.js               # Tailwind content path: src/mainview/**/*
├── bun.lock                         # Bun lock file
├── .gitignore                       # node_modules/, build/, dist/, artifacts/, greet binary, *.log
├── test.sh                          # Standalone plugin smoke test (bash)
│
├── src/
│   ├── bun/
│   │   └── index.ts                 # HOST: ~220 lines
│   │       - Types: PluginConfig, PendingRequest, PluginInstance
│   │       - sendToPlugin(): writes JSON to plugin stdin
│   │       - handlePluginResponse(): parses stdout, matches by id, resolves/rejects promises
│   │       - readStdout(): async reader, buffers partial lines across chunks
│   │       - readStderr(): same pattern, logs stderr
│   │       - Plugin spawning loop: Bun.spawn(), push to array, start readers
│   │       - routeRequest(): method prefix match → Promise with 10s timeout
│   │       - RPC handlers: pluginRequest (route + return), pluginList (return status)
│   │       - getMainViewUrl(): checks Vite HMR on port 5173, falls back to bundled
│   │       - BrowserWindow creation, health check interval, SIGINT cleanup
│   │
│   ├── mainview/
│   │   ├── App.tsx                  # FRONTEND: ~88 lines
│   │   │   - Electroview RPC bridge
│   │   │   - Plugin card list (name + alive/dead badge + method buttons)
│   │   │   - callMethod() → pluginRequest RPC → display JSON result
│   │   │   - Result box (preformatted JSON)
│   │   ├── main.tsx                 # React entry point (StrictMode, createRoot)
│   │   ├── index.html               # HTML shell (<div id="root"> + <script>)
│   │   └── index.css                # @tailwind base/components/utilities
│   │
│   └── shared/
│       └── types.ts                 # SHARED TYPES:
│           - PluginInfo { name, alive, methods }
│           - PluginRequestParams { method, params }
│           - PluginRequestResults { success, data?, error? }
│
├── plugins/
│   ├── greet-go/
│   │   ├── main.go                  # Go plugin: ~78 lines
│   │   │   - Request struct with *json.RawMessage params
│   │   │   - Response struct with interface{} result
│   │   │   - stdin/stdout loop via bufio.Scanner
│   │   │   - Handles: greet.hello (returns greeting), greet.bye (returns farewell)
│   │   │   - Default name "World" if params empty
│   │   ├── greet                    # Compiled binary (~2MB, in .gitignore)
│   │   └── frontend/                # (future: Web Component JS)
│   │
│   └── logger-py/
│       ├── main.py                  # Python plugin: ~49 lines
│       │   - stdin/json loop with flush
│       │   - Handles: log.info (appends to electro-plugins.log), log.list (reads all lines)
│       │   - Writes to electro-plugins.log in project root
│       └── frontend/                # (future: Web Component JS)
│
├── build/                           # Electrobun build output (in .gitignore)
├── dist/                            # Vite build output (in .gitignore)
├── node_modules/                    # (in .gitignore)
└── electro-plugins.log              # Logger plugin output (in .gitignore)
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
- Host checks method PREFIX only (e.g., `"greet."`)
- The specific action (hello vs bye) is handled by the plugin, NOT the host
- Adding 100+ plugins requires zero changes to routing code — just add entries to config/manifest
- Order matters: first matching plugin wins

---

## Host Behavior (src/bun/index.ts)

### Startup Sequence
1. Import Electrobun modules (BrowserWindow, BrowserView, Updater)
2. Read config.json via `Bun.file("config.json").text()`
3. For each plugin config:
   - Spawn with `Bun.spawn([command, ...args], { stdin: "pipe", stdout: "pipe", stderr: "pipe" })`
   - Store as `PluginInstance { config, process, alive: true }`
   - Start async `readStdout()` loop
   - Start async `readStderr()` loop
   - Set up `proc.exited.then()` to mark `alive = false`
4. Define RPC handlers via `BrowserView.defineRPC()`
5. Detect dev server URL (Vite HMR on port 5173)
6. Create `new BrowserWindow()` with the rpc object
7. Start health check interval (5 seconds)
8. Set up SIGINT cleanup handler

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

### RPC Handlers (exposed to WebView)
- `pluginRequest({ method, params })` → calls `routeRequest(method, params)`, returns `{ success: true, data }` or `{ success: false, error: message }`
- `pluginList()` → returns array of `{ name, alive, methods }` for all plugins

### Health Check
- `setInterval()` every 5000ms
- Checks `plugin.alive` for each plugin
- If dead: logs `[name] dead. needs restart.` (no auto-restart yet)

### Cleanup
- `process.on("SIGINT", ...)` — on Ctrl+C, kills all plugin processes via `p.process.kill()`, then `process.exit()`

---

## Frontend Behavior (src/mainview/App.tsx)

### Setup
- Creates an `Electroview` instance (Electrobun's browser-side RPC bridge)
- No browser-side request/message handlers needed (the WebView only CALLS the host, doesn't RECEIVE calls)

### On Mount
- `useEffect(() => { loadPlugins() }, [])` runs once
- `loadPlugins()` calls `electroview.rpc.request.pluginList({})`
- Stores result in `plugins` state array

### Plugin Cards
- Each plugin rendered as a white card with rounded corners and shadow
- Left side: plugin name (indigo heading)
- Right side: status badge — green `● Alive` or red `● Dead` (changes dynamically based on `alive` boolean)
- Below: method buttons — one button per method prefix (e.g., `greet.`, `log.`)
- All buttons disabled while any request is loading (`loading !== null`)

### Calling a Plugin
1. Click a method button → `callMethod(method)`
2. Sets `loading` to the method name (disables all buttons)
3. Clears previous result
4. Calls `electroview.rpc.request.pluginRequest({ method, params: {} })`
5. Format result: `JSON.stringify(res, null, 2)` (2-space indent)
6. Display in a `<pre>` block (preserves whitespace)
7. On error: display error message
8. `finally { setLoading(null) }` — re-enable buttons

### Result Box
- Only shown when `result` is not empty string
- Uses short-circuit: `{result && (<div>...{result}...</div>)}`
- Pre-formatted JSON in a light gray `<pre>` block with horizontal scroll

---

## Plugin Implementations

### greet-go (main.go) — Go
- Uses `*json.RawMessage` for params (user's explicit choice over simpler `map[string]interface{}`)
- Request struct: `Id int`, `Method string`, `Params *json.RawMessage`
- Response struct: `Id int`, `Result interface{}`, `Error string`
- Method handlers for `greet.hello` and `greet.bye`
- Both accept `{ name: string }` param, default to "World" if empty
- `greet.hello` returns `{ message: "Hello <name> from Go!" }`
- `greet.bye` returns `{ message: "Goodbye <name>!" }`
- Unknown methods return `{ error: "Method not found: ..." }`
- Compile: `go build -o greet main.go` in the greet-go directory

### logger-py (main.py) — Python
- `send_response(req_id, result, error)` — writes JSON + `\n` to stdout, then flushes
- `handle_request(request)` — dispatches by method
- `log.info` — reads `params.message`, appends to `electro-plugins.log` (append mode), returns `"ok"`
- `log.list` — reads all lines from `electro-plugins.log`, returns array of strings
- Unknown methods return error
- Main loop: reads `sys.stdin` line by line
- `params.get("params", {})` — default empty object prevents AttributeError crash
- All indentation is 4 spaces (the file previously had 6-space indentation on some lines — must be consistently 4 or 8)

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

### Framework Decisions
10. **Electrobun for prototyping** — easiest for a beginner (Bun/TypeScript). Native WebView, ~14MB bundle, fast startup
11. **Tauri for future mobile** — Rust, mature ecosystem, iOS + Android support, but requires learning Rust
12. **zero-native** (Vercel Labs) — alternative future option. Zig + system WebView, mobile support, but pre-release (v0.2)
13. **WebUI (webui-dev)** — interesting but no mobile path. Opens a real browser (Chrome/Firefox), not a WebView. Few KB library
14. **React + Tailwind + Vite** for the frontend (from the Electrobun template)

### Plugin Design Decisions
15. **Manual config.json for now** — simple list of plugins. Will be replaced by manifest scan
16. **Auto-discovery from plugin.json manifests** (future) — scan `plugins/*/plugin.json` at startup
17. **Community plugin store** (future) — hosted registry where users browse and install plugins
18. **Plugin signing / code signing** (future) — verify downloads haven't been tampered with
19. **Web Components for frontend plugins** — any framework (React, Vue, Svelte, Angular) can compile to them. Browser standard, no framework lock-in
20. **Iframes as alternative** — stronger isolation, separate JS context, communication via postMessage. Heavier. Cannot display native UI (Qt/GTK)
21. **Three plugin types** — `backend` (subprocess only), `frontend` (Web Component only), `fullstack` (both)

### Go Plugin Specific
22. **`*json.RawMessage` for params** — user explicitly chose this over simpler `map[string]interface{}`. Provides more type safety but more verbose
23. **Nested struct for params** — each method defines its own params struct, unmarshals from RawMessage

### Teaching/Communication Decisions
24. **User is a beginner** — assume ZERO prior knowledge. Explain every concept, syntax, and line
25. **Provide full code in messages** — user copies code themselves. Never modify files without explicit permission
26. **Line-by-line explanation tables** — after every code block, explain each line in a table
27. **Multi-level zoom** — big picture → file → scope/block → line → symbol → syntax construct
28. **Be proactive** — research tools, patterns, pitfalls without being asked. Suggest better approaches
29. **Mentor, not yes-man** — correct wrong assumptions directly. Lead the project in the right direction
30. **Test standalone before integrating** — catch plugin bugs in isolation before running the full app
31. **No code comments unless asked** — don't add comments to code files
32. **Plan mode = read-only, Build mode = can write** — plan mode explains and provides code in messages, build mode can create/edit files + run commands
33. **Never commit unless asked** — no git operations without explicit instruction

---

## Bug History

### Bug #1: `for...in` instead of `for...of` (stdout reader)
- **Location**: `readStdout()` line 75, `readStderr()` line 95
- **Problem**: `for (const line in lines)` iterates over array INDICES as strings ("0", "1"), not actual line values
- **Fix**: Change to `for (const line of lines)`
- **Impact**: Plugin responses silently dropped. `JSON.parse("0")` returns `0`, then `0.id != null` is false, so every request times out after 10 seconds
- **Status**: ✅ FIXED

### Bug #2: `==` instead of `=` (alive flag)
- **Location**: `proc.exited.then()` callback, line 119
- **Problem**: `plugin.alive == false` is a comparison, not an assignment. The expression evaluates to `true` or `false` but the value is discarded. `alive` is never set to false
- **Fix**: Change `==` to `=`
- **Impact**: When a plugin crashes, the health check never detects it. Plugin stays marked as alive forever
- **Status**: ✅ FIXED

### Bug #3: Extra `}` in template literal
- **Location**: Console error message in exit handler, line 120
- **Problem**: `` `[${pc.name}] exited (code ${code}})` `` — extra `}` after `${code}`
- **Fix**: Remove the extra `}`
- **Impact**: Output shows `"exited (code 0})"` instead of `"exited (code 0)"`
- **Status**: ✅ FIXED

### Bug #4: Missing `pendingRequests.delete()`
- **Location**: `handlePluginResponse()`, after line 51
- **Problem**: After resolving/rejecting a pending request, the entry stays in the Map forever
- **Fix**: Add `pendingRequests.delete(msg.id)` after `clearTimeout(pending.timer)`
- **Impact**: Memory leak. Over time, the Map fills with resolved requests. Multiply by number of requests made
- **Status**: ✅ FIXED

### Bug #5 (Frontend): `pluginList` instead of `pluginRequest`
- **Location**: App.tsx, `callMethod()` function, line 28
- **Problem**: `electroview.rpc?.request.pluginList({ method, params })` calls the wrong RPC method. `pluginList` returns plugin status list, not plugin execution result
- **Fix**: Change to `electroview.rpc.request.pluginRequest({ method, params })` and remove unnecessary `?.`
- **Impact**: Clicking a method button shows the plugin list instead of calling the plugin
- **Status**: ✅ FIXED

### Bug #6 (Python): Inconsistent indentation
- **Location**: `logger-py/main.py`, lines 11 and 13
- **Problem**: 6 spaces of indentation instead of 8 (Python requires consistent indentation level for if/else bodies)
- **Fix**: Change from 6 spaces to 8 spaces to match Python indentation rules (4 for function body + 4 for if/else body)
- **Status**: ✅ FIXED

### Bug #7 (Python): Missing default for `params.get()`
- **Location**: `logger-py/main.py`, line 20
- **Problem**: `params = request.get("params")` — if the request has no "params" key, `params` becomes `None`. Then `params.get("message", "")` on line 24 crashes with `AttributeError: 'NoneType' object has no attribute 'get'`
- **Fix**: `params = request.get("params", {})` — default to empty dict
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

### ✅ DONE
- [x] Researched skeleton options: Electrobun, Tauri, WebUI (webui-dev), zero-native
- [x] Chose Electrobun for prototyping (Bun/TS, easy for beginner)
- [x] Created plugins/greet-go/main.go — Go plugin (greet.hello, greet.bye, *json.RawMessage)
- [x] Created plugins/logger-py/main.py — Python plugin (log.info, log.list)
- [x] Written config.json — plugin list (greet + logger)
- [x] Written .gitignore — node_modules, build, dist, greet binary, *.log
- [x] Written host src/bun/index.ts — spawn, route, RPC bridge, health check, cleanup (~220 lines)
- [x] Written frontend src/mainview/App.tsx — plugin cards, call buttons, result display (~88 lines)
- [x] Written src/shared/types.ts — PluginInfo, PluginRequestParams, PluginRequestResults
- [x] Written test.sh — standalone plugin smoke test (bash)
- [x] Fixed all 4 host bugs: for...of, = assignment, template literal, pendingRequests.delete
- [x] Fixed Python bugs: indentation, params.get() default
- [x] Fixed frontend bug: pluginList → pluginRequest
- [x] Updated skill file with teaching/ops instructions
- [x] Go plugin compiled and tested standalone
- [x] Python plugin tested standalone
- [x] Full architecture documented in AGENTS.md

### 🔄 IN PROGRESS / PLANNED (Phased)

**Phase 1: Plugin Manifest + Frontend Web Components**
- [ ] Add plugin.json manifests to greet and logger plugins
- [ ] Create greet-widget Web Component (name input + Hello/Bye buttons)
- [ ] Create log-viewer Web Component (log list with refresh)
- [ ] Modify host to scan plugins/*/plugin.json instead of config.json
- [ ] Add getPluginFrontend RPC method to serve frontend JS
- [ ] Add getPluginManifests RPC method to list installed plugins
- [ ] Modify App.tsx to load and render Web Components in a plugin slot
- [ ] Expose window.__pluginRpc() as global bridge for plugins

**Phase 2: Plugin Store UI**
- [ ] Create plugins/registry.json listing available plugins
- [ ] Add registryList RPC handler
- [ ] Add Store tab to App.tsx (shows remote plugins)
- [ ] Add Installed tab (shows local plugins from manifests)
- [ ] Wire up "Install" button → calls installPlugin RPC

**Phase 3: Install from URL**
- [ ] Implement installPlugin(name) — find in registry, fetch zip, extract
- [ ] Bun fetch + unzip (system command or npm package)
- [ ] After install: rescan manifests, spawn backend, load frontend
- [ ] UI updates to show newly installed plugin

**Phase 4: Future**
- [ ] Hosted remote registry (web server + JSON API)
- [ ] Plugin signing / verification
- [ ] Auto-updates
- [ ] Plugin dependencies
- [ ] Plugin store website
- [ ] Community submissions
- [ ] Mobile: Tauri or zero-native

---

## Relevant Commands

```bash
# Run the app
cd /mnt/5TB/Projects/electro-plugins && bun start

# Development with HMR (runs Vite dev server + Electrobun)
bun run dev:hmr

# Compile Go plugin
cd plugins/greet-go && go build -o greet main.go

# Test Go plugin standalone
echo '{"id":1,"method":"greet.hello","params":{"name":"Niri"}}' | ./plugins/greet-go/greet
echo '{"id":1,"method":"greet.bye","params":{"name":"Niri"}}' | ./plugins/greet-go/greet

# Test Python plugin standalone
echo '{"id":1,"method":"log.info","params":{"message":"test"}}' | python3 plugins/logger-py/main.py
echo '{"id":2,"method":"log.list"}' | python3 plugins/logger-py/main.py

# Run the standalone test script
./test.sh
```

---

## Teaching/Communication Rules (for agents working here)

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

## Plugin Manifest Schema (future)

```json
{
  "name": "greet",
  "version": "1.0.0",
  "description": "Friendly greetings in Go",
  "author": "Community",
  "license": "MIT",
  "type": "fullstack",
  "backend": {
    "command": "./plugins/greet-go/greet",
    "args": [],
    "methods": ["greet."]
  },
  "frontend": {
    "component": "greet-widget",
    "file": "plugins/greet-go/frontend/greet-widget.js",
    "slot": "main"
  }
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
