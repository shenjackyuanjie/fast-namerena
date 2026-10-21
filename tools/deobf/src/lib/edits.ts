import MagicString from "magic-string";

export interface Edit {
	start: number;
	end: number;
	text: string;
	label: string;
}

export function applyEdits(source: string, edits: Edit[]): string {
	const ms = new MagicString(source);
	const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
	let lastStart = Number.POSITIVE_INFINITY;
	for (const edit of sorted) {
		if (edit.end > lastStart) {
			throw new Error(`编辑区间重叠：${edit.label} (${edit.start}-${edit.end})`);
		}
		lastStart = edit.start;
		if (edit.text === "") ms.remove(edit.start, edit.end);
		else ms.overwrite(edit.start, edit.end, edit.text);
	}
	return ms.toString();
}

export function identifierEdit(node: any, name: string, label: string): Edit {
	if (node.type !== "Identifier") throw new Error(`不是标识符：${node.type}`);
	return { start: node.start, end: node.end, text: name, label };
}
