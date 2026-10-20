import * as path from "node:path";
import { runCandidate } from "./runner";
import { parseArgs, requiredArg } from "../lib/args";
import { GOLDEN_DIR, readJson } from "../lib/files";

interface Diff {
	path: string;
	expected: unknown;
	actual: unknown;
}

function isPrimitive(value: unknown): boolean {
	return value === null || typeof value !== "object";
}

function firstDiff(expected: unknown, actual: unknown, at = "$"): Diff | null {
	if (isPrimitive(expected) || isPrimitive(actual)) {
		return Object.is(expected, actual) ? null : { path: at, expected, actual };
	}
	if (Array.isArray(expected) !== Array.isArray(actual)) {
		return { path: at, expected, actual };
	}
	if (Array.isArray(expected) && Array.isArray(actual)) {
		if (expected.length !== actual.length) {
			return { path: `${at}.length`, expected: expected.length, actual: actual.length };
		}
		for (let i = 0; i < expected.length; i++) {
			const diff = firstDiff(expected[i], actual[i], `${at}[${i}]`);
			if (diff) return diff;
		}
		return null;
	}
	const exp = expected as Record<string, unknown>;
	const act = actual as Record<string, unknown>;
	const keys = new Set([...Object.keys(exp), ...Object.keys(act)]);
	for (const key of keys) {
		const diff = firstDiff(exp[key], act[key], `${at}.${key}`);
		if (diff) return diff;
	}
	return null;
}

function preview(value: unknown, limit = 300): string {
	let text: string;
	try {
		text = JSON.stringify(value);
	} catch {
		text = String(value);
	}
	if (text === undefined) text = "undefined";
	return text.length > limit ? `${text.slice(0, limit)}... (${text.length} chars)` : text;
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const candidate = requiredArg(args, "candidate");
	const goldenDir =
		typeof args.golden === "string"
			? path.resolve(args.golden)
			: path.join(GOLDEN_DIR, "v0.5.3");
	const goldenFile = path.join(goldenDir, "sequence.json");
	const golden = readJson<any>(goldenFile);

	const actual = runCandidate(candidate);

	const diffs: Diff[] = [];
	const goldenResults = golden.results as any[];
	const actualResults = actual.results as any[];
	const ids = new Set([
		...goldenResults.map((r) => r.id),
		...actualResults.map((r) => r.id),
	]);
	for (const id of ids) {
		const left = goldenResults.find((r) => r.id === id);
		const right = actualResults.find((r) => r.id === id);
		const diff = firstDiff(left, right, `$.results[${id}]`);
		if (diff) diffs.push(diff);
	}
	const versionDiff = firstDiff(golden.version, actual.version, "$.version");
	if (versionDiff) diffs.push(versionDiff);

	if (diffs.length > 0) {
		console.error(`验证失败: ${path.resolve(candidate)}`);
		for (const diff of diffs.slice(0, 10)) {
			console.error(`  首个差异: ${diff.path}`);
			console.error(`    expected: ${preview(diff.expected)}`);
			console.error(`    actual:   ${preview(diff.actual)}`);
		}
		if (diffs.length > 10) {
			console.error(`  ... 还有 ${diffs.length - 10} 处差异`);
		}
		process.exit(1);
	}

	const summary = actual.results
		.map((r) => {
			const value = r.value as any;
			if (r.kind === "fight") return `${r.id}: winner=${value?.source_plr}`;
			if (r.kind === "fight_log") return `${r.id}: winner=${value?.winner?.source_plr}`;
			if (r.kind === "win_rate") return `${r.id}: win=${value?.win_count}`;
			if (r.kind === "score") return `${r.id}: score=${value?.score}`;
			return r.id;
		})
		.join("\n  ");
	console.log(`验证通过: ${path.resolve(candidate)}`);
	console.log(`  ${summary}`);
}

main();
