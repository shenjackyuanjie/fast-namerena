import { createRequire } from "node:module";
import { parseArgs, requiredArg } from "../lib/args";

const req = createRequire(import.meta.url);

const FIGHT_INPUT = "bench-alpha\nbench-beta\nbench-gamma";
const WIN_RATE_INPUT = `!test!

http://shenjack.top:81/md5/branch/latest/

http://shenjack.top:81/md5`;
const SCORE_INPUT = `!test!

http://shenjack.top:81/md5/branch/latest/`;

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const candidate = requiredArg(args, "candidate");
	const fightRounds = Number(args["fight-rounds"] ?? 200);

	const loadStart = performance.now();
	const module = req(candidate);
	const loadMs = performance.now() - loadStart;

	const fightStart = performance.now();
	for (let i = 0; i < fightRounds; i++) {
		await module.fight(FIGHT_INPUT);
	}
	const fightMs = performance.now() - fightStart;

	const winStart = performance.now();
	await module.win_rate(WIN_RATE_INPUT, 1000);
	const winRateMs = performance.now() - winStart;

	const scoreStart = performance.now();
	await module.score(SCORE_INPUT, 10000);
	const scoreMs = performance.now() - scoreStart;

	process.stdout.write(
		`${JSON.stringify({
			version: module.version,
			loadMs,
			fightMs,
			fightRounds,
			winRateMs,
			scoreMs,
			totalMs: loadMs + fightMs + winRateMs + scoreMs,
		})}\n`,
	);
	process.exit(0);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
