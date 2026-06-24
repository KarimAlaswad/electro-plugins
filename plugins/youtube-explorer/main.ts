import { createInterface } from "readline";
import { Innertube, UniversalCache } from "youtubei.js";
import {
  getCookies,
  toCookieHeader,
  ALL_PROFILES,
} from "@steipete/sweet-cookie";
import { join } from "path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  copyFileSync,
} from "fs";
import { Database } from "bun:sqlite";
import { platform, homedir } from "os";

let cookieStr: string | null = null;
let accountName: string | null = null;
const cookieFile = join(import.meta.dir, ".youtube-cookie");
const HOME = homedir();
const OS = platform();

function send(id: number | null, result?: any, error?: string) {
  const msg: any = { id };
  if (error) msg.error = error;
  else msg.result = result;
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function loadCookie(): string | null {
  try {
    if (existsSync(cookieFile)) {
      const data = readFileSync(cookieFile, "utf-8").trim();
      if (data) return data;
    }
  } catch {}
  return null;
}

function saveCookie(cookie: string) {
  writeFileSync(cookieFile, cookie, "utf-8");
}

function deleteCookie() {
  try {
    if (existsSync(cookieFile)) unlinkSync(cookieFile);
  } catch {}
}

// -- Dynamic browser cookie discovery --
function getSearchRoots(): string[] {
  if (OS === "linux") {
    return [join(HOME, ".config"), join(HOME, ".local", "share")];
  } else if (OS === "darwin") {
    return [join(HOME, "Library", "Application Support")];
  } else {
    return [join(HOME, "AppData", "Local"), join(HOME, "AppData", "Roaming")];
  }
}

function runFind(
  roots: string[],
  fileName: string,
  maxDepth: number,
): string[] {
  const results: string[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    try {
      const proc = Bun.spawnSync([
        "find",
        root,
        "-maxdepth",
        String(maxDepth),
        "-name",
        fileName,
        "-type",
        "f",
      ]);
      if (proc.exitCode === 0 && proc.stdout) {
        for (const line of proc.stdout
          .toString()
          .trim()
          .split("\n")
          .filter(Boolean)) {
          results.push(line);
        }
      }
    } catch {}
  }
  return results;
}

interface CookieEntry {
  name: string;
  value: string;
}

function readFirefoxCookies(filePath: string): CookieEntry[] {
  try {
    const tmpDir = join(HOME, ".cache", "yt-plugin");
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, "cookies.sqlite");
    copyFileSync(filePath, tmpFile);
    const walPath = filePath + "-wal";
    const tmpWal = tmpFile + "-wal";
    if (existsSync(walPath)) copyFileSync(walPath, tmpWal);
    const db = new Database(tmpFile);
    const rows = db
      .query("SELECT name, value FROM moz_cookies WHERE host LIKE ?")
      .all("%youtube.com");
    db.close();
    unlinkSync(tmpFile);
    if (existsSync(tmpWal)) unlinkSync(tmpWal);
    return rows as CookieEntry[];
  } catch {
    return [];
  }
}

async function discoverAllCookies(): Promise<CookieEntry[] | null> {
  const all: CookieEntry[] = [];
  const seen = new Set<string>();
  const roots = getSearchRoots();
  const hasSapisid = () => all.some((c) => c.name === "SAPISID");

  // Phase 1: Firefox-type (unencrypted SQLite)
  const ffFiles = runFind(roots, "cookies.sqlite", 4);
  for (const file of ffFiles) {
    for (const c of readFirefoxCookies(file)) {
      if (c.name.startsWith("ST-")) continue;
      const key = c.name + "=" + c.value;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(c);
      }
    }
    if (hasSapisid()) break;
  }
  if (hasSapisid()) return all;

  // Phase 2: Chrome-type via sweet-cookie (standard browsers)
  try {
    const sc = await getCookies({
      url: "https://www.youtube.com",
      browsers: ["chrome", "firefox", "edge"],
    });
    for (const c of sc.cookies) {
      if (c.name.startsWith("ST-")) continue;
      const key = c.name + "=" + c.value;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(c);
      }
    }
  } catch {}
  if (hasSapisid()) return all;

  // Phase 3: Chrome-type via Login Data Discovery (extra Chromium browsers)
  const loginDataFiles = runFind(roots, "Login Data", 4);
  const triedProfiles = new Set<string>();
  for (const file of loginDataFiles) {
    const profileDir = join(file, "..");
    if (triedProfiles.has(profileDir)) continue;
    triedProfiles.add(profileDir);
    try {
      const sc = await getCookies({
        url: "https://www.youtube.com",
        browsers: ["chrome"],
        chromeProfile: profileDir,
      });
      for (const c of sc.cookies) {
        if (c.name.startsWith("ST-")) continue;
        const key = c.name + "=" + c.value;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(c);
        }
      }
    } catch {}
  }
  if (hasSapisid()) return all;

  if (all.length === 0) return null;
  return all;
}

