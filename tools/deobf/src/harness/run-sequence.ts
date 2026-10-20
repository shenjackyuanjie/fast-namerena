import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import { CORPUS } from "./corpus";
import { parseArgs, requiredArg } from "../lib/args";
import { ensureDir } from "../lib/files";

interface OpResult {
	id: string;
	kind: string;
	value: unknown;
	console: string[];
}

const req = createRequire(import.meta.url);

async function run(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const candidate = requiredArg(args, "candidate");
	const out = requiredArg(args, "out");
	const verbose = args.verbose === true;
	const note = (message: string) => {
		if (verbose) process.stderr.write(`${message}\n`);
	};
	note(`candidate=${candidate}`);
	note(`out=${out}`);

	const logs: string[] = [];
	const original = {
		log: console.log,
		warn: console.warn,
		error: console.error,
	};
	const capture = (...items: unknown[]) => {
		logs.push(items.map((item) => String(item)).join(" "));
	};
	console.log = capture;
	console.warn = capture;
	console.error = capture;

	let module: any;
	try {
		module = req(candidate);
	} finally {
		// 模块加载期的输出也记录，但恢复 console 以便崩溃时还能看到错误
		console.log = original.log;
		console.warn = original.warn;
		console.error = original.error;
	}
	const loadConsole = logs.slice();
	note(`loaded version=${module?.version}`);

	const opTimeout = Number(args["op-timeout"] ?? 30_000);
	const withTimeout = <T>(promise: Promise<T>, id: string): Promise<T> =>
		new Promise<T>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error(`操作超时 (${opTimeout}ms): ${id}`)),
				opTimeout,
			);
			promise.then(
				(value) => {
					clearTimeout(timer);
					resolve(value);
				},
				(error) => {
					clearTimeout(timer);
					reject(error);
				},
			);
		});

	const results: OpResult[] = [];
	for (const op of CORPUS.ops) {
		const before = logs.length;
		note(`start ${op.id}`);
		let value: unknown;
		switch (op.kind) {
			case "fight":
				value = await withTimeout(module.fight(op.input), op.id);
				break;
			case "fight_log":
				value = await withTimeout(module.fight_log(op.input), op.id);
				break;
			case "win_rate":
				value = await withTimeout(module.win_rate(op.input, op.round), op.id);
				break;
			case "score":
				value = await withTimeout(module.score(op.input, op.round), op.id);
				break;
		}
		note(`done ${op.id}`);
		results.push({
			id: op.id,
			kind: op.kind,
			value,
			console: logs.slice(before),
		});
	}

	note(`writing ${out}`);
	ensureDir(path.dirname(out));
	fs.writeFileSync(
		out,
		`${JSON.stringify(
			{
				version: module.version,
				run_env: {
					from_code: module.run_env?.from_code,
					is_node: module.run_env?.is_node,
					is_bun: module.run_env?.is_bun,
				},
				load_console: loadConsole,
				results,
			},
			null,
			2,
		)}\n`,
		"utf-8",
	);

	// 显式退出，避免 runner 内部残留的 EventEmitter/定时器拖住进程
	process.exit(0);
}

run().catch((error) => {
	console.error(error);
	process.exit(1);
});
