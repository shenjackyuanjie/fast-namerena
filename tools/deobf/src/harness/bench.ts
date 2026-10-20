import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs, requiredArg } from "../lib/args";
import { REPORT_DIR, ensureDir } from "../lib/files";

interface Sample {
	version: string;
	loadMs: number;
	fightMs: number;
	fightRounds: number;
	winRateMs: number;
	scoreMs: number;
	totalMs: number;
}

const BENCH_CHILD = path.join(import.meta.dir, "bench-child.ts");

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[mid - 1] + sorted[mid]) / 2
		: sorted[mid];
}

function runOnce(candidate: string): { sample: Sample; wallMs: number } {
	const start = performance.now();
	const proc = spawnSync(
		process.execPath,
		[BENCH_CHILD, "--candidate", path.resolve(candidate)],
		{ encoding: "utf-8", timeout: 300_000, maxBuffer: 4 * 1024 * 1024 },
	);
	const wallMs = performance.now() - start;
	if (proc.status !== 0) {
		throw new Error(`bench 子进程失败\nstdout:\n${proc.stdout}\nstderr:\n${proc.stderr}`);
	}
	const line = proc.stdout.trim().split("\n").at(-1);
	if (!line) throw new Error("bench 子进程没有输出");
	return { sample: JSON.parse(line) as Sample, wallMs };
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const candidate = requiredArg(args, "candidate");
	const runs = Number(args.runs ?? 5);
	const label = typeof args.label === "string" ? args.label : path.basename(candidate);

	const samples: Sample[] = [];
	const walls: number[] = [];
	for (let i = 0; i < runs; i++) {
		const { sample, wallMs } = runOnce(candidate);
		samples.push(sample);
		walls.push(wallMs);
	}

	const summary = {
		label,
		candidate: path.resolve(candidate),
		version: samples[0].version,
		runs,
		runtime: process.versions,
		median: {
			wallMs: median(walls),
			loadMs: median(samples.map((s) => s.loadMs)),
			fightMs: median(samples.map((s) => s.fightMs)),
			fightRounds: samples[0].fightRounds,
			winRateMs: median(samples.map((s) => s.winRateMs)),
			scoreMs: median(samples.map((s) => s.scoreMs)),
			totalMs: median(samples.map((s) => s.totalMs)),
		},
		samples,
		created_at: new Date().toISOString(),
	};

	console.log(`基准: ${label}`);
	console.log(`  wall       ${summary.median.wallMs.toFixed(1)} ms`);
	console.log(`  load       ${summary.median.loadMs.toFixed(1)} ms`);
	console.log(`  fight x${summary.median.fightRounds}  ${summary.median.fightMs.toFixed(1)} ms`);
	console.log(`  win_rate   ${summary.median.winRateMs.toFixed(1)} ms`);
	console.log(`  score      ${summary.median.scoreMs.toFixed(1)} ms`);
	console.log(`  total      ${summary.median.totalMs.toFixed(1)} ms`);

	if (typeof args.report === "string") {
		const file = path.resolve(args.report);
		ensureDir(path.dirname(file));
		fs.writeFileSync(`${file}`, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
		console.log(`  写入 ${file}`);
	} else if (args.json) {
		process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
	}
}

main();