// -- Startup --
const cached = loadCookie();
if (cached) {
  try {
    const tube = await Innertube.create({
      cookie: cached,
      cache: new UniversalCache(true),
    });
    const info = await tube.account.getInfo();
    const item = info.contents?.contents?.find((c: any) => c.is_selected);
    if (item) accountName = item.account_name?.text || null;
    cookieStr = cached;
  } catch {
    deleteCookie();
  }
}

async function handleRequest(request: any) {
  const method = request.method;
  const params = request.params || {};
  const reqId = request.id;

  try {
    if (method === "youtube.search") {
      if (!cookieStr) {
        send(reqId, null, "Not authenticated");
        return;
      }
      const tube = await Innertube.create({
        cookie: cookieStr,
        cache: new UniversalCache(true),
      });
      const search = await Promise.race([
        tube.search(params.query),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 8000),
        ),
      ]);
      const results = (search.videos || [])
        .slice(0, params.limit || 10)
        .map((v: any) => ({
          title: v.title?.text || "Untitled",
          videoId: v.id,
          channel: v.author?.name || "Unknown",
          views: v.views || v.short_view_count?.toString() || "",
          duration: v.duration?.seconds || 0,
          thumbnail: v.thumbnails?.[0]?.url || "",
        }));
      send(reqId, results);
    } else if (method === "youtube.auth.status") {
      send(reqId, {
        loggedIn: !!cookieStr,
        accountName,
      });
    } else if (method === "youtube.auth.login") {
      const entries = await discoverAllCookies();
      if (!entries) {
        send(
          reqId,
          null,
          "No YouTube session found in any browser. Sign in to youtube.com in your browser first.",
        );
        return;
      }
      const str = toCookieHeader(entries);
      saveCookie(str);
      cookieStr = str;
      const tube = await Innertube.create({
        cookie: cookieStr,
        cache: new UniversalCache(true),
      });
      try {
        const info = await tube.account.getInfo();
        const item = info.contents?.contents?.find((c: any) => c.is_selected);
        accountName = item?.account_name?.text || null;
      } catch {
        accountName = null;
      }
      send(reqId, { success: true, accountName });
    } else if (method === "youtube.auth.logout") {
      deleteCookie();
      cookieStr = null;
      accountName = null;
      send(reqId, { success: true });
    } else if (method === "youtube.feed") {
      if (!cookieStr) {
        send(reqId, null, "Not authenticated");
        return;
      }
      const tube = await Innertube.create({
        cookie: cookieStr,
        cache: new UniversalCache(true),
      });
      console.error(`[feed] start id=${reqId}`);
      const home = await Promise.race([
        tube.getHomeFeed(),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 8000),
        ),
      ]);
      console.error("[feed] getHomeFeed done");
      const grid = home.contents;
      const videos: any[] = [];
      for (const section of grid?.contents || []) {
        let items: any[] = [];
        if (
          section.type === "RichItem" &&
          section.content?.type === "LockupView" &&
          section.content?.content_type === "VIDEO"
        )
          items = [section.content];
        else if (
          section.type === "RichSection" &&
          section.content?.type === "RichShelf" &&
          section.content?.contents
        )
          items = section.content.contents
            .filter(
              (i: any) =>
                i.content?.type === "LockupView" &&
                i.content?.content_type === "VIDEO",
            )
            .map((i: any) => i.content);
        for (const v of items) {
          const md = v.metadata || {};
          const parts = md.metadata?.metadata_rows?.[0]?.metadata_parts || [];
          videos.push({
            title: md.title?.text || "Untitled",
            videoId: v.content_id,
            channel: parts[0]?.text?.text || "",
            views: parts[1]?.text?.text || "",
            published: parts[2]?.text?.text || "",
            thumbnail: v.content_image?.image?.[0]?.url || "",
          });
        }
      }
      const results = videos.slice(0, params.limit || 30);
      send(reqId, results);
    } else {
      send(reqId, null, "Method not found: " + method);
    }
  } catch (e: any) {
    send(reqId, null, e.message || String(e));
  }
}

const rl = createInterface({ input: process.stdin });
const queue: string[] = [];
const knownIds = new Set<number>();
let busy = false;
rl.on("line", (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.id != null) {
      if (knownIds.has(parsed.id)) return; // drop duplicate
      knownIds.add(parsed.id);
    }
    queue.push(line);
    if (!busy) processNext();
  } catch {
    send(null, null, "Parse error");
  }
});
async function processNext() {
  busy = true;
  while (queue.length > 0) {
    const line = queue.shift()!;
    try {
      await handleRequest(JSON.parse(line));
    } catch {
      send(null, null, "Parse error");
    }
  }
  busy = false;
}