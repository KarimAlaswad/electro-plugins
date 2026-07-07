import { Innertube, UniversalCache } from "youtubei.js";
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
import { getCookies, toCookieHeader } from "@steipete/sweet-cookie";
import { startStdin } from "../../../_shared/stdin.ts";

let cookieStr: string | null = null;
let accountName: string | null = null;
const cookieFile = join(import.meta.dir, "..", "..", ".youtube-cookie");
const HOME = homedir();
const OS = platform();

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

function getSearchRoots(): string[] {
  if (OS === "linux")
    return [join(HOME, ".config"), join(HOME, ".local", "share")];
  if (OS === "darwin") return [join(HOME, "Library", "Application Support")];
  return [join(HOME, "AppData", "Local"), join(HOME, "AppData", "Roaming")];
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
          .filter(Boolean))
          results.push(line);
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
  if (all.length === 0) return null;
  return all;
}

startStdin(async (req, send) => {
  if (req.method === "status") {
    send(req.id, { loggedIn: !!cookieStr, accountName })
  } else if (req.method === "login") {
    const entries = await discoverAllCookies()
    if (!entries) {
      send(req.id, null, "No YouTube session found. Sign in to youtube.com in your browser first.")
      return
    }
    const str = toCookieHeader(entries)
    saveCookie(str); cookieStr = str
    try {
      const tube = await Innertube.create({ cookie: cookieStr, cache: new UniversalCache(true) })
      const info = await tube.account.getInfo()
      accountName = info.contents?.contents?.find((c: any) => c.is_selected)?.account_name?.text || null
    } catch { accountName = null }
    send(req.id, { success: true, accountName })
  } else if (req.method === "logout") {
    deleteCookie(); cookieStr = null; accountName = null
    send(req.id, { success: true })
  } else {
    send(req.id, null, "Method not found: " + req.method)
  }
})
