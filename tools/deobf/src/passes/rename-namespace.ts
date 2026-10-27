import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "../lib/args";
import { lineOf, parseScript, traverseAst } from "../lib/ast";
import { applyEdits, type Edit } from "../lib/edits";
import { assertSameLineCount, assertTokenShape, type StringChange } from "../lib/tokens";
import { NAMESPACE_RENAMES } from "../data/rename-namespace";
import { LATEST_DIR, REPORT_DIR, ensureDir, sha256File, writeJson } from "../lib/files";

const REGISTER_FUNCTIONS = new Set(["lazy", "lazy_old", "lazy_final"]);

interface Registration {
	slot: string;
	getter: string;
	getterStart: number;
	getterEnd: number;
	line: number;
}

interface MemberRef {
	name: string;
	start: number;
	end: number;
	computed: boolean;
	line: number;
}

interface EntryReport {
	old: string;
	new: string;
	kind: "lazy" | "field";
	dart: string;
	status: "applied" | "skipped";
	reason?: string;
	memberRefs: number;
	computedRefs: number;
	registrationLine?: number;
}

function collectRegistrations(ast: any): Registration[] {
	const result: Registration[] = [];
	traverseAst(ast, {
		CallExpression(path: any) {
			const node = path.node;
			const callee = node.callee;
			const name = callee.type === "Identifier" ? callee.name : null;
			if (!name || !REGISTER_FUNCTIONS.has(name)) return;
			const [holder, slot, getter] = node.arguments;
			if (holder?.type !== "Identifier" || holder.name !== "$") return;
			if (slot?.type !== "StringLiteral" || getter?.type !== "StringLiteral") return;
			result.push({
				slot: slot.value,
				getter: getter.value,
				getterStart: getter.start,
				getterEnd: getter.end,
				line: lineOf(getter),
			});
		},
	});
	return result;
}

function pushMemberRef(refs: MemberRef[], node: any): void {
	if (node.object.type !== "Identifier" || node.object.name !== "$") return;
	if (!node.computed && node.property.type === "Identifier") {
		refs.push({
			name: node.property.name,
			start: node.property.start,
			end: node.property.end,
			computed: false,
			line: lineOf(node),
		});
		return;
	}
	if (node.computed && node.property.type === "StringLiteral") {
		refs.push({
			name: node.property.value,
			start: node.property.start,
			end: node.property.end,
			computed: true,
			line: lineOf(node),
		});
	}
}

function collectMemberRefs(ast: any): MemberRef[] {
	const refs: MemberRef[] = [];
	traverseAst(ast, {
		MemberExpression(path: any) {
			pushMemberRef(refs, path.node);
		},
		OptionalMemberExpression(path: any) {
			pushMemberRef(refs, path.node);
		},
	});
	return refs;
}

