import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "../lib/args";
import { lineOf, parseScript, traverseAst } from "../lib/ast";
import { applyEdits, identifierEdit, type Edit } from "../lib/edits";
import { assertNotReserved, assertUniquePrototypeKeys, collectMethodDefinitions, countShorthandProperties } from "../lib/invariants";
import { assertSameLineCount, assertTokenShape } from "../lib/tokens";
import { resolveSignature, loadSignatureIndex } from "../lib/dart-signatures";
import { MEMBER_RENAMES } from "../data/rename-members";
import { PARAM_RENAMES, type MethodParamRename } from "../data/rename-params";
import { LATEST_DIR, REPORT_DIR, ensureDir, sha256File, writeJson } from "../lib/files";

const NAMER_SRC = "D:/githubs/namer/namer-src";

const JS_KEYWORDS = new Set([
	"await",
	"break",
	"case",
	"catch",
	"class",
	"const",
	"continue",
	"debugger",
	"default",
	"delete",
	"do",
	"else",
	"enum",
	"export",
	"extends",
	"false",
	"finally",
	"for",
	"function",
	"if",
	"implements",
	"import",
	"in",
	"instanceof",
	"interface",
	"let",
	"new",
	"null",
	"package",
	"private",
	"protected",
	"public",
	"return",
	"static",
	"super",
	"switch",
	"this",
	"throw",
	"true",
	"try",
	"typeof",
	"var",
	"void",
	"while",
	"with",
	"yield",
]);

interface ParamReport {
	owner: string;
	method: string;
	line: number;
	index: number;
	old: string;
	new: string;
	status: "applied" | "skipped";
	reason?: string;
}

function isFunctionProperty(prop: any): boolean {
	if (prop.type === "ObjectMethod") return true;
	return prop.type === "ObjectProperty" && prop.value?.type === "FunctionExpression";
}

function functionOf(prop: any): any {
	return prop.type === "ObjectMethod" ? prop : prop.value;
}

function isBlankIdentifier(node: any): boolean {
	return node?.type === "Identifier";
}

/** 标识符是否处于“不是变量引用/声明”的位置 */
function isNonReference(node: any, parent: any, key: string): boolean {
	if (!parent) return false;
	switch (parent.type) {
		case "MemberExpression":
		case "OptionalMemberExpression":
			return key === "property" && !parent.computed;
		case "ObjectProperty":
			return key === "key" && !parent.computed;
		case "ObjectMethod":
		case "ClassMethod":
		case "ClassProperty":
		case "ClassPrivateProperty":
			return key === "key" && !parent.computed;
		case "LabeledStatement":
			return key === "label";
		case "BreakStatement":
		case "ContinueStatement":
			return key === "label";
		case "MetaProperty":
			return true;
		default:
			return false;
	}
}

interface ScanResult {
	edits: Edit[];
	hasShorthand: boolean;
}

/** 收集函数子树里所有 oldName 的可改写位置（统一改名，保留嵌套遮蔽关系） */
function collectRenameEdits(fn: any, oldName: string, newName: string, label: string): ScanResult {
	const edits: Edit[] = [];
	let hasShorthand = false;
	const walk = (node: any, parent: any, key: string): void => {
		if (!node || typeof node.type !== "string") return;
		if (node.type === "ObjectProperty" && node.shorthand && node.key?.name === oldName) {
			hasShorthand = true;
		}
		if (node.type === "Identifier" && node.name === oldName && !isNonReference(node, parent, key)) {
			edits.push(identifierEdit(node, newName, label));
			return;
		}
		for (const childKey of Object.keys(node)) {
			if (childKey === "loc" || childKey === "leadingComments" || childKey === "trailingComments") continue;
			const value = node[childKey];
			if (Array.isArray(value)) {
				for (const child of value) if (child && typeof child.type === "string") walk(child, node, childKey);
			} else if (value && typeof value === "object" && typeof value.type === "string") {
				walk(value, node, childKey);
			}
		}
	};
	walk(fn, null, "");
	return { edits, hasShorthand };
}

/** 子树里是否已出现某个标识符名字（保守冲突检查） */
function subtreeHasIdentifier(fn: any, name: string): boolean {
	let found = false;
	const walk = (node: any): void => {
		if (found || !node || typeof node.type !== "string") return;
		if (node.type === "Identifier" && node.name === name) {
			found = true;
			return;
		}
		for (const key of Object.keys(node)) {
			if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
			const value = node[key];
			if (Array.isArray(value)) {
				for (const child of value) if (child && typeof child.type === "string") walk(child);
			} else if (value && typeof value === "object" && typeof value.type === "string") {
				walk(value);
			}
		}
	};
	walk(fn);
	return found;
}

function usableName(name: string): boolean {
	return /^[A-Za-z_$][\w$]*$/.test(name) && !JS_KEYWORDS.has(name) && name !== "arguments" && name !== "eval";
}

