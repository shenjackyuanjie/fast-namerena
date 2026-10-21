import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "../lib/args";
import { lineOf, parseScript, traverseAst } from "../lib/ast";
import { applyEdits, type Edit } from "../lib/edits";
import { assertNotReserved, assertUniquePrototypeKeys, collectMethodDefinitions } from "../lib/invariants";
import { findDispatchConflicts } from "../lib/inheritance";
import { assertSameLineCount, assertTokenShape, type StringChange } from "../lib/tokens";
import { MEMBER_RENAMES, type MemberRename } from "../data/rename-members";
import { LATEST_DIR, REPORT_DIR, ensureDir, sha256File, writeJson } from "../lib/files";

interface EntryReport {
	old: string;
	new: string;
	status: "applied" | "skipped";
	reason?: string;
	definitions: number;
	owners: string[];
	prototypeKeys: number;
	memberAccesses: number;
	computedAccesses: number;
	registryStrings: number;
}

function calleeName(node: any): string | null {
	if (node.type === "Identifier") return node.name;
	if (node.type === "MemberExpression" && !node.computed) {
		if (node.property.type === "Identifier") return node.property.name;
	}
	return null;
}

/** tear-off 注册表里方法名所在的参数位置 */
function tearOffMethodSlot(name: string): { kind: "string"; index: number } | { kind: "array"; index: number } | null {
	const n = name.replace(/^_/, "");
	if (/^static_[012]$/.test(n) || /^instance_[012][ui]$/.test(n)) {
		return { kind: "string", index: 2 };
	}
	if (/^installstatictearoff$/i.test(name) || /^install_static_tear_off$/i.test(name)) {
		return { kind: "array", index: 5 };
	}
	if (/^installinstancetearoff$/i.test(name) || /^install_instance_tear_off$/i.test(name)) {
		return { kind: "array", index: 6 };
	}
	return null;
}

/** tearOffParameters() 生成的描述符字段名；其中 cs/fs/dV 也是领域字段，不能单独作为判据 */
const TEAROFF_DESCRIPTOR_KEYS = new Set(["co", "iS", "iI", "rC", "dV", "cs", "fs", "fT", "aI", "nDA"]);
const TEAROFF_DESCRIPTOR_ANCHORS = ["co", "iS", "iI", "rC", "fT", "aI", "nDA"];
const TEAROFF_ANCHOR_THRESHOLD = 3;

type DescriptorKeysByScope = Map<any, Map<string, Set<string>>>;

type ScopeKind = "root" | "function" | "block";

interface ScopeInfo {
	kind: ScopeKind;
	locals: Set<string>;
	parent: ScopeInfo | null;
}

interface ScopeTable {
	byNode: Map<any, ScopeInfo>;
	root: ScopeInfo;
}

/**
 * 显式收集作用域声明名。Babel 的 path.scope 在多次 traverse 后
 * 会丢掉作用域链（getFunctionParent 返回 undefined），这里不依赖它。
 */
