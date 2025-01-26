const md5_module = require("./md5.js");

/**
 * 对战结果的数据结构
 * 其实只有 source_plr 是有用的, 是赢家之一
 */
type FightResult = {
	message: string;
	source_plr: string;
	target_plr: string;
	affect: string | number;
};

/**
 * 每一行具体的胜率结果
 */
type WinRate = {
	round: number;
	win_count: number;
};

/**
 * 胜率的数据结构
 */
type WinRateResult = {
	win_count: number;
	raw_data: WinRate[];
};

/**
 * 用于接收胜率的回调函数
 * 返回一个 bool, true 表示继续, false 表示停止
 */
type WinRateCallback = (run_round: number, win_count: number) => boolean;

/**
 * 分数的数据结构
 */
type Score = {
	round: number;
	score: number;
};

/**
 * 分数的数据结构
 */
type ScoreResult = {
	score: number;
	raw_data: Score[];
};

/**
 * 用于接收分数的回调函数
 * 返回一个 bool, true 表示继续, false 表示停止
 */
type ScoreCallback = (run_round: number, score: number) => boolean;

/**
 * 对于胜率/评分的输入检查
 * @param names
 * @returns
 */
function test_check(names: string): boolean {
	const have_test = names.trim().startsWith("!test!");

	return have_test;
}

/**
 *
 * @param names 原始的输入框输入
 * @returns 对战结果
 */
async function fight(names: string): Promise<FightResult> {
	// 检查一下输入是否合法
	if (test_check(names)) {
		throw new Error(`怎么能在对战里有 !test!(恼)\n${names}`);
	}
	return await md5_module.fight(names);
}

/**
 * 测量胜率
 * @param names 原始的输入框输入
 * @param round 战斗的回合数
 * @returns 胜率结果
 */
async function win_rate(names: string, round: number): Promise<WinRateResult> {
	// 检查 round 是否合法
	if (round <= 0) {
		throw new Error("round 必须大于 0");
	}
	return await md5_module.win_rate(names, round);
}

/**
 *
 * @param names 原始的输入框输入
 * @param callback 用于接收胜率的回调函数
 * @returns 胜率结果
 */
async function win_rate_callback(
	names: string,
	callback: WinRateCallback,
): Promise<WinRateResult> {
	return await md5_module.win_rate_callback(names, callback);
}

async function score(names: string, round: number): Promise<ScoreResult> {
	// 检查 round 是否合法
	if (round <= 0) {
		throw new Error("round 必须大于 0");
	}
	return await md5_module.score(names, round);
}

async function score_callback(
	names: string,
	callback: ScoreCallback,
): Promise<ScoreResult> {
	return await md5_module.score_callback(names, callback);
}

async function run_any(
	names: string,
	round: number,
): Promise<FightResult | WinRateResult | ScoreResult> {
	return await md5_module.run_any(names, round);
}

const out_limit: number = 1000;

async function wrap_any(names: string, round: number): Promise<string> {
	const result = await run_any(names, round);
	if ("message" in result) {
		// 对战结果
		return `赢家:|${result.source_plr}|`;
	}
	if ("win_count" in result) {
		// 胜率结果
		const win_rate = (result.win_count * 100) / round;
		const win_rate_str = win_rate.toFixed(4);
		let output_str = `最终胜率:|${win_rate_str}%|(${round}轮)`;
		// 每 500 轮, 输出一次
		if (round > out_limit) {
			// 把所有要找的数据拿出来
			const output_datas: WinRate[] = [];
			result.raw_data.forEach((data) => {
				if (data.round % out_limit === 0) {
					output_datas.push(data);
				}
			});
			output_datas.forEach((data) => {
				const win_rate = (data.win_count * 100) / data.round;
				output_str += `\n${win_rate.toFixed(2)}%(${data.round})`;
			});
		}
		return output_str;
	}
	// 分数结果其实还是个胜率, 不过需要 * 100
	const win_rate = ((result.score * 10000) / round).toFixed(2);
	let output_str = `分数:|${win_rate}|(${round}轮)`;
	if (round > out_limit) {
		// 把所有要找的数据拿出来
		const output_datas: Score[] = [];
		result.raw_data.forEach((data) => {
			if (data.round % out_limit === 0) {
				output_datas.push(data);
			}
		});
		output_datas.forEach((data) => {
			const win_rate = ((data.score / data.round) * 10000).toFixed(2);
			output_str += `\n${win_rate}(${data.round})`;
		});
	}
	return output_str;
}

