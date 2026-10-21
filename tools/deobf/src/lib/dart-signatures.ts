import * as fs from "node:fs";
import * as path from "node:path";

export interface DartSignature {
	cls: string;
	method: string;
	params: string[];
	file: string;
	line: number;
}

export type SignatureIndex = Map<string, Map<string, DartSignature[]>>;

export function splitTopLevel(text: string, sep: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let angle = 0;
	let current = "";
	let quote: string | null = null;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quote) {
			current += ch;
			if (ch === "\\") current += text[++i] ?? "";
			else if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			current += ch;
			continue;
		}
		if (ch === "(" || ch === "[" || ch === "{") depth++;
		else if (ch === ")" || ch === "]" || ch === "}") depth--;
		else if (ch === "<") angle++;
		else if (ch === ">") angle = Math.max(0, angle - 1);
		if (ch === sep && depth === 0 && angle === 0) {
			out.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	out.push(current);
	return out;
}

export function dartParamNames(raw: string): string[] {
	const cleaned = raw.replace(/[\[\]{}]/g, "");
	return splitTopLevel(cleaned, ",")
		.map((part) => {
			const p = part
				.replace(/@\w+(\([^)]*\))?/g, "")
				.replace(/\b(required|final|const|var|covariant)\b/g, "")
				.split("=")[0]
				.trim();
			if (!p) return "";
			const field = p.match(/^this\.([A-Za-z_$][\w$]*)$/);
			if (field) return field[1];
			const name = p.match(/([A-Za-z_$][\w$]*)\s*$/);
			return name ? name[1] : "";
		})
		.filter((name) => name.length > 0);
}

/** 每个字符所在的花括号深度（跳过字符串与注释） */
function braceDepths(text: string): Int32Array {
	const depths = new Int32Array(text.length);
	let depth = 0;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === "/" && text[i + 1] === "/") {
			while (i < text.length && text[i] !== "\n") depths[i++] = depth;
			continue;
		}
		if (ch === "/" && text[i + 1] === "*") {
			i += 2;
			while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) depths[i++] = depth;
			i++;
			continue;
		}
		if (ch === '"' || ch === "'") {
			const triple = text.slice(i, i + 3) === ch.repeat(3);
			const end = triple ? ch.repeat(3) : ch;
			const start = i;
			i += end.length;
			while (i < text.length) {
				if (text[i] === "\\") {
					i += 2;
					continue;
				}
				if (text.slice(i, i + end.length) === end) {
					i += end.length - 1;
					break;
				}
				i++;
			}
			for (let k = start; k <= Math.min(i, text.length - 1); k++) depths[k] = depth;
			continue;
		}
		depths[i] = depth;
		if (ch === "{") depth++;
		else if (ch === "}") depth--;
	}
	return depths;
}

function lineAt(text: string, index: number): number {
	let line = 1;
	for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line++;
	return line;
}

const METHOD_RE =
	/(?:^|[;}\n])\s*(?:static\s+)?(?:external\s+)?(?:factory\s+)?(?:[\w<>,\[\]\?\.\s]+?\s+)?(\w+)\s*\(([^()]*)\)\s*(?:(?:async|sync)\s*\*?\s*)?(?::[^{;]*)?(?:\{|=>|;)/g;
const SKIP_NAMES = new Set(["if", "for", "while", "switch", "return", "assert", "catch"]);

export function scanDartFile(text: string, file: string, out: DartSignature[]): void {
	const depths = braceDepths(text);
	const classRe = /(?:^|\n)\s*(?:abstract\s+)?class\s+(\w+)/g;
	let match: RegExpExecArray | null;
	while ((match = classRe.exec(text))) {
		const at = match.index + match[0].lastIndexOf("class");
		if (depths[at] !== 0) continue;
		const cls = match[1];
		const bodyStart = text.indexOf("{", match.index);
		if (bodyStart < 0) continue;
		const bodyDepth = depths[bodyStart] + 1;
		let bodyEnd = text.length;
		for (let i = bodyStart + 1; i < text.length; i++) {
			if (text[i] === "}" && depths[i] === bodyDepth - 1) {
				bodyEnd = i;
				break;
			}
		}
		const body = text.slice(bodyStart + 1, bodyEnd);
		const bodyDepths = braceDepths(body);
		METHOD_RE.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = METHOD_RE.exec(body))) {
			const name = m[1];
			if (SKIP_NAMES.has(name) || name === cls) continue;
			const offset = m[0].search(new RegExp(`\\b${name}\\s*\\(`));
			const nameAt = m.index + Math.max(0, offset);
			if (bodyDepths[nameAt] !== 0) continue;
			out.push({
				cls,
				method: name,
				params: dartParamNames(m[2]),
				file,
				line: lineAt(text, bodyStart + 1 + nameAt),
			});
		}
	}
}

export function loadSignatureIndex(root: string): SignatureIndex {
	const index: SignatureIndex = new Map();
	const files: string[] = [];
	const walk = (dir: string): void => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === "docs" || entry.name.startsWith(".")) continue;
				walk(full);
			} else if (entry.name.endsWith(".dart")) {
				files.push(full);
			}
		}
	};
	walk(root);
	for (const file of files) {
		const sigs: DartSignature[] = [];
		scanDartFile(fs.readFileSync(file, "utf-8"), path.relative(root, file), sigs);
		for (const sig of sigs) {
			const methods = index.get(sig.cls) ?? new Map<string, DartSignature[]>();
			const list = methods.get(sig.method) ?? [];
			list.push(sig);
			methods.set(sig.method, list);
			index.set(sig.cls, methods);
		}
	}
	return index;
}

/**
 * 按类名与方法名查签名；类名不匹配时退回全局同名方法。
 * 只有参数数量一致且参数名组合唯一时才算命中。
 */
export function resolveSignature(
	index: SignatureIndex,
	cls: string,
	method: string,
	arity: number,
): { sig: DartSignature } | { reason: "missing" | "arity" | "ambiguous" } {
	const local = index.get(cls)?.get(method) ?? [];
	const pool = local.length > 0 ? local : [...index.values()].flatMap((m) => m.get(method) ?? []);
	if (pool.length === 0) return { reason: "missing" };
	const matches = pool.filter((sig) => sig.params.length === arity);
	if (matches.length === 0) return { reason: "arity" };
	const first = matches[0].params.join(",");
	if (matches.some((sig) => sig.params.join(",") !== first)) return { reason: "ambiguous" };
	return { sig: matches[0] };
}

export function findUniqueSignature(
	index: SignatureIndex,
	cls: string,
	method: string,
	arity: number,
): DartSignature | null {
	const result = resolveSignature(index, cls, method, arity);
	return "sig" in result ? result.sig : null;
}
