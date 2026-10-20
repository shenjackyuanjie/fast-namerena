import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import * as fs from "node:fs";
import * as path from "node:path";
import { LATEST_DIR, REPORT_DIR, ensureDir, sha256File, writeJson } from "../lib/files";
import { parseArgs } from "../lib/args";

const traverse = (traverseModule as any).default ?? traverseModule;

export interface TopLevelDecl {
	name: string;
	kind: "function" | "var" | "let" | "const" | "class";
	line: number;
	references: number;
	constantViolations: number;
	stringReferenced: boolean;
	propertyKey: boolean;
	memberName: boolean;
	exported: boolean;
}

export interface LazyEntry {
	name: string;
	getter: string;
	line: number;
	bodyKind: string;
	hasInlinedReturn: boolean;
}

export interface Inventory {
	source: string;
	sha256: string;
	topLevel: TopLevelDecl[];
	lazy: LazyEntry[];
	stringLiterals: number;
	propertyKeys: number;
	memberNames: number;
}

export function buildInventory(file: string): Inventory {
	const source = fs.readFileSync(file, "utf-8");
	const ast = parse(source, {
		sourceType: "script",
		allowReturnOutsideFunction: true,
		errorRecovery: true,
		plugins: [],
	});

	const strings = new Set<string>();
	const propertyKeys = new Set<string>();
	const memberNames = new Set<string>();
	const exported = new Set<string>();
	const lazy: LazyEntry[] = [];
	const decls: TopLevelDecl[] = [];
	const program = (ast as any).program;

	for (const node of program.body) {
		if (node.type === "FunctionDeclaration" && node.id?.name) {
			decls.push({
				name: node.id.name,
				kind: "function",
				line: node.loc?.start.line ?? 0,
				references: 0,
				constantViolations: 0,
				stringReferenced: false,
				propertyKey: false,
				memberName: false,
				exported: false,
			});
		} else if (node.type === "ClassDeclaration" && node.id?.name) {
			decls.push({
				name: node.id.name,
				kind: "class",
				line: node.loc?.start.line ?? 0,
				references: 0,
				constantViolations: 0,
				stringReferenced: false,
				propertyKey: false,
				memberName: false,
				exported: false,
			});
		} else if (node.type === "VariableDeclaration") {
			for (const declarator of node.declarations) {
				if (declarator.id.type !== "Identifier") continue;
				decls.push({
					name: declarator.id.name,
					kind: node.kind as TopLevelDecl["kind"],
					line: declarator.loc?.start.line ?? node.loc?.start.line ?? 0,
					references: 0,
					constantViolations: 0,
					stringReferenced: false,
					propertyKey: false,
					memberName: false,
					exported: false,
				});
			}
		} else if (
			node.type === "ExpressionStatement" &&
			node.expression.type === "AssignmentExpression" &&
			node.expression.left.type === "MemberExpression" &&
			!node.expression.left.computed &&
			node.expression.left.property.type === "Identifier" &&
			node.expression.left.property.name === "exports"
		) {
			const right = node.expression.right;
			if (right.type === "Identifier") exported.add(right.name);
		}
	}

	traverse(ast as any, {
		StringLiteral(path: any) {
			strings.add(path.node.value);
		},
		TemplateElement(path: any) {
			strings.add(path.node.value.cooked ?? path.node.value.raw);
		},
		ObjectProperty(path: any) {
			const key = path.node.key;
			if (!path.node.computed) {
				if (key.type === "Identifier") propertyKeys.add(key.name);
				else if (key.type === "StringLiteral") propertyKeys.add(key.value);
			}
		},
		ObjectMethod(path: any) {
			const key = path.node.key;
			if (!path.node.computed) {
				if (key.type === "Identifier") propertyKeys.add(key.name);
				else if (key.type === "StringLiteral") propertyKeys.add(key.value);
			}
		},
		ClassMethod(path: any) {
			const key = path.node.key;
			if (!path.node.computed) {
				if (key.type === "Identifier") propertyKeys.add(key.name);
				else if (key.type === "StringLiteral") propertyKeys.add(key.value);
			}
		},
		MemberExpression(path: any) {
			const prop = path.node.property;
			if (!path.node.computed && prop.type === "Identifier") {
				memberNames.add(prop.name);
			} else if (path.node.computed && prop.type === "StringLiteral") {
				memberNames.add(prop.value);
			}
		},
		CallExpression(path: any) {
			const callee = path.node.callee;
			if (
				callee.type === "Identifier" &&
				(callee.name === "lazy_old" || callee.name === "lazy_final" || callee.name === "lazy")
			) {
				const args = path.node.arguments;
				if (args[0]?.type === "Identifier" && args[0].name === "$") {
					const name = args[1]?.type === "StringLiteral" ? args[1].value : "<dynamic>";
					const getter = args[2]?.type === "StringLiteral" ? args[2].value : "<dynamic>";
					const fn = args[3];
					let bodyKind = "other";
					let hasInlinedReturn = false;
					if (fn?.type === "FunctionExpression" && fn.body.type === "BlockStatement") {
						const statements = fn.body.body;
						const returns = statements.filter((s: any) => s.type === "ReturnStatement");
						if (returns.length === 1 && statements.length === 1) {
							hasInlinedReturn = false;
						}
						const first = statements[0];
						if (
							first?.type === "ReturnStatement" &&
							statements.length >= 1
						) {
							hasInlinedReturn = true;
						}
						if (returns.length === 1) {
							const arg = returns[0].argument;
							if (arg?.type === "NewExpression") bodyKind = "new";
							else if (arg?.type === "ObjectExpression") bodyKind = "object";
							else if (arg?.type === "ArrayExpression") bodyKind = "array";
							else if (arg?.type === "CallExpression") bodyKind = "call";
							else if (arg?.type === "RegExpLiteral") bodyKind = "regexp";
							else bodyKind = arg?.type ?? "unknown";
						}
					}
					lazy.push({
						name,
						getter,
						line: path.node.loc?.start.line ?? 0,
						bodyKind,
						hasInlinedReturn,
					});
				}
			}
		},
	});

	const programScope = (ast as any).program;
	// Babel bindings are attached during traversal; use a second pass with Program enter.
	let programPath: any;
	traverse(ast as any, {
		Program(p: any) {
			programPath = p;
		},
	});
	const bindings = programPath?.scope?.bindings ?? {};
	for (const decl of decls) {
		const binding = bindings[decl.name];
		if (binding) {
			decl.references = binding.referencePaths.length;
			decl.constantViolations = binding.constantViolations.length;
			decl.exported = exported.has(decl.name);
		}
		decl.stringReferenced = strings.has(decl.name);
		decl.propertyKey = propertyKeys.has(decl.name);
		decl.memberName = memberNames.has(decl.name);
	}

	return {
		source: path.resolve(file),
		sha256: sha256File(file),
		topLevel: decls,
		lazy,
		stringLiterals: strings.size,
		propertyKeys: propertyKeys.size,
		memberNames: memberNames.size,
	};
}

