import { BrowserWindow, BrowserView } from "electrobun/bun";
import { existsSync } from "fs" 
import { join } from "path" 
import type { PluginManifest } from "../shared/types" 
import { Subprocess } from "bun";

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

const plugins: PluginInstance[] = []
const pendingRequests = new Map<number, PendingRequest>()
let nextId = 1

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

function resolvePath(p: string): string {
  if (p.startsWith("/")) return p;
  if (p.includes("/") || p.startsWith(".")) return join(baseDir, p);
  return p;
}

function spawnPlugin(config: Partial<PluginManifest> & { name: string }, run: string, extraArgs: string[] = []) {
	const parts = run.split(/\s+/)
	const cmd = resolvePath(parts[0])
	const args = [...parts.slice(1).map(resolvePath), ...extraArgs]
	const proc = Bun.spawn([cmd, ...args], {
		stdin: "pipe", stdout: "pipe", stderr: "pipe"
	})
	const plugin: PluginInstance = {
		config: config as PluginManifest,
		process: proc, alive: true
	}
	plugins.push(plugin)
	if (plugin.process.stdout) readStream(plugin.process.stdout, config.name, (line: string) => handlePluginResponse(plugin, line))
	if (plugin.process.stderr) readStream(plugin.process.stderr, config.name, (line: string) => console.error(`[${config.name}]`, line))
	proc.exited.then((code) => {
		plugin.alive = false
		console.error(`[${config.name}] exited (code ${code})`)
	})
}

spawnPlugin({ name: "core-manifest", methods: ["scan"] }, "bun plugins/core-manifest/main.ts", [baseDir])
spawnPlugin({ name: "core-static", methods: ["read"] }, "bun plugins/core-static/main.ts", [baseDir])
spawnPlugin({ name: "core-serve", methods: ["start", "stop"] }, "bun plugins/core-serve/main.ts", [baseDir])

const userManifests = (await routeRequest("core-manifest.scan", { full: true })) as any[]

for (const manifest of userManifests) {
	if (!manifest.run) continue
	spawnPlugin(manifest, manifest.run)
}

console.log(`[host] Spawned plugins: ${plugins.map(p => p.config.name).join(", ") || "none"}`)

async function sendToPlugin(plugin: PluginInstance, id: number, method: string, params: any) {
	const msg = JSON.stringify({ id, method, params }) + "\n"
	const stdin = plugin.process.stdin
	if (stdin && typeof stdin !== "number") stdin.write(msg)
}

function handlePluginResponse(plugin: PluginInstance, line: string) {
	try {
		const msg = JSON.parse(line)
		if (msg.id != null && pendingRequests.has(msg.id)) {
			const pending = pendingRequests.get(msg.id)!
			clearTimeout(pending.timer)
			pendingRequests.delete(msg.id)
			if (msg.error) pending.reject(new Error(msg.error))
				else pending.resolve(msg.result)
		}
	} catch (e) {
		console.error(`[${plugin.config.name}] parse error:`, line)
	}
}

async function readStream(stream: ReadableStream<any>, _name: string, onLine: (line: string) => void) {
	const reader = stream.getReader()
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
				if (line.trim()) onLine(line)
			}
		}
	} catch {}
}

async function routeRequest(fullMethod: string, params: any): Promise<any> {
	const parts = fullMethod.split('.')
	const pluginName = parts[0]
	const action = parts.slice(1).join('.')
	const plugin = plugins.find(p => p.config.name === pluginName)
	if (!plugin || !plugin.alive) {
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
      resolveHook: async (params: unknown) => {
        const { hook } = params as { hook: string };
        const plugin = plugins.find((p) => p.config.hooks?.includes(hook));
        if (!plugin)
          return { success: false, error: `No plugin provides hook: ${hook}` };
        return {
          success: true,
          data: {
            name: plugin.config.name,
            methods: plugin.config.methods || [],
          },
        };
      },
      callHook: async (params: unknown) => {
        const {
          hook,
          method,
          params: args,
        } = params as { hook: string; method?: string; params: any };
        const plugin = plugins.find((p) => p.config.hooks?.includes(hook));
        if (!plugin)
          return { success: false, error: `No plugin provides hook: ${hook}` };
        const m = method || plugin.config.methods?.[0];
        if (!m)
          return {
            success: false,
            error: `No method specified and plugin has no methods`,
          };
        try {
          const data = await routeRequest(plugin.config.name + "." + m, args);
          return { success: true, data };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }
    },
    messages: {},
  },
});

const serveResult = (await routeRequest("core-serve.start", {})) as any
const url = serveResult.url
console.log(`[host] using server: ${url}`)

const mainWindow = new BrowserWindow({
	title: "Electro Plugins",
	url,
	frame: { width: 1024, height: 768, x: 200, y: 200 },
	rpc,
})

setInterval(() => {
	for (const plugin of plugins) {
		if (!plugin.alive) {
			console.error(`[${plugin.config.name}] dead. needs restart.`)
		}
	}
}, 5000)

process.on("SIGINT", async () => {
	try { await routeRequest("core-serve.stop", {}) } catch {}
	for (const p of plugins) p.process.kill()
	process.exit()
})