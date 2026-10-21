import { parseScript } from "./ast";

export interface StringChange {
	from: string;
	to: string;
}

interface TokenLike {
	label: string;
	value: unknown;
	start: number;
}

function tokensOf(source: string): TokenLike[] {
	const ast = parseScript(source, { tokens: true });
	return (ast.tokens as any[]).map((token) => ({
		label: token.type.label,
		value: token.value,
		start: token.start,
	}));
}

function sameTokenValue(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a && b && typeof a === "object" && typeof b === "object") {
		return JSON.stringify(a) === JSON.stringify(b);
	}
	return false;
}

/**
 * 结构不变量：除 Identifier 名称与白名单字符串外，token 序列必须完全一致。
 * 重命名只允许改名字，不允许增删语句、字面量或运算符。
 */
export function assertTokenShape(
	before: string,
	after: string,
	allowedStrings: StringChange[],
	label: string,
): void {
	const oldTokens = tokensOf(before);
	const newTokens = tokensOf(after);
	if (oldTokens.length !== newTokens.length) {
		throw new Error(
			`${label}: token 数变化 ${oldTokens.length} -> ${newTokens.length}`,
		);
	}
	const allowed = new Set(allowedStrings.map((s) => `${s.from}\u0000${s.to}`));
	for (let i = 0; i < oldTokens.length; i++) {
		const oldToken = oldTokens[i];
		const newToken = newTokens[i];
		if (oldToken.label !== newToken.label) {
			throw new Error(
				`${label}: 第 ${i} 个 token 类型变化 ${oldToken.label} -> ${newToken.label}`,
			);
		}
		if (oldToken.label === "name") continue;
		if (oldToken.label === "string" || oldToken.label === "template") {
			if (oldToken.value === newToken.value) continue;
			const pair = `${oldToken.value}\u0000${newToken.value}`;
			if (allowed.has(pair)) continue;
			throw new Error(
				`${label}: 第 ${i} 个字符串非白名单变化 ${JSON.stringify(oldToken.value)} -> ${JSON.stringify(newToken.value)}`,
			);
		}
		if (!sameTokenValue(oldToken.value, newToken.value)) {
			throw new Error(
				`${label}: 第 ${i} 个 token 值变化 ${JSON.stringify(oldToken.value)} -> ${JSON.stringify(newToken.value)}`,
			);
		}
	}
}

export function assertSameLineCount(before: string, after: string, label: string): void {
	const oldLines = before.split("\n").length;
	const newLines = after.split("\n").length;
	if (oldLines !== newLines) {
		throw new Error(`${label}: 行数变化 ${oldLines} -> ${newLines}`);
	}
}
