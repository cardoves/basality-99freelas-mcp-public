import { lstat, readFile } from "node:fs/promises";
import { basename, isAbsolute, win32 } from "node:path";
import { normalizeProjectUrl } from "./public-project.js";

export type LocalSubmittedStatus =
  | "not_configured"
  | "listed_submitted"
  | "not_listed_unverified"
  | "invalid";

const MAX_BYTES = 64 * 1024;
const MAX_PROJECTS = 1000;
const LEDGER_FILE_NAME = "submitted-projects.json";

/**
 * On Windows, restrict the opt-in file to one known per-user path, outside
 * the managed Chrome session. Other platforms require an absolute ledger
 * filename and exclude a directory explicitly named session.
 */
export function isAllowedLocalSubmittedProjectsPath(
  configuredPath: string,
  platform: NodeJS.Platform = process.platform,
  localAppData: string | undefined = process.env.LOCALAPPDATA,
): boolean {
  if (platform === "win32") {
    if (!localAppData || !win32.isAbsolute(localAppData)) return false;
    const expected = win32.join(localAppData, "99FreelasMCP", LEDGER_FILE_NAME);
    return win32.isAbsolute(configuredPath) &&
      win32.normalize(configuredPath).toLowerCase() === win32.normalize(expected).toLowerCase();
  }
  return isAbsolute(configuredPath) &&
    basename(configuredPath) === LEDGER_FILE_NAME &&
    !configuredPath.split("/").includes("session");
}

/**
 * Interpret a user-maintained local record, not an authenticated 99Freelas receipt.
 * Absence from the record is never evidence that a proposal was not submitted.
 */
export function classifyLocalSubmittedProjects(
  targetUrl: string,
  text: string,
): LocalSubmittedStatus {
  try {
    // Windows PowerShell 5.1 writes UTF-8 JSON with a BOM by default.
    const data: unknown = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    if (!data || typeof data !== "object" || Array.isArray(data)) return "invalid";
    const record = data as Record<string, unknown>;
    if (record.schemaVersion !== 1 ||
        Object.keys(record).sort().join(",") !== "schemaVersion,submittedProjectUrls" ||
        !Array.isArray(record.submittedProjectUrls) ||
        record.submittedProjectUrls.length > MAX_PROJECTS) {
      return "invalid";
    }
    const target = normalizeProjectUrl(targetUrl);
    const targetId = /-(\d+)\/?$/.exec(target.pathname)?.[1];
    const recorded = new Set<string>();
    const recordedIds = new Set<string>();
    for (const value of record.submittedProjectUrls) {
      if (typeof value !== "string" || value.length > 300) return "invalid";
      const project = normalizeProjectUrl(value);
      recorded.add(project.toString());
      const id = /-(\d+)\/?$/.exec(project.pathname)?.[1];
      if (id) recordedIds.add(id);
    }
    return recorded.has(target.toString()) || (targetId && recordedIds.has(targetId))
      ? "listed_submitted" : "not_listed_unverified";
  } catch {
    return "invalid";
  }
}

/**
 * Opt-in only. Reads one bounded, regular, non-symlink local JSON file.
 * Never reads a browser profile, session marker, cookies or account data.
 * File location and contents are never included in MCP responses.
 */
export async function checkLocalSubmittedProjects(
  targetUrl: string,
  configuredPath: string | undefined = process.env.FREELAS_SUBMITTED_PROJECTS_FILE,
): Promise<LocalSubmittedStatus> {
  if (configuredPath === undefined || configuredPath === "") return "not_configured";
  if (!isAllowedLocalSubmittedProjectsPath(configuredPath)) return "invalid";
  try {
    const stats = await lstat(configuredPath);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_BYTES) return "invalid";
    const text = await readFile(configuredPath, "utf8");
    if (Buffer.byteLength(text, "utf8") > MAX_BYTES) return "invalid";
    return classifyLocalSubmittedProjects(targetUrl, text);
  } catch {
    return "invalid";
  }
}
