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

    // lazy_old($, 
}

main();