function emitMap(candidate: string): void {
	const source = fs.readFileSync(candidate, "utf-8");
	const ast = parseScript(source);
	const renamed = new Set<string>();
	for (const entry of MEMBER_RENAMES) {
		for (const owner of entry.owners) renamed.add(`${owner}#${entry.new}`);
	}
	const index = loadSignatureIndex(NAMER_SRC);
	const entries: MethodParamRename[] = [];
	const unmatched: Array<{ owner: string; method: string; arity: number; reason: string }> = [];
	let matched = 0;
	let unresolved = 0;
	for (const def of collectMethodDefinitions(ast)) {
		if (!renamed.has(`${def.owner}#${def.key}`)) continue;
		const fn = functionOf(def.prop);
		const params = fn.params;
		if (!params.every(isBlankIdentifier)) {
			unresolved++;
			unmatched.push({ owner: def.owner, method: def.key, arity: params.length, reason: "形参不是简单标识符" });
			continue;
		}
		const cls = def.owner.split(".").pop()!;
		const result = resolveSignature(index, cls, def.key, params.length);
		if (!("sig" in result)) {
			unresolved++;
			const reason =
				result.reason === "missing"
					? "Dart 源中没有同名方法"
					: result.reason === "arity"
						? "Dart 签名参数数量不一致"
						: "Dart 同名方法的参数名不唯一";
			unmatched.push({ owner: def.owner, method: def.key, arity: params.length, reason });
			continue;
		}
		const sig = result.sig;
		matched++;
		const jsNames = params.map((p: any) => p.name);
		if (sig.params.every((name, i) => name === jsNames[i])) continue;
		entries.push({
			owner: def.owner,
			method: def.key,
			params: sig.params,
			evidence: `${sig.file}:${sig.line}`,
		});
	}
	entries.sort((a, b) => a.owner.localeCompare(b.owner) || a.method.localeCompare(b.method));
	unmatched.sort((a, b) => a.owner.localeCompare(b.owner) || a.method.localeCompare(b.method));

	ensureDir(REPORT_DIR);
	writeJson(path.join(REPORT_DIR, "param-unmatched.json"), { methods: unmatched });

	const body = entries
		.map(
			(entry) =>
				`\t{\n\t\towner: ${JSON.stringify(entry.owner)},\n\t\tmethod: ${JSON.stringify(entry.method)},\n` +
				`\t\tparams: ${JSON.stringify(entry.params)},\n\t\tevidence: ${JSON.stringify(entry.evidence)},\n\t},`,
		)
		.join("\n");
	const header = fs.readFileSync(path.join(import.meta.dir, "../data/rename-params.ts"), "utf-8");
	const doc = header.slice(0, header.indexOf("export interface"));
	fs.writeFileSync(
		path.join(import.meta.dir, "../data/rename-params.ts"),
		`${doc}export interface MethodParamRename {\n\towner: string;\n\tmethod: string;\n\tparams: string[];\n\tevidence: string;\n}\n\n` +
			`export const PARAM_RENAMES: MethodParamRename[] = [\n${body}\n];\n`,
		"utf-8",
	);
	console.log(`映射生成：${entries.length} 个方法，签名匹配 ${matched} 个，未匹配 ${unresolved} 个`);
}

