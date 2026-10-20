import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import MagicString from "magic-string";
import * as fs from "node:fs";
import * as path from "node:path";
import { REPORT_DIR, ensureDir } from "../lib/files";
import { parseArgs } from "../lib/args";
import { analyze } from "./reachability";

const traverse = (traverseModule as any).default ?? traverseModule;

interface Edit {
	start: number;
	end: number;
	text: string;
	label: string;
}

function lineStart(source: string, index: number): number {
	const nl = source.lastIndexOf("\n", index - 1);
	return nl === -1 ? 0 : nl + 1;
}

function isSpaceOrTab(ch: string | undefined): boolean {
	return ch === " " || ch === "\t" || ch === "\r";
}

/** 删除一条独立的 lazy 注册语句（含行首空白与行尾换行） */
function statementRange(source: string, start: number, end: number): { start: number; end: number } {
	let s = lineStart(source, start);
	while (s < start && isSpaceOrTab(source[s])) s++;
	let e = end;
	while (e < source.length && isSpaceOrTab(source[e])) e++;
	if (source[e] === ";") e++;
	const nl = source.indexOf("\n", e);
	e = nl === -1 ? source.length : nl + 1;
	return { start: s, end: e };
}

function literalText(kind: string, value: unknown): string {
	if (kind === "string") return JSON.stringify(value);
	return String(value);
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	if (typeof args.candidate !== "string" || typeof args.out !== "string") {
		throw new Error("用法：--candidate <in.js> --out <out.js>");
	}
	const input = path.resolve(args.candidate);
	const output = path.resolve(args.out);
	const source = fs.readFileSync(input, "utf-8");
	const report = analyze(input);

	const inlinable = new Map(
		report.lazy
			.filter(
				(l) =>
					l.live &&
					l.getterCalls > 0 &&
					l.getterReads === 0 &&
					l.slotRefs === 0 &&
					l.slotWrites === 0 &&
					(l.initializerKind === "number" ||
						l.initializerKind === "string" ||
						l.initializerKind === "boolean" ||
						l.initializerKind === "null"),
			)
			.map((l) => [l.getter, l]),
	);

	if (inlinable.size === 0) {
		console.log("没有可内联的 lazy 字面量");
		return;
	}

	const ast: any = parse(source, {
		sourceType: "script",
		allowReturnOutsideFunction: true,
		errorRecovery: true,
	});
	const edits: Edit[] = [];
	const hits = new Map<string, number>();
	traverse(ast, {
		CallExpression(p: any) {
			const c = p.node.callee;
			if (
				c.type === "MemberExpression" &&
				!c.computed &&
				c.object.type === "Identifier" &&
				c.object.name === "$" &&
				c.property.type === "Identifier"
			) {
				const entry = inlinable.get(c.property.name);
				if (!entry) return;
				edits.push({
					start: p.node.start,
					end: p.node.end,
					text: literalText(entry.initializerKind, entry.literal),
					label: `inline $.${entry.getter}`,
				});
				hits.set(entry.getter, (hits.get(entry.getter) ?? 0) + 1);
			}
		},
	});

	const removed: string[] = [];
	for (const [getter, entry] of inlinable) {
		if ((hits.get(getter) ?? 0) !== entry.getterCalls) continue;
		const range = statementRange(source, entry.start, entry.end);
		edits.push({ start: range.start, end: range.end, text: "", label: `remove lazy $.${entry.getter}` });
		removed.push(`$.${entry.slot}/$.${getter}@${entry.line}`);
	}

	const ms = new MagicString(source);
	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		if (edit.text === "") ms.remove(edit.start, edit.end);
		else ms.overwrite(edit.start, edit.end, edit.text);
	}
	const result = ms.toString();
	fs.writeFileSync(output, result, "utf-8");

	ensureDir(REPORT_DIR);
	fs.writeFileSync(
		path.join(REPORT_DIR, "last-inline.json"),
		JSON.stringify({ input, output, inlined: [...inlinable.keys()], removed }, null, 2),
		"utf-8",
	);

	const replaced = edits.length - removed.length;
	console.log(`替换调用 ${replaced} 处，删除注册 ${removed.length} 条；${source.length} -> ${result.length} 字节`);
	console.log(`注册：${removed.join(", ")}`);
}

if (import.meta.main) {
	main();
}
