const md5_module = require("./md5.js");
import * as fs from "fs";
import * as process from "process";

const TURN_SPLITTER = "__FIGHT_LOG_TURN_SPLITTER__";

function sanitize_output_line(line: string): string {
	return line
		.normalize("NFKC")
		.replace(/[\p{Cc}\p{Cf}]/gu, "")
		.replace(/[\p{Z}\s]+/gu, " ")
		.trim();
}

function is_action_line(line: string): boolean {
	return (
		line.includes("发起攻击") ||
		(line.includes("使用") && !line.includes("护身符抵挡了一次死亡")) ||
		line.includes("做出垂死抗争") ||
		line.includes("连击") ||
		line.includes("从疾走中解除")
	);
}

async function read_input_text(args: string[]): Promise<string> {
	if (args.length > 0) {
		const file_path = args[0];
		if (!fs.existsSync(file_path)) {
			throw new Error(`文件 ${file_path} 不存在`);
		}
		return fs.readFileSync(file_path, "utf-8");
	}

	if (typeof Bun !== "undefined") {
		return await Bun.stdin.text();
	}

	return fs.readFileSync(0, "utf-8");
}

function normalize_input_text(text: string): string {
	let normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	// 兼容 PowerShell: "aaaa\nbbbb" 会把 \n 当作普通字符传入
	normalized = normalized
		.replace(/\\r\\n/g, "\n")
		.replace(/\\n/g, "\n")
		.replace(/\\r/g, "\n");
	return normalized.trim();
}

async function main() {
	const args = process.argv.slice(2);
	const input_text = normalize_input_text(await read_input_text(args));

	if (input_text.length === 0) {
		throw new Error("输入为空");
	}

	const result = await md5_module.fight_log(input_text);
	const logs: string[] = Array.isArray(result?.updates) ? result.updates : [];
	const output_lines: string[] = [];
	let pending_action_line = "";
	let pending_misc_lines: string[] = [];

	const emit_current_turn = () => {
		if (pending_action_line.length > 0) {
			output_lines.push(pending_action_line);
			output_lines.push("");
			pending_action_line = "";
			pending_misc_lines = [];
			return;
		}
		if (pending_misc_lines.length > 0) {
			output_lines.push(pending_misc_lines.join(", "));
			output_lines.push("");
			pending_misc_lines = [];
		}
	};

	for (const raw_line of logs) {
		const line = sanitize_output_line(String(raw_line));
		if (line === TURN_SPLITTER) {
			emit_current_turn();
			continue;
		}
		if (line.length === 0) {
			continue;
		}

		if (is_action_line(line)) {
			emit_current_turn();
			pending_action_line = line;
			continue;
		}

		if (pending_action_line.length > 0) {
			pending_action_line += `, ${line}`;
		} else {
			pending_misc_lines.push(line);
		}
	}
	emit_current_turn();

	while (output_lines.length > 0 && output_lines[output_lines.length - 1] === "") {
		output_lines.pop();
	}

	console.log(output_lines.join("\n"));
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
