const md5_module = require('./md5.js');

// 启动一个 async 函数
async function main() {
    let result = await md5_module.fight("aaaaaa\nbbbbb");

    console.log("对战结果: ", result);

    let win_rate = await md5_module.win_rate("!test!\n\naaaaaa\n\nbbbbb", 1000);

    console.log("胜率: ", win_rate);

    let score = await md5_module.score("!test!\n\naaaaaabbbb", 1000);

    console.log("分数: ", score);
};

main();
