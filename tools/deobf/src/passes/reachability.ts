import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import * as fs from "node:fs";
import * as path from "node:path";
import { LATEST_DIR, REPORT_DIR, ensureDir, sha256File, writeJson } from "../lib/files";
import { parseArgs } from "../lib/args";

const traverse = (traverseModule as any).default ?? traverseModule;

const ROOT = "<root>";

export interface MemberInfo {
	ns: string;
	name: string;
	line: number;
	endLine: number;
	start: number;
	end: number;
	kind: "method" | "function" | "property";
	hasPrototype: boolean;
	stringReferenced: boolean;
	directRefs: number;
	live: boolean;
}

export interface LazyInfo {
	slot: string;
	getter: string;
	line: number;
	endLine: number;
	start: number;
	end: number;
	slotRefs: number;
	getterRefs: number;
	getterCalls: number;
	getterReads: number;
	slotWrites: number;
	initializerKind: string;
	literal: string | number | boolean | null | undefined;
	live: boolean;
}

export interface Reachability {
	source: string;
	sha256: string;
	members: MemberInfo[];
	lazy: LazyInfo[];
	namespaceEnumerated: string[];
	rootStrings: number;
}

interface MemberNode {
	info: MemberInfo;
	valueNode: any;
}

function literalValue(node: any): { kind: string; literal: any } {
	if (!node) return { kind: "none", literal: undefined };
	if (node.type === "NumericLiteral") return { kind: "number", literal: node.value };
	if (node.type === "StringLiteral") return { kind: "string", literal: node.value };
	if (node.type === "BooleanLiteral") return { kind: "boolean", literal: node.value };
	if (node.type === "NullLiteral") return { kind: "null", literal: null };
	return { kind: "other", literal: undefined };
}

