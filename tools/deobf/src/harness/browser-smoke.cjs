/**
 * 浏览器烟雾测试：用无头 Edge 打开 branch/latest/index.html，输入固定名字跑完一场战斗。
 *
 * 用法（Node 22+，需要本机安装 Edge）：
 *   node tools/deobf/src/harness/browser-smoke.cjs
 * 可用 EDGE_PATH 指定其他 Chromium 内核浏览器。
 *
 * 通过条件：收到 done_fight、胜者为 m@fAIgFUL、页面无未捕获异常。
 * 本地 index.html 缺少部署时由广告脚本注入的 .ad_v，这里只在 HTTP 响应中补占位，不改仓库文件。
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "../../../../branch/latest");
const PORT = Number(process.env.SMOKE_PORT || 8877);
const DEBUG_PORT = Number(process.env.SMOKE_DEBUG_PORT || 9222);
const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const INPUT = "m@fAIgFUL\n1 1 @Ehlt s";
const EXPECTED_WINNER = "m@fAIgFUL";
const EXPECTED_VERSION = "0.5.4";

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".svg": "image/svg+xml",
};

function start_server() {
	return new Promise((resolve) => {
		const server = http.createServer((req, res) => {
			const url_path = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
			const file_path = path.resolve(ROOT, "." + url_path);
			if (!file_path.startsWith(ROOT)) {
				res.writeHead(403).end();
				return;
			}
			fs.readFile(file_path, (err, data) => {
				if (err) {
					res.writeHead(404).end("not found");
					return;
				}
				const ext = path.extname(file_path).toLowerCase();
				if (ext === ".html" && url_path === "/index.html") {
					data = Buffer.from(
						data.toString("utf-8").replace(
							"<div class='ad_h'></div>",
							"<div class='ad_h'></div>\n    <div class='ad_v'></div>",
						),
						"utf-8",
					);
				}
				res.writeHead(200, {
					"Content-Type": MIME[ext] || "application/octet-stream",
					"Cache-Control": "no-store",
				});
				res.end(data);
			});
		});
		server.listen(PORT, "127.0.0.1", () => resolve(server));
	});
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wait_debug() {
	for (let i = 0; i < 100; i++) {
		try {
			const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
			if (res.ok) return await res.json();
		} catch (_) {}
		await sleep(200);
	}
	throw new Error("Edge 调试端口未就绪");
}

class CDP {
	constructor(url) {
		this.ws = new WebSocket(url);
		this.id = 0;
		this.pending = new Map();
		this.listeners = new Map();
		this.ready = new Promise((resolve, reject) => {
			this.ws.addEventListener("open", resolve);
			this.ws.addEventListener("error", reject);
		});
		this.ws.addEventListener("message", (ev) => {
			const msg = JSON.parse(ev.data);
			if (msg.id != null) {
				const p = this.pending.get(msg.id);
				if (p) {
					this.pending.delete(msg.id);
					if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
					else p.resolve(msg.result);
				}
				return;
			}
			const arr = this.listeners.get(msg.method);
			if (arr) for (const fn of arr) fn(msg.params);
		});
	}
	on(method, fn) {
		if (!this.listeners.has(method)) this.listeners.set(method, []);
		this.listeners.get(method).push(fn);
	}
	async send(method, params = {}) {
		await this.ready;
		const id = ++this.id;
		const promise = new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
		});
		this.ws.send(JSON.stringify({ id, method, params }));
		return promise;
	}
	close() {
		this.ws.close();
	}
}

async function main() {
	const server = await start_server();
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tswn-edge-"));
	const edge = spawn(
		EDGE,
		[
			"--headless=new",
			"--disable-gpu",
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-extensions",
			`--remote-debugging-port=${DEBUG_PORT}`,
			`--user-data-dir=${profile}`,
			"about:blank",
		],
		{ stdio: "ignore" },
	);

	const exceptions = [];
	const console_errors = [];
	const contexts = new Map();
	let cdp;
	let exit_code = 0;
	try {
		await wait_debug();
		const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
		const page = list.find((t) => t.type === "page");
		if (!page) throw new Error("未找到 page target");
		cdp = new CDP(page.webSocketDebuggerUrl);
		await cdp.ready;

		cdp.on("Runtime.executionContextCreated", (p) => {
			contexts.set(p.context.id, p.context);
		});
		cdp.on("Runtime.exceptionThrown", (p) => {
			const d = p.exceptionDetails;
			exceptions.push({
				text: d.text,
				desc: d.exception && (d.exception.description || d.exception.value),
				line: d.lineNumber,
				url: d.url,
				context: contexts.get(d.executionContextId)?.origin,
			});
		});
		cdp.on("Runtime.consoleAPICalled", (p) => {
			if (p.type === "error") {
				console_errors.push(p.args.map((a) => a.value ?? a.description ?? a.type).join(" "));
			}
		});

		await cdp.send("Runtime.enable");
		await cdp.send("Page.enable");
		await cdp.send("Log.enable");
		await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });

		const eval_js = async (expression) => {
			const r = await cdp.send("Runtime.evaluate", {
				expression,
				returnByValue: true,
				awaitPromise: true,
			});
			if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
			return r.result.value;
		};

		let ready = false;
		for (let i = 0; i < 120; i++) {
			await sleep(250);
			try {
				ready = await eval_js(`(() => {
					const ta = document.querySelector('#input_name');
					const frame = document.querySelector('.mdframe');
					return document.readyState === 'complete'
						&& !!ta && !!document.querySelector('button.goBtn')
						&& !!frame && !!frame.contentDocument && frame.contentDocument.readyState === 'complete';
				})()`);
			} catch (_) {}
			if (ready) break;
		}
		if (!ready) throw new Error("页面资源未就绪");

		await eval_js(`(() => {
			window.__smoke = { msgs: [], objects: [] };
			addEventListener('message', (e) => {
				try {
					if (typeof e.data === 'string') window.__smoke.msgs.push(e.data);
					else window.__smoke.objects.push({ keys: e.data && Object.keys(e.data), data: JSON.stringify(e.data).slice(0, 500) });
				} catch (_) {}
			});
		})()`);

		const submitted = await eval_js(`(() => {
			const ta = document.querySelector('#input_name');
			ta.value = ${JSON.stringify(INPUT)};
			ta.dispatchEvent(new Event('input', { bubbles: true }));
			const btn = document.querySelector('button.goBtn');
			if (!btn) return { ok: false, reason: 'no goBtn' };
			btn.click();
			return { ok: true, value: ta.value };
		})()`);
		if (!submitted.ok) throw new Error("无法提交输入: " + JSON.stringify(submitted));

		let done = false;
		let iframe_state = null;
		for (let i = 0; i < 240; i++) {
			await sleep(500);
			try {
				const state = await eval_js(`(() => {
					const frame = document.querySelector('.mdframe');
					const w = frame && frame.contentWindow;
					let pbody = null, pbody_len = 0, plist = null, err = null;
					try {
						const body_el = w.document.querySelector('.pbody');
						pbody = body_el ? body_el.innerText.slice(-600) : null;
						pbody_len = body_el ? body_el.innerText.length : 0;
						const list_el = w.document.querySelector('.plist');
						plist = list_el ? list_el.innerText.slice(0, 200) : null;
					} catch (e) { err = String(e); }
					const end_title = document.querySelector('#endtitle');
					const done_target = document.querySelector('#done_target');
					return {
						msgs: window.__smoke.msgs.slice(),
						objects: window.__smoke.objects.slice(),
						pbody, pbody_len, plist, err,
						end_title: end_title ? end_title.textContent : null,
						done_target: done_target ? done_target.textContent : null,
					};
				})()`);
				iframe_state = state;
				if (state.msgs.includes("done_fight")) {
					done = true;
					break;
				}
			} catch (_) {}
		}

		const result = {
			done,
			iframe_state,
			exceptions: exceptions.map((e) => ({
				text: e.text,
				desc: e.desc && String(e.desc).split("\n")[0],
				line: e.line,
				url: e.url,
			})),
			console_errors,
		};
		console.log(JSON.stringify(result, null, 2));

		const served_version = (fs.readFileSync(path.join(ROOT, "md5.js"), "utf-8").match(/const _version_ = "([^"]+)"/) || [])[1];
		const winner_ok = !!iframe_state && iframe_state.objects.some((o) => o.data && o.data.includes(`"winners":["${EXPECTED_WINNER}"]`));
		if (!done) exit_code = 1;
		if (!winner_ok) exit_code = 1;
		if (!iframe_state || iframe_state.pbody_len < 200) exit_code = 1;
		if (served_version !== EXPECTED_VERSION) exit_code = 1;
		if (exceptions.length > 0) exit_code = 1;
	} catch (e) {
		console.error("SMOKE FAIL:", e);
		exit_code = 1;
	} finally {
		try { cdp && cdp.close(); } catch (_) {}
		edge.kill();
		server.close();
		await sleep(500);
		try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
	}
	process.exit(exit_code);
}

main();
