import MagicString from "magic-string";
import * as fs from "node:fs";
import * as path from "node:path";
import { REPORT_DIR, ensureDir } from "../lib/files";
import { parseArgs } from "../lib/args";
import { lineOf, parseScript, traverseAst } from "../lib/ast";
import { analyze } from "./reachability";

interface Edit {
	start: number;
	end: number;
	label: string;
}

function lineStart(source: string, index: number): number {
	const nl = source.lastIndexOf("\n", index - 1);
	return nl === -1 ? 0 : nl + 1;
}

function lineEnd(source: string, index: number): number {
	const nl = source.indexOf("\n", index);
	return nl === -1 ? source.length : nl + 1;
}

function isSpaceOrTab(ch: string | undefined): boolean {
	return ch === " " || ch === "\t" || ch === "\r";
}

/** 删除一个独立占据整行的语句（含缩进与行尾换行）；不独立则返回 null */
function statementEdit(source: string, start: number, end: number, label: string): Edit | null {
	const s = lineStart(source, start);
	let cursor = s;
	while (cursor < start && isSpaceOrTab(source[cursor])) cursor++;
	if (cursor !== start) return null;
	let e = end;
	while (e < source.length && isSpaceOrTab(source[e])) e++;
	if (source[e] === ";") e++;
	if (e < source.length && source[e] !== "\n") return null;
	e = lineEnd(source, e);
	return { start: s, end: e, label };
}

/** 已删除 lazy 的 slot 只写不读；把这种独立赋值语句一并删掉 */
function slotWriteEdits(source: string, slots: Set<string>): Edit[] {
	const edits: Edit[] = [];
	const ast = parseScript(source);
	traverseAst(ast, {
		ExpressionStatement(path: any) {
			const expr = path.node.expression;
			if (expr.type !== "AssignmentExpression" || expr.operator !== "=") return;
			const left = expr.left;
			if (left.type !== "MemberExpression" || left.computed) return;
			if (left.object.type !== "Identifier" || left.object.name !== "$") return;
			if (left.property.type !== "Identifier" || !slots.has(left.property.name)) return;
			const edit = statementEdit(
				source,
				path.node.start,
				path.node.end,
				`\$.${left.property.name} 死写入@${lineOf(path.node)}`,
			);
			if (edit) edits.push(edit);
		},
	});
	return edits;
}

/** 向上吞掉紧贴在属性上方的注释行（遇到空行停止） */
function attachedCommentStart(source: string, start: number): number {
	let cursor = lineStart(source, start);
	while (cursor > 0) {
		const newline = cursor - 1;
		const prevBegin = lineStart(source, newline);
		const text = source.slice(prevBegin, newline).trim();
		if (text === "") break;
		if (text.startsWith("//") || text.startsWith("/*") || text.startsWith("*") || text.startsWith("*/")) {
			cursor = prevBegin;
			continue;
		}
		break;
	}
	return cursor;
}

/** 删除对象字面量中的一个属性，连同其分隔逗号、空白与紧邻注释 */
function propertyEdit(source: string, start: number, end: number, label: string): Edit {
	start = attachedCommentStart(source, start);
	let e = end;
	while (e < source.length && isSpaceOrTab(source[e])) e++;
	if (source[e] === ",") {
		e++;
		while (e < source.length && isSpaceOrTab(source[e])) e++;
		if (source[e] === "\n") e++;
		return { start, end: e, label };
	}
	// 最后一个属性：吃掉前面的逗号和空白
	let s = start;
	while (s > 0 && isSpaceOrTab(source[s - 1])) s--;
	if (source[s - 1] === ",") {
		s--;
		while (s > 0 && isSpaceOrTab(source[s - 1])) s--;
		if (source[s - 1] === "\n") {
			s--;
			while (s > 0 && isSpaceOrTab(source[s - 1])) s--;
		}
	}
	return { start: s, end, label };
}

function applyEdits(source: string, edits: Edit[]): string {
	const ms = new MagicString(source);
	const sorted = [...edits].sort((a, b) => b.start - a.start);
	let lastStart = source.length + 1;
	for (const edit of sorted) {
		if (edit.end > lastStart) throw new Error(`编辑区间重叠：${edit.label}`);
		ms.remove(edit.start, edit.end);
		lastStart = edit.start;
	}
	return ms.toString();
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	if (typeof args.candidate !== "string" || typeof args.out !== "string") {
		throw new Error("用法：--candidate <in.js> --out <out.js> [--members 0|1] [--lazy N]");
	}
	const input = path.resolve(args.candidate);
	const output = path.resolve(args.out);
	const source = fs.readFileSync(input, "utf-8");
	const report = analyze(input);

	const doMembers = args.members !== "0";
	const lazyLimit = args.lazy === undefined ? 0 : Number(args.lazy);
	const memberLimit = args["members-limit"] === undefined ? Infinity : Number(args["members-limit"]);

	const edits: Edit[] = [];
	const deletedMembers: string[] = [];
	if (doMembers) {
		const candidates = report.members
			.filter((m) => !m.live && !m.hasPrototype && !m.stringReferenced && m.kind !== "property")
			.sort((a, b) => a.start - b.start)
			.slice(0, memberLimit);
		for (const m of candidates) {
			edits.push(propertyEdit(source, m.start, m.end, `${m.ns}.${m.name}`));
			deletedMembers.push(`${m.ns}.${m.name}@${m.line}`);
		}
	}

	const deletedLazy: string[] = [];
	if (lazyLimit > 0) {
		const candidates = report.lazy.filter((l) => !l.live).sort((a, b) => a.start - b.start).slice(0, lazyLimit);
		for (const l of candidates) {
			const edit = statementEdit(source, l.start, l.end, `lazy $.${l.slot}/$.${l.getter}`);
			if (!edit) continue;
			edits.push(edit);
			deletedLazy.push(`$.${l.slot}/$.${l.getter}@${l.line}`);
		}
		if (candidates.length > 0) {
			const slots = new Set(candidates.map((l) => l.slot));
			for (const edit of slotWriteEdits(source, slots)) {
				edits.push(edit);
				deletedLazy.push(`${edit.label}（slot 写入）`);
			}
		}
	}

	if (edits.length === 0) {
		console.log("没有可删除项");
		return;
	}

	const result = applyEdits(source, edits);
	fs.writeFileSync(output, result, "utf-8");

	ensureDir(REPORT_DIR);
	fs.writeFileSync(
		path.join(REPORT_DIR, "last-delete.json"),
		JSON.stringify({ input, output, members: deletedMembers, lazy: deletedLazy }, null, 2),
		"utf-8",
	);

	console.log(
		`删除成员 ${deletedMembers.length}，lazy ${deletedLazy.length}；${source.length} -> ${result.length} 字节`,
	);
	if (deletedMembers.length > 0) console.log(`成员：${deletedMembers.join(", ")}`);
	if (deletedLazy.length > 0) console.log(`lazy：${deletedLazy.join(", ")}`);
}

if (import.meta.main) {
	main();
}
