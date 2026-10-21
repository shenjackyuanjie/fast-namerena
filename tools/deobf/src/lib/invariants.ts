import { collectPrototypeBlocks, propertyName, traverseAst } from "./ast";

const RESERVED = new Set([
	"arguments",
	"eval",
	"undefined",
	"NaN",
	"Infinity",
	"this",
	"super",
	"null",
	"true",
	"false",
]);

export function assertNotReserved(name: string, context: string): void {
	if (RESERVED.has(name)) throw new Error(`${context}: 不能使用保留名 ${name}`);
}

export function countShorthandProperties(ast: any): number {
	let count = 0;
	traverseAst(ast, {
		ObjectProperty(path: any) {
			if (path.node.shorthand) count++;
		},
	});
	return count;
}

/** 目标键若在同一个 prototype 块里已存在，返回 true */
export function blockHasKey(block: { keys: Map<string, any> }, key: string): boolean {
	return block.keys.has(key);
}

export function assertUniquePrototypeKeys(ast: any, label: string): void {
	for (const block of collectPrototypeBlocks(ast)) {
		const seen = new Set<string>();
		for (const prop of block.node.right.properties) {
			const name = propertyName(prop);
			if (name == null) continue;
			if (seen.has(name)) {
				throw new Error(`${label}: ${block.owner} 存在重复键 ${name}@${block.line}`);
			}
			seen.add(name);
		}
	}
}

/** 收集所有 prototype 方法定义（含 owner） */
export interface MethodDefinition {
	owner: string;
	key: string;
	line: number;
	block: any;
	prop: any;
}

export function collectMethodDefinitions(ast: any): MethodDefinition[] {
	const out: MethodDefinition[] = [];
	for (const block of collectPrototypeBlocks(ast)) {
		for (const prop of block.node.right.properties) {
			const key = propertyName(prop);
			if (key == null) continue;
			const isFn =
				prop.type === "ObjectMethod" ||
				(prop.type === "ObjectProperty" && prop.value?.type === "FunctionExpression");
			if (!isFn) continue;
			out.push({ owner: block.owner, key, line: prop.loc?.start?.line ?? block.line, block, prop });
		}
	}
	return out;
}
