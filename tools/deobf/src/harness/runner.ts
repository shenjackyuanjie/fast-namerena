import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { ensureDir, readJson, TMP_DIR } from "../lib/files";

export interface CandidateResult {
	version: string;
	run_env: {
		from_code: boolean;
		is_node: boolean;
		is_bun: boolean;
	};
	load_console: string[];
	results: Array<{
		id: string;
		kind: string;
		value: unknown;
		console: string[];
	}>;
}

const RUN_SEQUENCE = path.join(import.meta.dir, "run-sequence.ts");

export function runCandidate(candidate: string, timeoutMs = 180_000): CandidateResult {
	const absolute = path.resolve(candidate);
	if (!fs.existsSync(absolute)) {
		throw new Error(`候选文件不存在: ${absolute}`);
	}
	ensureDir(TMP_DIR);
	const out = path.join(
		TMP_DIR,
		`sequence-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
	);
	const proc = spawnSync(
		process.execPath,
		[RUN_SEQUENCE, "--candidate", absolute, "--out", out],
		{
			encoding: "utf-8",
			timeout: timeoutMs,
			maxBuffer: 16 * 1024 * 1024,
		},
	);
	if (proc.status !== 0) {
		if (proc.error) throw proc.error;
		throw new Error(
			`候选执行失败 (${absolute})\nstdout:\n${proc.stdout}\nstderr:\n${proc.stderr}`,
		);
	}
	if (!fs.existsSync(out)) {
		throw new Error(`候选未产出结果文件 (${absolute})\nstderr:\n${proc.stderr}`);
	}
	const data = readJson<CandidateResult>(out);
	fs.unlinkSync(out);
	return data;
}