function collectScopes(ast: any): ScopeTable {
	const root: ScopeInfo = { kind: "root", locals: new Set(), parent: null };
	const byNode = new Map<any, ScopeInfo>();
	byNode.set(ast.program, root);

	function patternNames(pattern: any, out: string[]): void {
		if (!pattern) return;
		switch (pattern.type) {
			case "Identifier":
				out.push(pattern.name);
				break;
			case "AssignmentPattern":
				patternNames(pattern.left, out);
				break;
			case "RestElement":
				patternNames(pattern.argument, out);
				break;
			case "ObjectPattern":
				for (const prop of pattern.properties) patternNames(prop.value ?? prop.argument, out);
				break;
			case "ArrayPattern":
				for (const element of pattern.elements) patternNames(element, out);
				break;
		}
	}

	function namesOf(pattern: any): string[] {
		const names: string[] = [];
		patternNames(pattern, names);
		return names;
	}

	function functionScopeOf(scope: ScopeInfo): ScopeInfo {
		let current = scope;
		while (current.kind === "block" && current.parent) current = current.parent;
		return current;
	}

	function childScope(kind: ScopeKind, node: any, parent: ScopeInfo): ScopeInfo {
		const info: ScopeInfo = { kind, locals: new Set(), parent };
		byNode.set(node, info);
		return info;
	}

	function forEachChild(node: any, fn: (child: any) => void): void {
		for (const key of Object.keys(node)) {
			if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
			const value = (node as any)[key];
			if (Array.isArray(value)) {
				for (const child of value) if (child && typeof child.type === "string") fn(child);
			} else if (value && typeof value === "object" && typeof value.type === "string") {
				fn(value);
			}
		}
	}

	function walk(node: any, scope: ScopeInfo): void {
		if (!node || typeof node.type !== "string") return;
		switch (node.type) {
			case "Program":
				for (const stmt of node.body) walk(stmt, scope);
				return;
			case "FunctionDeclaration":
			case "FunctionExpression":
			case "ObjectMethod":
			case "ArrowFunctionExpression": {
				if (node.type === "FunctionDeclaration" && node.id) scope.locals.add(node.id.name);
				const fnScope = childScope("function", node, scope);
				if (node.type === "FunctionExpression" && node.id) fnScope.locals.add(node.id.name);
				for (const param of node.params ?? []) {
					for (const name of namesOf(param)) fnScope.locals.add(name);
				}
				if (node.body?.type === "BlockStatement") {
					for (const stmt of node.body.body) walk(stmt, fnScope);
				} else if (node.body) {
					walk(node.body, fnScope);
				}
				return;
			}
			case "BlockStatement": {
				const blockScope = childScope("block", node, scope);
				for (const stmt of node.body) walk(stmt, blockScope);
				return;
			}
			case "CatchClause": {
				const catchScope = childScope("block", node, scope);
				for (const name of namesOf(node.param)) catchScope.locals.add(name);
				if (node.body) walk(node.body, catchScope);
				return;
			}
			case "ForStatement":
			case "ForInStatement":
			case "ForOfStatement":
			case "SwitchStatement": {
				const loopScope = childScope("block", node, scope);
				forEachChild(node, (child) => walk(child, loopScope));
				return;
			}
			case "VariableDeclaration": {
				const target = node.kind === "var" ? functionScopeOf(scope) : scope;
				for (const declarator of node.declarations) {
					for (const name of namesOf(declarator.id)) target.locals.add(name);
					if (declarator.init) walk(declarator.init, scope);
				}
				return;
			}
			case "ClassDeclaration":
				if (node.id) scope.locals.add(node.id.name);
				forEachChild(node, (child) => walk(child, scope));
				return;
			default:
				forEachChild(node, (child) => walk(child, scope));
		}
	}

	walk(ast.program, root);
	return { byNode, root };
}

function nearestFunction(path: any): any | null {
	for (let p = path.parentPath; p; p = p.parentPath) {
		if (p.isFunction()) return p.node;
	}
	return null;
}

/** 找到成员访问所在的最内层作用域 */
function nearestScope(path: any, scopes: ScopeTable): ScopeInfo {
	for (let p = path.parentPath; p; p = p.parentPath) {
		const info = scopes.byNode.get(p.node);
		if (info) return info;
	}
	return scopes.root;
}

/** dart2js 运行时内部函数（类型解析器、类型宇宙、泛型替换）里的成员名与领域方法无关 */
const RUNTIME_HELPER_KEY = /^(_Parser_|_Universe_|_substitute)/;

function collectRuntimeHelpers(ast: any): Set<any> {
	const helpers = new Set<any>();
	for (const node of ast.program.body) {
		if (node.type !== "VariableDeclaration") continue;
		for (const declarator of node.declarations) {
			if (declarator.init?.type !== "ObjectExpression") continue;
			for (const prop of declarator.init.properties) {
				if (prop.type !== "ObjectMethod" || prop.computed) continue;
				const name = prop.key.type === "Identifier" ? prop.key.name : prop.key.value;
				if (typeof name === "string" && RUNTIME_HELPER_KEY.test(name)) helpers.add(prop);
			}
		}
	}
	return helpers;
}

