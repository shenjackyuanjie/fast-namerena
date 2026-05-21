// require: bun
async function main() {
    const have_bun = Bun === undefined ? false : true;

    if (!have_bun) {
        console.log("这玩意需要 bun 来运行");
        return;
    }

    // 打开 md5.js 文件
    const md5_file = Bun.file("md5.js");
    const md5_text: string = await md5_file.text();
    // 按行分割
    const md5_lines: string[] = md5_text.split("\n");

    let 反混淆_lst: Array<[number, string]> = [];

    md5_lines.forEach((line: string, idx: number) => {
        const trimed_line = line.trim();
        if (trimed_line.length === 0) {
            return;
        }
        if (trimed_line.startsWith("//")) {
            return;
        }
        if (!trimed_line.startsWith("return")) {
            return;
        }
        // 找到了 return 语句
        const return_stuf = trimed_line.split("return")[1].trim();
        if (return_stuf.length === 0 || return_stuf.length === 1) {
            return;
        }
        const include_lst = [
            "X.k",
            "X.D",
            "LangData.j"
        ]
        const include_result: boolean[] = include_lst.map((include) => {
            return return_stuf.includes(include);
        });
        if (!include_result.includes(true)) {
            return;
        }
        反混淆_lst.push([idx, return_stuf]);
    });

    let tmp_md5 = md5_text;
    反混淆_lst.forEach(([idx, return_stuf]) => {
        tmp_md5 = `${tmp_md5}\nconsole.log(${return_stuf});`;
    });

    Bun.write("tmp_md5.js", tmp_md5);

    // bun run tmp_md5.js
    const proc = Bun.spawn(["node", "tmp_md5.js"]);
    const result = await new Response(proc.stdout).text();
    // 一一对应的
    const result_lines = result.split("\n");
    反混淆_lst.forEach(([idx, return_stuf], idx2) => {
        console.log(`${return_stuf} => ${result_lines[idx2]}`);
    });

    // 删除临时文件
    Bun.file("tmp_md5.js").delete();

    let replaced_md5 = md5_text;
    反混淆_lst.forEach(([idx, return_stuf], idx2) => {
        let rep = result_lines[idx2];
        if (rep === undefined) {
            return;
        }
        if (!isNaN(Number(rep))) {
            rep = Number(rep);
        } else if (typeof rep === "string") {
            rep = `"${rep}"`;
        }
        const src_space_count = md5_lines[idx].search(/\S/);
        const src_return = `return ${return_stuf}`;
        const dest_return = `// ${src_return}\n${' '.repeat(src_space_count)}return ${rep}`;
        replaced_md5 = replaced_md5.replace(src_return, dest_return);
    });
    Bun.write("replaced_md5.js", replaced_md5);
}

await main();

export { };