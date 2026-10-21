import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverseFn: any = (traverseModule as any).default ?? traverseModule;

export interface ParseOptions {
	tokens?: boolean;
}

export function parseScript(source: string, options: ParseOptions = {}): any {
	return parse(source, {
		sourceType: "script",
		allowReturnOutsideFunction: true,
		errorRecovery: true,
		tokens: options.tokens ?? false,
		plugins: [],
	} as any);
}

export function lineOf(node: any): number {
	return node?.loc?.start?.line ?? 0;
}

export function propertyName(node: any): string | null {
	const key = node?.key;
	if (!key || node.computed) return null;
	if (key.type === "Identifier") return key.name;
	if (key.type === "StringLiteral") return key.value;
	return null;
}

/** 把 `T.Plr.prototype` 之类的对象表达式转成稳定的 owner 名 */
export function memberOwner(node: any): string {
	if (!node) return "?";
	if (node.type === "Identifier") return node.name;
	if (node.type === "MemberExpression") {
		const prop = node.computed
			? node.property?.type === "StringLiteral"
				? node.property.value
				: null
			: node.property?.type === "Identifier"
				? node.property.name
				: null;
		if (prop == null) return "?";
		const base = memberOwner(node.object);
		return base === "?" ? prop : `${base}.${prop}`;
	}
	if (node.type === "AssignmentExpression") return memberOwner(node.right);
	return "?";
}

export interface PrototypeBlock {
	owner: string;
	line: number;
	start: number;
	end: number;
	node: any;
	keys: Map<string, any>;
}

/** 收集所有 `X.prototype = { ... }` 块 */
export function collectPrototypeBlocks(ast: any): PrototypeBlock[] {
	const blocks: PrototypeBlock[] = [];
	traverseAst(ast, {
		AssignmentExpression(path: any) {
			const left = path.node.left;
			if (left.type !== "MemberExpression" || left.computed) return;
			if (left.property.type !== "Identifier" || left.property.name !== "prototype") return;
			if (path.node.right.type !== "ObjectExpression") return;
			const owner = memberOwner(left.object);
			const keys = new Map<string, any>();
			for (const prop of path.node.right.properties) {
				const name = propertyName(prop);
				if (name != null) keys.set(name, prop);
			}
			blocks.push({
				owner,
				line: lineOf(path.node),
				start: path.node.start,
				end: path.node.end,
				node: path.node,
				keys,
			});
		},
	});
	return blocks;
}

export function isFunctionProperty(node: any): boolean {
	if (node.type === "ObjectMethod") return true;
	return node.type === "ObjectProperty" && node.value?.type === "FunctionExpression";
}

export function traverseAst(
	ast: any,
	visitors: Record<string, (path: any) => void>,
): void {
	traverseFn(ast, visitors);
}
