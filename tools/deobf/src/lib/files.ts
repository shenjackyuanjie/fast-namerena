import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export const TOOL_ROOT = path.resolve(import.meta.dir, "..", "..");
export const REPO_ROOT = path.resolve(TOOL_ROOT, "..", "..");
export const LATEST_DIR = path.join(REPO_ROOT, "branch", "latest");
export const GOLDEN_DIR = path.join(TOOL_ROOT, "golden");
export const REPORT_DIR = path.join(TOOL_ROOT, "report");
export const TMP_DIR = path.join(TOOL_ROOT, ".tmp");

export function ensureDir(dir: string): void {
	fs.mkdirSync(dir, { recursive: true });
}

export function resolvePath(p: string): string {
	return path.resolve(process.cwd(), p);
}

export function sha256File(file: string): string {
	const hash = createHash("sha256");
	hash.update(fs.readFileSync(file));
	return hash.digest("hex");
}

export function readJson<T>(file: string): T {
	return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

export function writeJson(file: string, data: unknown): void {
	ensureDir(path.dirname(file));
	fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}