import * as process from "process";
import * as fs from "fs";
async function cli() {
	// 直接跑他
	// 先获取命令行输入
	const args = process.argv.slice(2);

	// 如果长度 < 2
	// 输出帮助信息
	const runner = md5_module.run_env.is_node ? "ts-node" : "node";

	const help_msg = `md5-api.ts 是一个 包装了 md5.js 的 api
当然, 你也可以直接用来跑, 用于开箱

想使用的话, 请使用 
${runner} md5-api.ts <装着你名字的文件> <开箱类型>
开箱类型可以是: pp, pd, qp, qd
开箱完会把结果输出到 <装着你名字的文件>-out.txt
	`;
	if (args.length < 2 || args.includes("--help") || args.includes("-h")) {
		console.log(help_msg);
		process.exit(0);
	}

	const file_path = args[0];
	const open_type = args[1];

	// 先校验一下 open_type
	const open_types = ["pp", "pd", "qp", "qd"];
	if (!open_types.includes(open_type)) {
		console.log(`开箱类型不对, 只能是 ${open_types.join(", ")} 之一`);
		process.exit(1);
	}

	// 读取文件
	// 先判断是否存在
	if (!fs.existsSync(file_path)) {
		console.log(`文件 ${file_path} 不存在`);
		process.exit(1);
	}
	const file_content = fs.readFileSync(file_path, "utf-8");
	// 按行分割
	const lines = file_content.split("\n");
	// 准备输出文件
	const output_file_path = `${file_path}-out.txt`;
	// 判断一下是否存在
	if (fs.existsSync(output_file_path)) {
		// 警告
		console.log(`输出文件 ${output_file_path} 已经存在, 请删除后再试`);
		process.exit(1);
	}
	let run_prefix: string;
	if (open_type === "pp") {
		run_prefix = "!test!\n\n{temp}";
	} else if (open_type === "pd") {
		run_prefix = "!test!\n\n{temp}\n{temp}";
	} else if (open_type === "qp") {
		run_prefix = "!test!\n!\n\n{temp}";
	} else {
		run_prefix = "!test!\n!\n\n{temp}\n{temp}";
		// 我甚至想加个
	}

	for (let line of lines) {
		if (line.trim() === "") {
			continue;
		}
		// 如果末尾有 \r, 去掉
		if (line.endsWith("\r")) {
			line = line.slice(0, -1);
		}
		// 如果末尾有 \n, 去掉
		if (line.endsWith("\n")) {
			line = line.slice(0, -1);
		}
		const runs = run_prefix.replace(/\{temp\}/g, line);
		console.log(`开始跑: ${runs}`);
		const result = await score(runs, 100 * 100);
		const win_rate = ((result.score * 10000) / (100 * 100)).toFixed(2);
		console.log(`评分: ${win_rate}`);
		// 写入文件
		fs.appendFileSync(output_file_path, `${line}|${win_rate}\n`);
	}
}

// 运行 cli
// cli().catch((e) => {
// 	console.error(e);
// 	process.exit(1);
// });

export {
	type FightResult,
	type WinRate,
	type WinRateResult,
	type WinRateCallback,
	type Score,
	type ScoreResult,
	type ScoreCallback,
	fight,
	win_rate,
	win_rate_callback,
	score,
	score_callback,
	run_any,
	wrap_any,
};
