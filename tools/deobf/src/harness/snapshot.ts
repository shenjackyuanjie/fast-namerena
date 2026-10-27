import * as path from "node:path";
import { CORPUS } from "./corpus";
import { runCandidate } from "./runner";
import { parseArgs, requiredArg } from "../lib/args";
import { ensureDir, GOLDEN_DIR, sha256File, writeJson } from "../lib/files";

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const candidate = requiredArg(args, "candidate");
	const outDir =
		typeof args.golden === "string"
			? path.resolve(args.golden)
			: path.join(GOLDEN_DIR, "v0.5.5");

	const result = runCandidate(candidate);
	const sequenceFile = path.join(outDir, "sequence.json");
	const metaFile = path.join(outDir, "meta.json");

	ensureDir(outDir);
	writeJson(sequenceFile, result);
	writeJson(metaFile, {
		corpus: CORPUS.name,
		version: result.version,
		source: path.resolve(candidate),
		sha256: sha256File(candidate),
		runtime: {
			execPath: process.execPath,
			versions: process.versions,
		},
		created_at: new Date().toISOString(),
	});

	const elapsed = result.results
		.map((r) => {
			const value = r.value as any;
			if (r.kind === "fight") return `${r.id}: winner=${value?.source_plr}`;
			if (r.kind === "fight_log") return `${r.id}: winner=${value?.winner?.source_plr}`;
			if (r.kind === "win_rate") return `${r.id}: win=${value?.win_count}`;
			if (r.kind === "score") return `${r.id}: score=${value?.score}`;
			return r.id;
		})
		.join("\n  ");
	console.log(`已写入 ${sequenceFile}`);
	console.log(`  ${elapsed}`);
}

main();