/** 按函数作用域收集标识符的成员读取；赋值目标的键不算，避免把别名表误判为描述符 */
function collectDescriptorReceivers(ast: any): DescriptorKeysByScope {
	const result: DescriptorKeysByScope = new Map();
	traverseAst(ast, {
		MemberExpression(path: any) {
			const node = path.node;
			if (node.computed || node.object.type !== "Identifier" || node.property.type !== "Identifier") return;
			if (!TEAROFF_DESCRIPTOR_KEYS.has(node.property.name)) return;
			const parent = path.parentPath?.node;
			if (parent?.type === "AssignmentExpression" && parent.left === node) return;
			const scopeNode = nearestFunction(path) ?? ast.program;
			const byName = result.get(scopeNode) ?? new Map<string, Set<string>>();
			const keys = byName.get(node.object.name) ?? new Set<string>();
			keys.add(node.property.name);
			byName.set(node.object.name, keys);
			result.set(scopeNode, byName);
		},
	});
	return result;
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const batch = Number(typeof args.batch === "string" ? args.batch : "1");
	const input =
		typeof args.candidate === "string"
			? path.resolve(args.candidate)
			: path.join(LATEST_DIR, "md5.js");
	const output =
		typeof args.out === "string"
			? path.resolve(args.out)
			: path.join(LATEST_DIR, `md5.stage${batch}.js`);

	const source = fs.readFileSync(input, "utf-8");
	const ast = parseScript(source);
	const methods = collectMethodDefinitions(ast);
	assertUniquePrototypeKeys(ast, "rename-members 输入");

	const byKey = new Map<string, typeof methods>();
	for (const def of methods) {
		const list = byKey.get(def.key) ?? [];
		list.push(def);
		byKey.set(def.key, list);
	}

	const selected = MEMBER_RENAMES.filter((entry) => entry.batch === batch);
	const limit = typeof args.limit === "string" ? Number(args.limit) : selected.length;
	const chosen = selected.slice(0, Math.max(0, limit));
	const reports: EntryReport[] = [];
	const active = new Map<string, MemberRename>();

	for (const entry of chosen) {
		const defs = byKey.get(entry.old) ?? [];
		const actualOwners = [...new Set(defs.map((d) => d.owner))].sort();
		const expectedOwners = [...new Set(entry.owners)].sort();
		const report: EntryReport = {
			old: entry.old,
			new: entry.new,
			status: "applied",
			definitions: defs.length,
			owners: actualOwners,
			prototypeKeys: 0,
			memberAccesses: 0,
			computedAccesses: 0,
			registryStrings: 0,
		};
		if (defs.length === 0) {
			report.status = "skipped";
			report.reason = "源文件中没有该名字的方法定义（可能已重命名）";
			reports.push(report);
			continue;
		}
		if (actualOwners.join("\n") !== expectedOwners.join("\n")) {
			report.status = "skipped";
			report.reason = `owner 集合不一致：期望 ${expectedOwners.length} 个，实际 ${actualOwners.length} 个`;
			reports.push(report);
			continue;
		}
		assertNotReserved(entry.new, `成员映射 ${entry.old}`);
		const collision = defs.find((def) => def.block.keys.has(entry.new));
		if (collision) {
			report.status = "skipped";
			report.reason = `目标名 ${entry.new} 已存在于 ${collision.owner} 的 prototype 块`;
			reports.push(report);
			continue;
		}
		active.set(entry.old, entry);
		reports.push(report);
	}

	// 改名不能让任意类的原型方法解析结果发生变化（含继承与 mixin）
	for (let round = 0; round < 4 && active.size > 0; round++) {
		const conflicts = findDispatchConflicts(ast, [...active.values()]);
		if (conflicts.size === 0) break;
		for (const [old, reason] of conflicts) {
			active.delete(old);
			const report = reports.find((r) => r.old === old)!;
			report.status = "skipped";
			report.reason = `继承链解析冲突：${reason}`;
		}
	}

	const descriptorKeysByScope = collectDescriptorReceivers(ast);
	const runtimeHelpers = collectRuntimeHelpers(ast);
	const scopes = collectScopes(ast);

	const edits: Edit[] = [];
	const stringChanges: StringChange[] = [];

	for (const entry of active.values()) {
		for (const def of byKey.get(entry.old)!) {
			const key = def.prop.key;
			if (key.type === "Identifier") {
				edits.push({
					start: key.start,
					end: key.end,
					text: entry.new,
					label: `method ${def.owner}.${entry.old} -> ${entry.new}`,
				});
			} else if (key.type === "StringLiteral") {
				edits.push({
					start: key.start,
					end: key.end,
					text: JSON.stringify(entry.new),
					label: `method ${def.owner}["${entry.old}"]`,
				});
				stringChanges.push({ from: entry.old, to: entry.new });
			}
			reports.find((r) => r.old === entry.old)!.prototypeKeys++;
		}
	}

	traverseAst(ast, {
		MemberExpression(path: any) {
			renameMember(path);
		},
		OptionalMemberExpression(path: any) {
			renameMember(path);
		},
	});

	/** 仅跳过真正指向顶层命名空间/类型表的访问；局部同名变量照常改写 */
	function isNamespaceObject(path: any, object: any): boolean {
		if (object.type !== "Identifier") return false;
		let scope: ScopeInfo | null = nearestScope(path, scopes);
		while (scope) {
			if (scope.locals.has(object.name)) return scope.kind === "root";
			scope = scope.parent;
		}
		return true;
	}

	/** 同一函数内被当作 dart2js tear-off 描述符使用的接收者，其成员名不是领域方法 */
	function isDescriptorReceiver(path: any, object: any): boolean {
		if (object.type !== "Identifier") return false;
		const scopeNode = nearestFunction(path) ?? ast.program;
		const keys = descriptorKeysByScope.get(scopeNode)?.get(object.name);
		if (!keys) return false;
		let anchors = 0;
		for (const key of TEAROFF_DESCRIPTOR_ANCHORS) if (keys.has(key)) anchors++;
		return anchors >= TEAROFF_ANCHOR_THRESHOLD;
	}

	function isRuntimeHelper(path: any): boolean {
		for (let p = path.parentPath; p; p = p.parentPath) {
			if (runtimeHelpers.has(p.node)) return true;
		}
		return false;
	}

	function renameMember(path: any): void {
		const node = path.node;
		const object = node.object;
		if (isNamespaceObject(path, object)) return;
		if (isDescriptorReceiver(path, object)) return;
		if (isRuntimeHelper(path)) return;
		const prop = node.property;
		if (!node.computed && prop.type === "Identifier") {
			const entry = active.get(prop.name);
			if (!entry) return;
			edits.push({
				start: prop.start,
				end: prop.end,
				text: entry.new,
				label: `access .${entry.old} -> .${entry.new}@${lineOf(node)}`,
			});
			reports.find((r) => r.old === entry.old)!.memberAccesses++;
			return;
		}
		if (node.computed && prop.type === "StringLiteral") {
			const entry = active.get(prop.value);
			if (!entry) return;
			edits.push({
				start: prop.start,
				end: prop.end,
				text: JSON.stringify(entry.new),
				label: `computed ["${entry.old}"]@${lineOf(node)}`,
			});
			stringChanges.push({ from: entry.old, to: entry.new });
			reports.find((r) => r.old === entry.old)!.computedAccesses++;
		}
	}

	traverseAst(ast, {
		CallExpression(path: any) {
			const name = calleeName(path.node.callee);
			if (!name) return;
			const slot = tearOffMethodSlot(name);
			if (!slot) return;
			const arg = path.node.arguments[slot.index];
			if (!arg) return;
			const targets =
				slot.kind === "array" && arg.type === "ArrayExpression"
					? arg.elements
					: slot.kind === "string" && arg.type === "StringLiteral"
						? [arg]
						: [];
			for (const element of targets) {
				if (element?.type !== "StringLiteral") continue;
				const entry = active.get(element.value);
				if (!entry) continue;
				edits.push({
					start: element.start,
					end: element.end,
					text: JSON.stringify(entry.new),
					label: `tearoff ${name} ${entry.old} -> ${entry.new}@${lineOf(element)}`,
				});
				stringChanges.push({ from: entry.old, to: entry.new });
				reports.find((r) => r.old === entry.old)!.registryStrings++;
			}
		},
	});

	const result = applyEdits(source, edits);
	assertSameLineCount(source, result, `rename-members batch ${batch}`);
	assertTokenShape(source, result, stringChanges, `rename-members batch ${batch}`);
	const reparsed = parseScript(result);
	assertUniquePrototypeKeys(reparsed, "rename-members 输出");
	fs.writeFileSync(output, result, "utf-8");

	ensureDir(REPORT_DIR);
	const reportPath = path.join(REPORT_DIR, "rename-report.json");
	const previous = fs.existsSync(reportPath)
		? JSON.parse(fs.readFileSync(reportPath, "utf-8"))
		: { batches: {} };
	previous.batches[String(batch)] = {
		input,
		output,
		inputSha256: sha256File(input),
		outputSha256: sha256File(output),
		bytes: { before: Buffer.byteLength(source), after: Buffer.byteLength(result) },
		entries: reports,
	};
	writeJson(reportPath, previous);

	const applied = reports.filter((r) => r.status === "applied");
	const skipped = reports.filter((r) => r.status === "skipped");
	const counts = applied.reduce(
		(acc, r) => ({
			keys: acc.keys + r.prototypeKeys,
			accesses: acc.accesses + r.memberAccesses,
			computed: acc.computed + r.computedAccesses,
			registry: acc.registry + r.registryStrings,
		}),
		{ keys: 0, accesses: 0, computed: 0, registry: 0 },
	);
	console.log(
		`批次 ${batch}: 应用 ${applied.length} 条，跳过 ${skipped.length} 条；` +
			`方法键 ${counts.keys}，成员访问 ${counts.accesses}，计算访问 ${counts.computed}，注册表字符串 ${counts.registry}`,
	);
	console.log(`${Buffer.byteLength(source)} -> ${Buffer.byteLength(result)} 字节，${path.relative(process.cwd(), output)}`);
	for (const r of skipped) console.log(`跳过 ${r.old}: ${r.reason}`);
}

if (import.meta.main) {
	main();
}
