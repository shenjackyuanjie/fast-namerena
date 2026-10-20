export function parseArgs(argv: string[]): Record<string, string | boolean> {
	const out: Record<string, string | boolean> = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg.startsWith("--")) continue;
		const key = arg.slice(2);
		const next = argv[i + 1];
		if (next === undefined || next.startsWith("--")) {
			out[key] = true;
		} else {
			out[key] = next;
			i += 1;
		}
	}
	return out;
}

export function requiredArg(
	args: Record<string, string | boolean>,
	name: string,
): string {
	const value = args[name];
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`缺少参数 --${name}`);
	}
	return value;
}
