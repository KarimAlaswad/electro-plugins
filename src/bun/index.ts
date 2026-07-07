import { BrowserWindow, BrowserView, Updater } from "electrobun/bun";
import { readdirSync, existsSync, lstatSync, readFileSync } from "fs" 
import { join } from "path" 
import type { PluginManifest } from "../shared/types" 
import { Subprocess } from "bun";

// -- Types --
interface PendingRequest {
	resolve: (value: any) => void
	reject: (reason: any) => void
	timer: Timer
}

interface PluginInstance {
	config: PluginManifest
	process: Subprocess
	alive: boolean
}

// -- State --
const plugins: PluginInstance[] = []
const pendingRequests = new Map<number, PendingRequest>()
let nextId = 1
let server: { port: number; stop: () => void } | null = null

// -- Find project root (walk up until we find package.json) --
function findProjectRoot(from: string): string {
	let dir = from 
	while (true) {
		if (existsSync(join(dir, "package.json"))) return dir 
		const parent = join(dir, "..") 
		if (parent === dir) throw new Error("Could not find project root")
		dir = parent 
	}
}

const baseDir = findProjectRoot(import.meta.dir)

function startStaticServer(): string {
	const serveDir = existsSync(join(baseDir, "dist"))
		? join(baseDir, "dist")
		: join(baseDir, "views", "mainview")
	server = Bun.serve({
		port: 0, 
		async fetch(req) {
			const url = new URL(req.url)
			let pathname = url.pathname
			if (pathname === "/") pathname = "/index.html"
			const file = Bun.file(join(serveDir, pathname))
			if (await file.exists()) return new Response(file)
			return new Response(Bun.file(join(serveDir, "index.html")), { status: 200 })
		},
	})
	console.log(`App server: http://localhost:${server.port}`)
	console.log(`[host] Plugin dirs: ${manifests.map(m => m.name).join(", ")}`)
	console.log(`[host] Spawned processes: ${plugins.map(p => p.config.name).join(", ") || "none"}`)
	return `http://localhost:${server.port}`
}

// -- Load manifests --
function getAllPluginManifests(dir: string): any[] {
	let manifests: any[] = []
	const files = readdirSync(dir)
	for (const file of files) {
		const fullPath = join(dir, file)
		if (lstatSync(fullPath).isDirectory()) {
			if (existsSync(join(fullPath, "plugin.json"))) {
				const text = readFileSync(join(fullPath, "plugin.json"), "utf-8")
				manifests.push(JSON.parse(text))
			}
			manifests = manifests.concat(getAllPluginManifests(fullPath))
		}
	}
	return manifests
}

const manifests = getAllPluginManifests(join(baseDir, "plugins"))

// -- Send JSON-RPC to a plugin's stdin --
async function sendToPlugin(
	plugin: PluginInstance,
	id: number,
	method: string,
	params: any,
) {
	const msg = JSON.stringify({ id, method, params }) + "\n"
	const stdin = plugin.process.stdin 
	if (stdin && typeof stdin !== "number") {
		stdin.write(msg)
	}
}

// -- Handle a JSON line from plugin stdout --
function handlePluginResponse(plugin: PluginInstance, line: string) {
	try {
		const msg = JSON.parse(line)
		if (msg.id != null && pendingRequests.has(msg.id)) {
			const pending = pendingRequests.get(msg.id)!
			clearTimeout(pending.timer)
			pendingRequests.delete(msg.id)
			if (msg.error) {
				pending.reject(new Error(msg.error))
			} else {
				pending.resolve(msg.result)
			}
		}
	} catch (e) {
		console.error(`[${plugin.config.name}] parse error:`, line)
	}
}

// -- Read plugin stdout line by line --
async function readStdout(plugin: PluginInstance) {
	const reader = plugin.process.stdout.getReader()
	const decoder = new TextDecoder()
	let buffer = ""
	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete line for next chunk
      for (const line of lines) {
        if (line.trim()) handlePluginResponse(plugin, line);
      }
		}
	} catch (e) {
		console.error(`[${plugin.config.name}] stdout error:`, e)
	}
}

// -- Log plugin stdout to console --
async function readStderr(plugin: PluginInstance) {
	const reader = plugin.process.stderr.getReader()
	const decoder = new TextDecoder()
	let buffer = ""
	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			buffer += decoder.decode(value, { stream: true })
			const lines = buffer.split("\n")
			buffer = lines.pop() || ""
			for (const line of lines) {
				if (line.trim()) console.error(`[${plugin.config.name}]`, line)
			}
		}
	} catch {
		// stderr closed - normal
	}
}

// -- Spawn all plugins --

function resolvePath(p: string): string {
	if (p.startsWith("/")) return p 
	if (p.includes("/") || p.startsWith(".")) return join(baseDir, p)
	return p
}

