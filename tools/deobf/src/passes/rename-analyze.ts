import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "../lib/args";
import { parseScript, traverseAst } from "../lib/ast";
import { collectMethodDefinitions } from "../lib/invariants";
import { LATEST_DIR, REPORT_DIR, ensureDir, sha256File, writeJson } from "../lib/files";

interface MethodRow {
	owner: string;
	key: string;
	line: number;
	arity: number;
	params: string[];
	comment: string | null;
}

interface KeyRow {
	key: string;
	owners: string[];
	definitions: number;
	accesses: number;
	computed: number;
	strings: number;
	registryStrings: number;
}

function leadingComment(lines: string[], line: number): string | null {
	for (let i = line - 2; i >= 0 && i >= line - 5; i--) {
		const text = lines[i].trim();
		if (text.startsWith("//")) return text.replace(/^\/+\s*/, "");
		if (text === "" || text.endsWith("{") || text.endsWith(",")) continue;
		break;
	}
	return null;
}

function registryStringNodes(ast: any): Set<any> {
	const nodes = new Set<any>();
	traverseAst(ast, {
		CallExpression(path: any) {
			const callee = path.node.callee;
			let name = "";
			if (callee.type === "Identifier") name = callee.name;
			else if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
				name = callee.property.name;
			}
			if (!/^(static_|instance_|install_|lazy_)/.test(name)) return;
			for (const arg of path.node.arguments) {
				if (arg.type === "StringLiteral") nodes.add(arg);
				else if (arg.type === "ArrayExpression") {
					for (const element of arg.elements) {
						if (element?.type === "StringLiteral") nodes.add(element);
					}
				}
			}
		},
	});
	return nodes;
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const file =
		typeof args.candidate === "string"
			? path.resolve(args.candidate)
			: path.join(LATEST_DIR, "md5.js");
	const source = fs.readFileSync(file, "utf-8");
	const lines = source.split("\n");
	const ast = parseScript(source);
	const registryNodes = registryStringNodes(ast);

	const methods: MethodRow[] = [];
	const keyMap = new Map<string, KeyRow>();
	for (const def of collectMethodDefinitions(ast)) {
		const params =
			def.prop.type === "ObjectMethod"
				? def.prop.params
				: def.prop.value.params;
		const names = params.map((p: any) => (p.type === "Identifier" ? p.name : `<${p.type}>`));
		methods.push({
			owner: def.owner,
			key: def.key,
			line: def.line,
			arity: params.length,
			params: names,
			comment: leadingComment(lines, def.line),
		});
		let row = keyMap.get(def.key);
		if (!row) {
			row = {
				key: def.key,
				owners: [],
				definitions: 0,
				accesses: 0,
				computed: 0,
				strings: 0,
				registryStrings: 0,
			};
			keyMap.set(def.key, row);
		}
		if (!row.owners.includes(def.owner)) row.owners.push(def.owner);
		row.definitions++;
	}

	traverseAst(ast, {
		MemberExpression(path: any) {
			const prop = path.node.property;
			const name = path.node.computed
				? prop.type === "StringLiteral"
					? prop.value
					: null
				: prop.type === "Identifier"
					? prop.name
					: null;
			if (name == null) return;
			const row = keyMap.get(name);
			if (!row) return;
			if (path.node.computed) row.computed++;
			else row.accesses++;
		},
		StringLiteral(path: any) {
			const row = keyMap.get(path.node.value);
			if (!row) return;
			if (registryNodes.has(path.node)) row.registryStrings++;
			else row.strings++;
		},
	});

	const keyRows = [...keyMap.values()].sort(
		(a, b) => b.definitions - a.definitions || a.key.localeCompare(b.key),
	);
	for (const row of keyRows) row.owners.sort();

	ensureDir(REPORT_DIR);
	writeJson(path.join(REPORT_DIR, "rename-inventory.json"), {
		source: file,
		sha256: sha256File(file),
		methods,
		keys: keyRows,
	});

	const md: string[] = [];
	md.push("# 方法重命名盘点");
	md.push("");
	md.push(`- 源文件：\`${path.relative(REPORT_DIR, file)}\``);
	md.push(`- SHA-256：\`${sha256File(file)}\``);
	md.push(`- 方法定义：${methods.length}，唯一名字：${keyRows.length}`);
	md.push("");
	md.push("## 按类列出（含行号、参数、前导注释）");
	md.push("");
	const byOwner = new Map<string, MethodRow[]>();
	for (const method of methods) {
		if (!byOwner.has(method.owner)) byOwner.set(method.owner, []);
		byOwner.get(method.owner)!.push(method);
	}
	const owners = [...byOwner.keys()].sort((a, b) =>
		(byOwner.get(a)![0]?.line ?? 0) - (byOwner.get(b)![0]?.line ?? 0),
	);
	for (const owner of owners) {
		const rows = byOwner.get(owner)!.sort((a, b) => a.line - b.line);
		md.push(`### ${owner}`);
		md.push("");
		md.push("| 行 | 方法 | 参数 | 注释 |");
		md.push("| --- | --- | --- | --- |");
		for (const row of rows) {
			md.push(
				`| ${row.line} | \`${row.key}\` | ${row.arity} (${row.params.join(", ")}) | ${row.comment ?? ""} |`,
			);
		}
		md.push("");
	}
	fs.writeFileSync(path.join(REPORT_DIR, "rename-candidates.md"), `${md.join("\n")}\n`, "utf-8");

	const shared = keyRows.filter((row) => row.owners.length > 1);
	console.log(`方法 ${methods.length}，唯一名字 ${keyRows.length}，共享名字 ${shared.length}`);
	console.log(`写入 ${path.join(REPORT_DIR, "rename-candidates.md")}`);
	console.log(`写入 ${path.join(REPORT_DIR, "rename-inventory.json")}`);
}

if (import.meta.main) {
	main();
}