/** 字符串出现位置；模板元素无法安全改写，一并视作字符串引用 */
function collectStringRefs(ast: any): Map<string, number[]> {
	const result = new Map<string, number[]>();
	const add = (value: string, start: number) => {
		const list = result.get(value) ?? [];
		list.push(start);
		result.set(value, list);
	};
	traverseAst(ast, {
		StringLiteral(path: any) {
			add(path.node.value, path.node.start);
		},
		TemplateElement(path: any) {
			const value = path.node.value?.cooked ?? path.node.value?.raw;
			if (typeof value === "string") add(value, path.node.start);
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
			: path.join(LATEST_DIR, `md5.ns-batch${batch}.js`);

	const source = fs.readFileSync(input, "utf-8");
	const ast = parseScript(source);
	const registrations = collectRegistrations(ast);
	const memberRefs = collectMemberRefs(ast);
	const stringRefs = collectStringRefs(ast);

	const selected = NAMESPACE_RENAMES.filter((entry) => entry.batch === batch);
	const limit = typeof args.limit === "string" ? Number(args.limit) : selected.length;
	const chosen = selected.slice(0, Math.max(0, limit));

	const refsByName = new Map<string, MemberRef[]>();
	for (const ref of memberRefs) {
		const list = refsByName.get(ref.name) ?? [];
		list.push(ref);
		refsByName.set(ref.name, list);
	}
	const computedStarts = new Set(memberRefs.filter((r) => r.computed).map((r) => r.start));

	const existingNames = new Set<string>(refsByName.keys());
	for (const reg of registrations) {
		existingNames.add(reg.slot);
		existingNames.add(reg.getter);
	}

	const reports: EntryReport[] = [];
	const active: { entry: (typeof chosen)[number]; reg?: Registration; refs: MemberRef[] }[] = [];
	const usedTargets = new Set<string>();

	for (const entry of chosen) {
		const refs = refsByName.get(entry.old) ?? [];
		const report: EntryReport = {
			old: entry.old,
			new: entry.new,
			kind: entry.kind,
			dart: entry.dart,
			status: "applied",
			memberRefs: refs.length,
			computedRefs: refs.filter((r) => r.computed).length,
		};
		reports.push(report);

		const skip = (reason: string) => {
			report.status = "skipped";
			report.reason = reason;
		};

		if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(entry.new)) {
			skip(`目标名不是合法标识符：${entry.new}`);
			continue;
		}
		if (usedTargets.has(entry.new)) {
			skip(`目标名 ${entry.new} 与同一批次其它映射重复`);
			continue;
		}
		if (existingNames.has(entry.new)) {
			skip(`目标名 ${entry.new} 已存在于 \$ 命名空间`);
			continue;
		}
		if (refs.length === 0) {
			skip(`没有 $.${entry.old} 成员访问`);
			continue;
		}

		let reg: Registration | undefined;
		if (entry.kind === "lazy") {
			const matches = registrations.filter((r) => r.getter === entry.old);
			if (matches.length !== 1) {
				skip(`lazy 注册数量为 ${matches.length}，期望 1`);
				continue;
			}
			reg = matches[0];
			report.registrationLine = reg.line;
		} else if (registrations.some((r) => r.getter === entry.old)) {
			skip(`$.${entry.old} 是 lazy getter，不能按字段重命名`);
			continue;
		}

		const allowedStringPositions = new Set<number>();
		if (reg) allowedStringPositions.add(reg.getterStart);
		for (const ref of refs) if (ref.computed) allowedStringPositions.add(ref.start);
		const stray = (stringRefs.get(entry.old) ?? []).filter((start) => !allowedStringPositions.has(start));
		if (stray.length > 0) {
			skip(`存在 ${stray.length} 处非成员访问的字符串引用`);
			continue;
		}

		usedTargets.add(entry.new);
		existingNames.add(entry.new);
		active.push({ entry, reg, refs });
	}

	const edits: Edit[] = [];
	const stringChanges: StringChange[] = [];
	for (const { entry, reg, refs } of active) {
		for (const ref of refs) {
			edits.push({
				start: ref.start,
				end: ref.end,
				text: ref.computed ? JSON.stringify(entry.new) : entry.new,
				label: `$.${entry.old} -> $.${entry.new}@${ref.line}`,
			});
			if (ref.computed) stringChanges.push({ from: entry.old, to: entry.new });
		}
		if (reg) {
			edits.push({
				start: reg.getterStart,
				end: reg.getterEnd,
				text: JSON.stringify(entry.new),
				label: `lazy 注册 ${entry.old} -> ${entry.new}@${reg.line}`,
			});
			stringChanges.push({ from: entry.old, to: entry.new });
		}
	}

	if (edits.length === 0) {
		console.log("没有可应用的命名空间重命名");
		return;
	}

	const result = applyEdits(source, edits);
	assertSameLineCount(source, result, `rename-namespace batch ${batch}`);
	assertTokenShape(source, result, stringChanges, `rename-namespace batch ${batch}`);

	const outAst = parseScript(result);
	const outRefs = collectMemberRefs(outAst);
	const outRegs = collectRegistrations(outAst);
	const outStrings = collectStringRefs(outAst);
	for (const { entry, refs } of active) {
		if (outRefs.some((r) => r.name === entry.old)) {
			throw new Error(`重命名后仍存在 $.${entry.old} 访问`);
		}
		const actual = outRefs.filter((r) => r.name === entry.new).length;
		if (actual !== refs.length) {
			throw new Error(`$.${entry.new} 数量不一致：${refs.length} -> ${actual}`);
		}
		if (entry.kind === "lazy") {
			if (outRegs.some((r) => r.getter === entry.old)) {
				throw new Error(`重命名后仍存在 lazy 注册 ${entry.old}`);
			}
			if (outRegs.filter((r) => r.getter === entry.new).length !== 1) {
				throw new Error(`$.${entry.new} 的 lazy 注册数量不是 1`);
			}
		}
		if (outStrings.has(entry.old)) {
			throw new Error(`重命名后仍存在字符串 ${entry.old}`);
		}
	}

	fs.writeFileSync(output, result, "utf-8");

	ensureDir(REPORT_DIR);
	const reportPath = path.join(REPORT_DIR, "rename-namespace-report.json");
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
	const refs = applied.reduce((acc, r) => acc + r.memberRefs, 0);
	console.log(
		`批次 ${batch}: 应用 ${applied.length} 条，跳过 ${skipped.length} 条；成员访问 ${refs} 处`,
	);
	console.log(`${Buffer.byteLength(source)} -> ${Buffer.byteLength(result)} 字节，${path.relative(process.cwd(), output)}`);
	for (const r of skipped) console.log(`跳过 ${r.old}: ${r.reason}`);
}

if (import.meta.main) {
	main();
}
