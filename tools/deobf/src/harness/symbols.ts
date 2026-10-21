import * as fs from "node:fs";
import * as path from "node:path";
import { lineOf, parseScript } from "../lib/ast";
import { collectMethodDefinitions } from "../lib/invariants";
import { LATEST_DIR, REPORT_DIR, ensureDir, readJson, sha256File, writeJson } from "../lib/files";
import { MEMBER_RENAMES, UNRESOLVED_MEMBERS } from "../data/rename-members";
import { PARAM_RENAMES } from "../data/rename-params";

interface MemberReportEntry {
	old: string;
	new: string;
	status: string;
	reason?: string;
	prototypeKeys: number;
	memberAccesses: number;
	computedAccesses: number;
	registryStrings: number;
}

interface ParamReportEntry {
	owner: string;
	method: string;
	line: number;
	index: number;
	old: string;
	new: string;
	status: string;
	reason?: string;
}

function main(): void {
	const candidate = process.argv[2]
		? path.resolve(process.argv[2])
		: path.join(LATEST_DIR, "md5.stage3.js");
	const source = fs.readFileSync(candidate, "utf-8");
	const ast = parseScript(source);
	const definitions = collectMethodDefinitions(ast);
	const version = source.match(/const _version_ = "([^"]+)"/)?.[1] ?? "unknown";

	const memberReport = readJson<any>(path.join(REPORT_DIR, "rename-report.json"));
	const paramReport = readJson<any>(path.join(REPORT_DIR, "rename-params.json"));
	const unmatched = readJson<any>(path.join(REPORT_DIR, "param-unmatched.json")).methods as Array<{
		owner: string;
		method: string;
		arity: number;
		reason: string;
	}>;

	const defsByOwnerKey = new Map<string, number[]>();
	for (const def of definitions) {
		const list = defsByOwnerKey.get(`${def.owner}#${def.key}`) ?? [];
		list.push(lineOf(def.prop));
		defsByOwnerKey.set(`${def.owner}#${def.key}`, list);
	}

	const batchEntries: MemberReportEntry[] = [];
	for (const batch of Object.values<any>(memberReport.batches ?? {})) {
		batchEntries.push(...(batch.entries as MemberReportEntry[]));
	}

	const members = MEMBER_RENAMES.map((entry) => {
		const stats = batchEntries.find((r) => r.old === entry.old && r.new === entry.new);
		return {
			old: entry.old,
			new: entry.new,
			batch: entry.batch,
			status: stats?.status ?? "unknown",
			reason: stats?.reason,
			definitions: entry.owners
				.map((owner) => ({ owner, lines: defsByOwnerKey.get(`${owner}#${entry.new}`) ?? [] }))
				.filter((item) => item.lines.length > 0),
			accesses: stats?.memberAccesses ?? 0,
			computedAccesses: stats?.computedAccesses ?? 0,
			registryStrings: stats?.registryStrings ?? 0,
		};
	});

	const paramReports = (paramReport.params ?? []) as ParamReportEntry[];
	const params = PARAM_RENAMES.map((entry) => {
		const reports = paramReports.filter((r) => r.owner === entry.owner && r.method === entry.method);
		const lines = defsByOwnerKey.get(`${entry.owner}#${entry.method}`) ?? [];
		return {
			owner: entry.owner,
			method: entry.method,
			line: lines[0] ?? reports[0]?.line ?? 0,
			evidence: entry.evidence,
			params: entry.params.map((dartName, index) => {
				const report = reports.find((r) => r.index === index);
				return {
					index,
					old: report?.old ?? "",
					new: dartName,
					status: report?.status ?? "unknown",
					reason: report?.reason,
				};
			}),
		};
	});

	const unresolvedParams = paramReports
		.filter((r) => r.status === "skipped" && r.reason && r.reason !== "与 Dart 参数名一致")
		.map((r) => ({ owner: r.owner, method: r.method, line: r.line, index: r.index, old: r.old, new: r.new, reason: r.reason }));

	const symbols = {
		source: path.basename(candidate),
		sha256: sha256File(candidate),
		version,
		lines: source.replace(/\n$/, "").split("\n").length,
		members,
		params,
		unresolved: {
			members: UNRESOLVED_MEMBERS,
			params: unresolvedParams,
			unmatchedMethods: unmatched,
		},
	};

	const jsonPath = path.join(path.dirname(candidate), "md5.symbols.json");
	writeJson(jsonPath, symbols);

	const applied = members.filter((m) => m.status === "applied");
	const md: string[] = [];
	md.push(`# md5 ${version} 符号映射`);
	md.push("");
	md.push(`由 \`tools/deobf/src/harness/symbols.ts\` 从 \`${path.basename(candidate)}\` 生成。`);
	md.push("");
	md.push(
		`- 行数：${symbols.lines}；成员映射 ${applied.length} 条；参数映射 ${params.length} 个方法；` +
			`未解析成员 ${UNRESOLVED_MEMBERS.length} 条、参数 ${unresolvedParams.length} 处、方法签名 ${unmatched.length} 个。`,
	);
	md.push("");
	md.push("## 成员方法");
	md.push("");
	for (const member of members.sort((a, b) => a.new.localeCompare(b.new))) {
		if (member.status === "skipped") {
			md.push(`- \`${member.old}\` → \`${member.new}\`（批次 ${member.batch}，跳过：${member.reason ?? "未知原因"}）`);
			continue;
		}
		const owners = member.definitions.map((d) => d.owner).join(", ");
		md.push(
			`- \`${member.old}\` → \`${member.new}\`（批次 ${member.batch}；访问 ${member.accesses} 次` +
				`${member.registryStrings > 0 ? `，注册表 ${member.registryStrings} 处` : ""}）`,
		);
		if (owners) md.push(`  - ${owners}`);
	}
	md.push("");
	md.push("## 参数");
	md.push("");
	const byOwner = new Map<string, typeof params>();
	for (const entry of params) {
		const list = byOwner.get(entry.owner) ?? [];
		list.push(entry);
		byOwner.set(entry.owner, list);
	}
	for (const owner of [...byOwner.keys()].sort()) {
		md.push(`### ${owner}`);
		md.push("");
		for (const entry of byOwner.get(owner)!) {
			const parts = entry.params
				.filter((p) => p.status === "applied")
				.map((p) => `${p.old}→${p.new}`);
			if (parts.length === 0) continue;
			md.push(`- ${entry.method}（${entry.evidence}）：${parts.join(", ")}`);
		}
		md.push("");
	}
	md.push("## 未解析");
	md.push("");
	md.push("见 `tools/deobf/report/rename-unresolved.md`。");
	md.push("");
	fs.writeFileSync(path.join(path.dirname(candidate), "md5.symbols.md"), md.join("\n"), "utf-8");

	const unresolvedMd: string[] = [];
	unresolvedMd.push("# md5 重命名未解析清单");
	unresolvedMd.push("");
	unresolvedMd.push("## 成员方法");
	unresolvedMd.push("");
	for (const entry of UNRESOLVED_MEMBERS) {
		unresolvedMd.push(`- \`${entry.old}\`（${entry.owners.join(", ")}）：${entry.reason}`);
	}
	unresolvedMd.push("");
	unresolvedMd.push("## 参数（函数内已有同名标识符等）");
	unresolvedMd.push("");
	const byParamMethod = new Map<string, typeof unresolvedParams>();
	for (const entry of unresolvedParams) {
		const key = `${entry.owner}.${entry.method}`;
		const list = byParamMethod.get(key) ?? [];
		list.push(entry);
		byParamMethod.set(key, list);
	}
	for (const key of [...byParamMethod.keys()].sort()) {
		const entries = byParamMethod.get(key)!;
		const parts = entries.map((e) => `#${e.index} \`${e.old}\`→\`${e.new}\`：${e.reason}`);
		unresolvedMd.push(`- ${key}：${parts.join("；")}`);
	}
	unresolvedMd.push("");
	unresolvedMd.push("## 方法签名不可用（保留原参数名）");
	unresolvedMd.push("");
	for (const entry of unmatched) {
		unresolvedMd.push(`- ${entry.owner}.${entry.method}（${entry.arity} 个参数）：${entry.reason}`);
	}
	unresolvedMd.push("");
	ensureDir(REPORT_DIR);
	fs.writeFileSync(path.join(REPORT_DIR, "rename-unresolved.md"), unresolvedMd.join("\n"), "utf-8");

	console.log(
		`符号表：${members.length} 个成员（应用 ${applied.length}），${params.length} 个方法的参数；` +
			`未解析：成员 ${UNRESOLVED_MEMBERS.length}，参数 ${unresolvedParams.length}，方法 ${unmatched.length}`,
	);
	console.log(`写入 ${jsonPath}`);
}

main();