function apply(candidate: string, output: string): void {
	const source = fs.readFileSync(candidate, "utf-8");
	const ast = parseScript(source);
	assertUniquePrototypeKeys(ast, "rename-params 输入");
	const shorthandBefore = countShorthandProperties(ast);
	if (shorthandBefore !== 0) throw new Error(`输入存在 ${shorthandBefore} 个简写属性，无法安全重命名`);

	const table = new Map<string, MethodParamRename>();
	for (const entry of PARAM_RENAMES) table.set(`${entry.owner}#${entry.method}`, entry);

	const reports: ParamReport[] = [];
	const edits: Edit[] = [];

	for (const def of collectMethodDefinitions(ast)) {
		const entry = table.get(`${def.owner}#${def.key}`);
		if (!entry) continue;
		const fn = functionOf(def.prop);
		const params = fn.params;
		if (!params.every(isBlankIdentifier) || params.length !== entry.params.length) {
			for (let i = 0; i < Math.max(params.length, entry.params.length); i++) {
				reports.push({
					owner: def.owner,
					method: def.key,
					line: lineOf(def.prop),
					index: i,
					old: params[i]?.name ?? "?",
					new: entry.params[i] ?? "?",
					status: "skipped",
					reason: "形参数量或形态与映射不一致",
				});
			}
			continue;
		}
		const planned = new Map<number, string>();
		for (let i = 0; i < params.length; i++) {
			const old = params[i].name;
			const next = entry.params[i];
			const report: ParamReport = {
				owner: def.owner,
				method: def.key,
				line: lineOf(def.prop),
				index: i,
				old,
				new: next,
				status: "applied",
			};
			if (old === next) {
				report.status = "skipped";
				report.reason = "与 Dart 参数名一致";
				reports.push(report);
				continue;
			}
			if (!usableName(next)) {
				report.status = "skipped";
				report.reason = `目标名不可用：${next}`;
				reports.push(report);
				continue;
			}
			assertNotReserved(next, `参数 ${def.owner}.${def.key}`);
			if (subtreeHasIdentifier(fn, next)) {
				report.status = "skipped";
				report.reason = `函数内已存在同名标识符 ${next}`;
				reports.push(report);
				continue;
			}
			if ([...planned.values()].includes(next) || params.some((p: any, j: number) => j !== i && p.name === next)) {
				report.status = "skipped";
				report.reason = `与其他形参重名：${next}`;
				reports.push(report);
				continue;
			}
			const scan = collectRenameEdits(fn, old, next, `param ${def.owner}.${def.key}#${i} ${old}->${next}`);
			if (scan.hasShorthand) {
				report.status = "skipped";
				report.reason = "函数内存在同名简写属性";
				reports.push(report);
				continue;
			}
			edits.push(...scan.edits);
			planned.set(i, next);
			reports.push(report);
		}
	}

	// var _ = this -> var self = this
	const aliasFunctions: any[] = [];
	traverseAst(ast, {
		Function(path: any) {
			const body = path.node.body;
			if (body?.type !== "BlockStatement") return;
			const hasAlias = body.body.some(
				(stmt: any) =>
					stmt.type === "VariableDeclaration" &&
					stmt.declarations.some(
						(d: any) => d.id?.type === "Identifier" && d.id.name === "_" && d.init?.type === "ThisExpression",
					),
			);
			if (hasAlias) aliasFunctions.push(path.node);
		},
	});
	aliasFunctions.sort((a, b) => a.start - b.start);
	const outermost: any[] = [];
	for (const fn of aliasFunctions) {
		if (outermost.some((outer) => outer.start <= fn.start && fn.end <= outer.end)) continue;
		outermost.push(fn);
	}
	const aliasSkipped: Array<{ line: number; reason: string }> = [];
	let aliasRenamed = 0;
	for (const fn of outermost) {
		if (subtreeHasIdentifier(fn, "self")) {
			aliasSkipped.push({ line: lineOf(fn), reason: "函数内已存在 self 标识符" });
			continue;
		}
		const scan = collectRenameEdits(fn, "_", "self", `self alias@${lineOf(fn)}`);
		if (scan.hasShorthand) {
			aliasSkipped.push({ line: lineOf(fn), reason: "存在同名简写属性" });
			continue;
		}
		edits.push(...scan.edits);
		aliasRenamed++;
	}

	const result = applyEdits(source, edits);
	assertSameLineCount(source, result, "rename-params");
	assertTokenShape(source, result, [], "rename-params");
	const reparsed = parseScript(result);
	assertUniquePrototypeKeys(reparsed, "rename-params 输出");
	if (countShorthandProperties(reparsed) !== shorthandBefore) {
		throw new Error("rename-params: 简写属性数量发生变化");
	}
	fs.writeFileSync(output, result, "utf-8");

	ensureDir(REPORT_DIR);
	writeJson(path.join(REPORT_DIR, "rename-params.json"), {
		input: candidate,
		output,
		inputSha256: sha256File(candidate),
		outputSha256: sha256File(output),
		bytes: { before: Buffer.byteLength(source), after: Buffer.byteLength(result) },
		params: reports,
		selfAliases: { functions: outermost.length, renamed: aliasRenamed, skipped: aliasSkipped },
	});

	const applied = reports.filter((r) => r.status === "applied");
	const skipped = reports.filter((r) => r.status === "skipped" && r.reason !== "与 Dart 参数名一致");
	console.log(
		`参数重命名：应用 ${applied.length} 个，跳过 ${skipped.length} 个；` +
			`self 别名 ${aliasRenamed}/${outermost.length} 个函数，跳过 ${aliasSkipped.length} 个`,
	);
	console.log(`${Buffer.byteLength(source)} -> ${Buffer.byteLength(result)} 字节，${path.relative(process.cwd(), output)}`);
	const reasons = new Map<string, number>();
	for (const r of skipped) reasons.set(r.reason!, (reasons.get(r.reason!) ?? 0) + 1);
	for (const [reason, count] of reasons) console.log(`  ${count} × ${reason}`);
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const candidate = path.resolve(
		typeof args.candidate === "string" ? args.candidate : path.join(LATEST_DIR, "md5.stage2.js"),
	);
	const output = path.resolve(
		typeof args.out === "string" ? args.out : path.join(LATEST_DIR, "md5.stage3.js"),
	);
	if (args["emit-map"] === true) {
		emitMap(candidate);
		return;
	}
	apply(candidate, output);
}

if (import.meta.main) main();