function isDeadCandidate(decl: TopLevelDecl): boolean {
	if (decl.exported) return false;
	if (decl.references > 0 || decl.constantViolations > 0) return false;
	// 短名字太容易与动态字符串/属性重名，保守保留
	if (decl.name.length <= 2) return false;
	if (decl.stringReferenced || decl.propertyKey || decl.memberName) return false;
	return true;
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const file =
		typeof args.candidate === "string"
			? path.resolve(args.candidate)
			: path.join(LATEST_DIR, "md5.js");
	const inventory = buildInventory(file);
	const outDir = typeof args.out === "string" ? path.resolve(args.out) : REPORT_DIR;
	ensureDir(outDir);
	writeJson(path.join(outDir, "inventory.json"), inventory);

	const candidates = inventory.topLevel.filter(isDeadCandidate);
	const byKind = new Map<string, number>();
	for (const decl of inventory.topLevel) {
		byKind.set(decl.kind, (byKind.get(decl.kind) ?? 0) + 1);
	}
	const lazyInlined = inventory.lazy.filter((l) => l.hasInlinedReturn).length;
	const lazyKinds = new Map<string, number>();
	for (const l of inventory.lazy) lazyKinds.set(l.bodyKind, (lazyKinds.get(l.bodyKind) ?? 0) + 1);

	const lines: string[] = [];
	lines.push("# md5.js 可达性清单");
	lines.push("");
	lines.push(`- 源文件：\`${inventory.source}\``);
	lines.push(`- SHA-256：\`${inventory.sha256}\``);
	lines.push(`- 顶层声明：${inventory.topLevel.length}（${[...byKind].map(([k, v]) => `${k} ${v}`).join("，")}）`);
	lines.push(`- 无静态引用的候选：**${candidates.length}**`);
	lines.push(`- lazy 初始化器：${inventory.lazy.length}，其中首语句为 return 的 ${lazyInlined}`);
	lines.push(`- 字符串字面量 ${inventory.stringLiterals}，对象键 ${inventory.propertyKeys}，成员名 ${inventory.memberNames}`);
	lines.push("");
	lines.push("## 可安全删除候选（零引用 + 无字符串/属性/成员名冲突）");
	lines.push("");
	if (candidates.length === 0) {
		lines.push("无。");
	} else {
		lines.push("| 行 | 类型 | 名称 |");
		lines.push("| --- | --- | --- |");
		for (const decl of candidates.sort((a, b) => a.line - b.line)) {
			lines.push(`| ${decl.line} | ${decl.kind} | \`${decl.name}\` |`);
		}
	}
	lines.push("");
	lines.push("## 有零引用但被动态名字覆盖、需人工确认");
	lines.push("");
	const dynamic = inventory.topLevel.filter(
		(d) =>
			!d.exported &&
			d.references === 0 &&
			d.constantViolations === 0 &&
			(d.stringReferenced || d.propertyKey || d.memberName || d.name.length <= 2),
	);
	if (dynamic.length === 0) {
		lines.push("无。");
	} else {
		lines.push("| 行 | 类型 | 名称 | 字符串 | 对象键 | 成员名 |");
		lines.push("| --- | --- | --- | --- | --- | --- |");
		for (const decl of dynamic.sort((a, b) => a.line - b.line)) {
			lines.push(
				`| ${decl.line} | ${decl.kind} | \`${decl.name}\` | ${decl.stringReferenced ? "是" : ""} | ${decl.propertyKey ? "是" : ""} | ${decl.memberName ? "是" : ""} |`,
			);
		}
	}
	lines.push("");
	lines.push("## lazy 初始化器分类");
	lines.push("");
	lines.push("| 类型 | 数量 |");
	lines.push("| --- | --- |");
	for (const [kind, count] of [...lazyKinds].sort((a, b) => b[1] - a[1])) {
		lines.push(`| ${kind} | ${count} |`);
	}
	lines.push("");
	lines.push("## 说明");
	lines.push("");
	lines.push("- `references` 只统计标识符绑定引用；字符串、对象键、成员名单独统计。");
	lines.push("- 对象键与成员名冲突采用保守策略：只要出现过同名键/成员，就不自动删除。");
	lines.push("- 动态根（aliases/installTearOffs/inheritance/staticFields/constants/type table）全部通过字符串字面量进入 `stringReferenced`。");
	lines.push("- 下一步只处理“可安全删除候选”，并逐批运行 `verify`。");

	fs.writeFileSync(path.join(outDir, "dead-code.md"), `${lines.join("\n")}\n`, "utf-8");
	console.log(`顶层声明 ${inventory.topLevel.length}，候选 ${candidates.length}，lazy ${inventory.lazy.length}`);
	console.log(`写入 ${path.join(outDir, "dead-code.md")}`);
	if (candidates.length > 0) {
		console.log(candidates.map((d) => `${d.line}:${d.kind}:${d.name}`).join("\n"));
	}
}

if (import.meta.main) {
	main();
}