export function analyze(file: string): Reachability {
	const source = fs.readFileSync(file, "utf-8");
	const ast: any = parse(source, {
		sourceType: "script",
		allowReturnOutsideFunction: true,
		errorRecovery: true,
		plugins: [],
	});
	const program = ast.program;

	const namespaces = new Map<string, { name: string; node: any }>();
	const memberByKey = new Map<string, MemberNode>();
	const memberIdByNode = new Map<any, string>();

	for (const node of program.body) {
		if (node.type !== "VariableDeclaration") continue;
		for (const decl of node.declarations) {
			if (decl.id.type === "Identifier" && decl.init?.type === "ObjectExpression") {
				namespaces.set(decl.id.name, { name: decl.id.name, node: decl.init });
			}
		}
	}
	// $ 是 lazy 属性的动态容器
	namespaces.set("$", { name: "$", node: { type: "ObjectExpression", properties: [] } });

	for (const [nsName, ns] of namespaces) {
		if (nsName === "$") continue;
		for (const prop of (ns.node as any).properties) {
			if (prop.type !== "ObjectMethod" && prop.type !== "ObjectProperty") continue;
			let key: string | null = null;
			if (!prop.computed) {
				if (prop.key.type === "Identifier") key = prop.key.name;
				else if (prop.key.type === "StringLiteral") key = prop.key.value;
			}
			if (!key) continue;
			const value = prop.type === "ObjectProperty" ? prop.value : prop;
			const kind: MemberInfo["kind"] =
				prop.type === "ObjectMethod"
					? "method"
					: value.type === "FunctionExpression" ||
						  value.type === "ArrowFunctionExpression"
						? "function"
						: "property";
			const id = `${nsName}.${key}`;
			const info: MemberInfo = {
				ns: nsName,
				name: key,
				line: prop.loc?.start.line ?? 0,
				endLine: prop.loc?.end.line ?? 0,
				start: prop.start ?? 0,
				end: prop.end ?? 0,
				kind,
				hasPrototype: false,
				stringReferenced: false,
				directRefs: 0,
				live: false,
			};
			memberByKey.set(id, { info, valueNode: value });
			memberIdByNode.set(value, id);
		}
	}

	// .prototype = ... 的类成员永不自动删除
	traverse(ast, {
		AssignmentExpression(p: any) {
			const left = p.node.left;
			if (
				left.type === "MemberExpression" &&
				!left.computed &&
				left.property.type === "Identifier" &&
				left.property.name === "prototype" &&
				left.object.type === "MemberExpression" &&
				!left.object.computed &&
				left.object.object.type === "Identifier" &&
				left.object.property.type === "Identifier"
			) {
				const id = `${left.object.object.name}.${left.object.property.name}`;
				const m = memberByKey.get(id);
				if (m) m.info.hasPrototype = true;
			}
		},
	});

	const strings = new Set<string>();
	traverse(ast, {
		StringLiteral(p: any) {
			strings.add(p.node.value);
		},
		TemplateElement(p: any) {
			strings.add(p.node.value.cooked ?? p.node.value.raw);
		},
	});
	for (const m of memberByKey.values()) {
		m.info.stringReferenced = strings.has(m.info.name);
	}

	// 收集 lazy 注册
	const lazy: LazyInfo[] = [];
	const lazyGetterNames = new Set<string>();
	const lazySlotNames = new Set<string>();
	traverse(ast, {
		CallExpression(p: any) {
			const callee = p.node.callee;
			if (callee.type !== "Identifier") return;
			if (callee.name !== "lazy_old" && callee.name !== "lazy_final" && callee.name !== "lazy") return;
			const args = p.node.arguments;
			if (args[0]?.type !== "Identifier" || args[0].name !== "$") return;
			if (args[1]?.type !== "StringLiteral" || args[2]?.type !== "StringLiteral") return;
			const fn = args[3];
			let kind = "other";
			let literal: any;
			if (fn?.type === "FunctionExpression" && fn.body.type === "BlockStatement") {
				const stmts = fn.body.body;
				if (stmts.length === 1 && stmts[0].type === "ReturnStatement") {
					const v = literalValue(stmts[0].argument);
					kind = v.kind;
					literal = v.literal;
				} else {
					kind = "block";
				}
			}
			const info: LazyInfo = {
				slot: args[1].value,
				getter: args[2].value,
				line: p.node.loc?.start.line ?? 0,
				endLine: p.node.loc?.end.line ?? 0,
				start: p.node.start ?? 0,
				end: p.node.end ?? 0,
				slotRefs: 0,
				getterRefs: 0,
				getterCalls: 0,
				getterReads: 0,
				slotWrites: 0,
				initializerKind: kind,
				literal,
				live: false,
			};
			lazy.push(info);
			lazyGetterNames.add(info.getter);
			lazySlotNames.add(info.slot);
		},
	});

	// 成员引用与调用图边
	const edges = new Map<string, Set<string>>();
	const addEdge = (from: string, to: string) => {
		let set = edges.get(from);
		if (!set) edges.set(from, (set = new Set()));
		set.add(to);
	};
	// module.exports 指向的对象其全部成员都是外部根
	const exportedObjects = new Set<string>();
	traverse(ast, {
		AssignmentExpression(p: any) {
			const left = p.node.left;
			if (
				left.type === "MemberExpression" &&
				!left.computed &&
				left.object.type === "Identifier" &&
				left.object.name === "module" &&
				left.property.type === "Identifier" &&
				left.property.name === "exports" &&
				p.node.right.type === "Identifier"
			) {
				exportedObjects.add(p.node.right.name);
			}
		},
	});
	const installers = new Set([
		"static_0",
		"static_1",
		"static_2",
		"instance_0u",
		"instance_1u",
		"instance_2u",
		"instance_0i",
		"instance_1i",
		"instance_2i",
		"install_static_tearoff",
		"install_instance_tear_off",
		"installStaticTearOff",
		"installInstanceTearOff",
	]);
	for (const nsName of namespaces.keys()) {
		if (nsName !== "$") lazySlotNames.add(nsName);
	}

	const enclosingMember = (p: any): string => {
		let cur = p;
		while (cur) {
			const id = memberIdByNode.get(cur.node);
			if (id) return id;
			// 对象的 value 节点是成员值本身
			if (cur.node?.type === "ObjectProperty" && memberIdByNode.has(cur.node.value)) {
				return memberIdByNode.get(cur.node.value)!;
			}
			cur = cur.parentPath;
		}
		return ROOT;
	};

	traverse(ast, {
		MemberExpression(p: any) {
			const node = p.node;
			if (node.object.type === "ThisExpression" && !node.computed && node.property.type === "Identifier") {
				const from = enclosingMember(p);
				if (from !== ROOT) {
					const ns = from.slice(0, from.indexOf("."));
					const id = `${ns}.${node.property.name}`;
					if (memberByKey.has(id)) addEdge(from, id);
				}
			}
			if (node.computed) {
				if (node.object.type === "Identifier" && node.property.type === "StringLiteral") {
					const id = `${node.object.name}.${node.property.value}`;
					const m = memberByKey.get(id);
					if (m) {
						m.info.directRefs++;
						addEdge(enclosingMember(p), id);
					}
				}
				return;
			}
			if (node.object.type === "Identifier" && node.property.type === "Identifier") {
				const id = `${node.object.name}.${node.property.name}`;
				const m = memberByKey.get(id);
				if (m) {
					m.info.directRefs++;
					addEdge(enclosingMember(p), id);
				}
			}
		},
		CallExpression(p: any) {
			const node = p.node;
			// $.slot / $.getter 访问
			if (
				node.callee.type === "MemberExpression" &&
				!node.callee.computed &&
				node.callee.object.type === "Identifier" &&
				node.callee.object.name === "$" &&
				node.callee.property.type === "Identifier"
			) {
				const name = node.callee.property.name;
				for (const l of lazy) {
					if (l.getter === name) {
						l.getterRefs++;
						l.getterCalls++;
					}
					if (l.slot === name) l.slotRefs++;
				}
			}
			// tear-off 安装调用：holder 命名空间上的字符串属性
			const callee = node.callee;
			const calleeName =
				callee.type === "Identifier"
					? callee.name
					: callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier"
						? callee.property.name
						: null;
			if (calleeName && installers.has(calleeName) && node.arguments[0]?.type === "Identifier") {
				const holder = node.arguments[0].name;
				for (const arg of node.arguments.slice(1, 3)) {
					if (arg.type === "StringLiteral") {
						const id = `${holder}.${arg.value}`;
						if (memberByKey.has(id)) addEdge(ROOT, id);
					}
				}
			}
		},
		AssignmentExpression(p: any) {
			const left = p.node.left;
			if (
				left.type === "MemberExpression" &&
				!left.computed &&
				left.object.type === "Identifier" &&
				left.object.name === "$" &&
				left.property.type === "Identifier"
			) {
				const name = left.property.name;
				for (const l of lazy) if (l.slot === name) l.slotWrites++;
			}
		},
	});
	// 普通（非调用）的 $.slot 读取
	traverse(ast, {
		MemberExpression(p: any) {
			const node = p.node;
			if (
				node.object.type === "Identifier" &&
				node.object.name === "$" &&
				!node.computed &&
				node.property.type === "Identifier"
			) {
				const parent = p.parentPath?.node;
				const isCall = parent?.type === "CallExpression" && parent.callee === node;
				if (isCall) return;
				const name = node.property.name;
				for (const l of lazy) {
					if (l.slot === name) l.slotRefs++;
					if (l.getter === name) {
						l.getterRefs++;
						l.getterReads++;
					}
				}
			}
		},
	});

	// 枚举命名空间（for-in / Object.keys(ns)）会暴露全部成员，直接全部标记为根
	const enumerated = new Set<string>();
	traverse(ast, {
		ForInStatement(p: any) {
			if (p.node.right.type === "Identifier" && namespaces.has(p.node.right.name)) {
				enumerated.add(p.node.right.name);
			}
		},
		CallExpression(p: any) {
			const c = p.node.callee;
			const name =
				c.type === "Identifier"
					? c.name
					: c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier"
						? c.property.name
						: null;
			if (name !== "keys" && name !== "getOwnPropertyNames" && name !== "values" && name !== "entries") return;
			const arg = p.node.arguments[0];
			if (arg?.type === "Identifier" && namespaces.has(arg.name)) enumerated.add(arg.name);
		},
	});

	// 导出对象的所有成员都是根；成员值指向的其它顶层对象也整体视为根
	const rootObjectMembers = (nsName: string) => {
		for (const [id, m] of memberByKey) {
			if (m.info.ns !== nsName) continue;
			addEdge(ROOT, id);
			const value = m.valueNode;
			if (value?.type === "Identifier" && namespaces.has(value.name)) {
				for (const [nestedId, nested] of memberByKey) {
					if (nested.info.ns === value.name) addEdge(ROOT, nestedId);
				}
			}
		}
	};
	for (const name of exportedObjects) {
		if (!namespaces.has(name)) continue;
		rootObjectMembers(name);
	}

	// 标记-清除
	const live = new Set<string>();
	const queue: string[] = [ROOT];
	while (queue.length > 0) {
		const node = queue.pop()!;
		for (const target of edges.get(node) ?? []) {
			if (live.has(target)) continue;
			live.add(target);
			queue.push(target);
		}
	}
	for (const m of memberByKey.values()) {
		m.info.live = live.has(`${m.info.ns}.${m.info.name}`);
	}

	for (const l of lazy) {
		l.live = l.slotRefs > 0 || l.getterRefs > 0;
	}

	return {
		source: path.resolve(file),
		sha256: sha256File(file),
		members: [...memberByKey.values()].map((m) => m.info).sort((a, b) => a.start - b.start),
		lazy,
		namespaceEnumerated: [...enumerated],
		rootStrings: strings.size,
	};
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const file =
		typeof args.candidate === "string" ? path.resolve(args.candidate) : path.join(LATEST_DIR, "md5.js");
	const outDir = typeof args.out === "string" ? path.resolve(args.out) : REPORT_DIR;
	ensureDir(outDir);

	const r = analyze(file);
	writeJson(path.join(outDir, "reachability.json"), r);

	const deadMembers = r.members.filter((m) => !m.live);
	// 类/构造器与字符串引用的成员不自动删
	const deletable = deadMembers.filter(
		(m) => !m.hasPrototype && !m.stringReferenced && m.kind !== "property",
	);
	const deadLazy = r.lazy.filter((l) => !l.live);
	const inlineLazy = r.lazy.filter(
		(l) => l.live && l.slotRefs > 0 && l.getterRefs === 0 && l.slotWrites === 0 && l.initializerKind !== "block" && l.initializerKind !== "other",
	);

	const lines: string[] = [];
	lines.push("# md5.js 可达性与死代码清单");
	lines.push("");
	lines.push(`- 源文件：\`${r.source}\``);
	lines.push(`- SHA-256：\`${r.sha256}\``);
	lines.push(`- 命名空间成员：${r.members.length}，不可达 ${deadMembers.length}，可自动删除 ${deletable.length}`);
	lines.push(`- lazy 注册：${r.lazy.length}，无引用 ${deadLazy.length}，可内联为字面量 ${inlineLazy.length}`);
	lines.push(`- 被枚举的命名空间：${r.namespaceEnumerated.length ? r.namespaceEnumerated.join(", ") : "无"}`);
	lines.push("");
	lines.push("## 可删除的命名空间成员（不可达 + 非类 + 无字符串引用）");
	lines.push("");
	lines.push("| 行 | 成员 | 类型 |");
	lines.push("| --- | --- | --- |");
	for (const m of deletable.sort((a, b) => a.start - b.start)) {
		lines.push(`| ${m.line}-${m.endLine} | \`${m.ns}.${m.name}\` | ${m.kind} |`);
	}
	lines.push("");
	lines.push("## 不可达但被保护（类/prototype 或字符串引用）");
	lines.push("");
	lines.push("| 行 | 成员 | 类型 | prototype | 字符串 |");
	lines.push("| --- | --- | --- | --- | --- |");
	for (const m of deadMembers
		.filter((m) => m.hasPrototype || m.stringReferenced)
		.sort((a, b) => a.start - b.start)) {
		lines.push(`| ${m.line} | \`${m.ns}.${m.name}\` | ${m.kind} | ${m.hasPrototype ? "是" : ""} | ${m.stringReferenced ? "是" : ""} |`);
	}
	lines.push("");
	lines.push("## 无引用的 lazy 注册");
	lines.push("");
	lines.push("| 行 | slot | getter | 初始化 | 字面量 |");
	lines.push("| --- | --- | --- | --- | --- |");
	for (const l of deadLazy.sort((a, b) => a.start - b.start)) {
		lines.push(`| ${l.line}-${l.endLine} | \`${l.slot}\` | \`${l.getter}\` | ${l.initializerKind} | ${l.literal !== undefined ? JSON.stringify(l.literal) : ""} |`);
	}
	lines.push("");
	lines.push("## 可内联的 lazy 字面量（有调用点，无写入，getter 无引用）");
	lines.push("");
	lines.push("| 行 | slot | 字面量 | slot 引用 |");
	lines.push("| --- | --- | --- | --- |");
	for (const l of inlineLazy.sort((a, b) => a.start - b.start)) {
		lines.push(`| ${l.line} | \`${l.slot}\` | ${JSON.stringify(l.literal)} | ${l.slotRefs} |`);
	}
	lines.push("");

	fs.writeFileSync(path.join(outDir, "dead-code.md"), `${lines.join("\n")}\n`, "utf-8");
	console.log(
		`成员 ${r.members.length}，不可达 ${deadMembers.length}（可删 ${deletable.length}），lazy ${r.lazy.length}（死 ${deadLazy.length}，可内联 ${inlineLazy.length}）`,
	);
	console.log(`写入 ${path.join(outDir, "dead-code.md")}`);
}

if (import.meta.main) {
	main();
}