for (const manifest of manifests) {
	if (!manifest.run) continue // frontend-only plugin, no process

	// "run" is a single string with command + args, e.g.:
	// 		"bun plugins/youtube-explorer/main.ts"
	// 		"./plugins/greet-go/greet"
	const parts = manifest.run.split(/\s+/)
	const cmd = resolvePath(parts[0])
	const args = parts.slice(1).map(resolvePath)

	const proc = Bun.spawn([cmd, ...args], {
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
	})

	const plugin: PluginInstance = { config: manifest, process: proc, alive: true }
	plugins.push(plugin)

	readStdout(plugin)
	readStderr(plugin)

	proc.exited.then((code) => {
		plugin.alive = false
		console.error(`[${manifest.name}] exited (code ${code})`)
	})
}

// -- Route a request to the plugin that handles it --
async function routeRequest(fullMethod: string, params: any): Promise<any> {
	const parts = fullMethod.split('.')
	const pluginName = parts[0]
	const action = parts.slice(1).join('.')

	console.log(`[host] routeRequest: "${fullMethod}" → plugin="${pluginName}" action="${action}"`)

	const plugin = plugins.find(p => p.config.name === pluginName)
	if (!plugin || !plugin.alive) {
		console.error(`[host] Plugin not found or dead: ${pluginName}`)
		throw new Error(`Plugin not found or dead: ${pluginName}`)
	}

	const id = nextId++
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			pendingRequests.delete(id)
			reject(new Error(`[${plugin.config.name}] timeout: ${fullMethod}`))
		}, 10000)
		pendingRequests.set(id, { resolve, reject, timer })
		sendToPlugin(plugin, id, action, params)
	})
}

// -- Electrobun RPC: bridge between WebView and plugins --
const rpc = BrowserView.defineRPC({
  maxRequestTime: 15000,
  handlers: {
    requests: {
      pluginRequest: async (params: unknown) => {
        const { method, params: reqParams } = params as {
          method: string;
          params: any;
        };
        try {
          const data = await routeRequest(method, reqParams);
          return { success: true, data };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      },
      pluginList: async (_params: unknown) => {
        return plugins.map((p) => ({
          name: p.config.name,
          alive: p.alive,
          methods: p.config.methods || [],
        }));
      },
      getPluginManifests: async(__params: unknown) => {
				console.log(`[host] getPluginManifests: returning ${manifests.length} manifests: ${manifests.map(m => m.name).join(", ")}`)
				return manifests.map((m) => ({
					name: m.name,
					version: m.version,
					description: m.description,
					author: m.author,
					methods: m.methods || [],
					hooks: m.hooks || [],
					ui: m.ui || null,
					feeds: m.feeds || null,
				}));
			},
			getPluginFrontend: async (params: unknown) => {
				const { path } = params as { path: string }
				const fullPath = join(baseDir, path)
				// Security: only allow serving from build/plugins/
				if (!fullPath.startsWith(join(baseDir, "build", "plugins"))) {
					console.error(`[host] Access denied: ${path} -> ${fullPath}`)
					return { error: "Access denied" }
				}
				try {
					const code = await Bun.file(fullPath).text()
					console.log(`[host] getPluginFrontend: loaded ${path} (${code.length} bytes)`)
					return { code }
				} catch (e: any) {
					console.error(`[host] getPluginFrontend failed: ${path} -> ${e.message}`)
					return { error: `File not found: ${path}` }
				}
			},
			resolveHook: async (params: unknown) => {
				const { hook } = params as { hook: string }
				const plugin = plugins.find(p => p.config.hooks?.includes(hook))
				if (!plugin) return { success: false, error: `No plugin provides hook: ${hook}`}
				return {
					success: true,
					data: { name: plugin.config.name, methods: plugin.config.methods || [] }
				}
			},
			callHook: async (params: unknown) => {
				const { hook, method, params: args } = params as {
					hook: string;
					method?: string;
					params: any;
				}
				const plugin = plugins.find(p => p.config.hooks?.includes(hook))
				if (!plugin) return { success: false, error: `No plugin provides hook: ${hook}`}
				const m = method || plugin.config.methods?.[0]
				if (!m) return { success: false, error: `No method specified and plugin has no methods` }
				try {
					const data = await routeRequest(plugin.config.name + '.' + m, args)
					return { success: true, data }
				} catch (e: any) {
					return { success: false, error: e.message }
				}
			}
    },
    messages: {},
  },
});

// -- Detect dev server URL (Vite HMR) --
const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel()
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" })
			return DEV_SERVER_URL
		} catch {
			console.log("Vite dev server not running. Using bundled assets.")
		}
	}
	return startStaticServer()
}

// -- Create the window --
const url = await getMainViewUrl()
const mainWindow = new BrowserWindow({
	title: "Electro Plugins",
	url,
	frame: { width: 1024, height: 768, x: 200, y: 200 },
	rpc,
})

// -- Health check every 5 seconds --
setInterval(() => {
	for (const plugin of plugins) {
		if (!plugin.alive) {
			console.error(`[${plugin.config.name}] dead. needs restart.`)
		}
	}
}, 5000)

// -- Cleanup on exit --
process.on("SIGINT", () => {
	server?.stop()
	for (const p of plugins) p.process.kill()
	process.exit()
})
