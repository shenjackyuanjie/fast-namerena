// 请使用 bun 运行

import { fight, score, win_rate } from "./md5-api";

const test_profiles = {
	fight: [
		{
			test: `vy5we
w\n ryyb\nb\nrv\nv\netet4y 54 w\ne rg\nwe by\nrw \nte\nw \nnbyrb\n ew\nyn re\nryb\ney w\nneb r\nbwe\nn yrbq34nb\net\nab\nqbetq\n45ywy54\ny45\n45\nwv54\nyw\nvy\n5y\nvyev\nyeevy\nvey\ne\nrye\nyn\n43n\n63\nub63 u\nb6r\nun\n3br\nue\nrnbt\n4n\n5b\nwu\n4bw\n4nw\n4u \nn6w\nr`, winner: "rye"
		},
        {
            test: 'm@fAIgFUL\n1 1 @Ehlt s',
            winner: "m@fAIgFUL"
        },
	],
	win_chance: [
		{
			test: `
            !test!
            
            http://shenjack.top:81/md5/branch/latest/
            
            http://shenjack.top:81/md5`,
			round_10: 0.513,
			round_100: 0.5106,
		},
	],
	score: [
		{
			test: `
            !test!
            
            http://shenjack.top:81/md5/branch/latest/`,
			round_10: 1480,
			round_100: 1903, // todo
		},
	],
};

async function test() {
	for (const profile of test_profiles.fight) {
		const result = await fight(profile.test);
        if (result.source_plr === profile.winner) {
            console.log("pass");
        } else {
            throw new Error("fail" + result.source_plr + " " + profile.winner + " " + profile.test);
        }
	}
	for (const profile of test_profiles.win_chance) {
        console.log(profile.test);
		const result = await win_rate(profile.test, 100 * 100);
        // 分别校验 10 * 100 和 100 * 100 轮的胜率
        for (const data of result.raw_data) {
            if (data.round === 10 * 100) {
                const rate = data.win_count / data.round;
                if (rate === profile.round_10) {
                    console.log("pass");
                } else {
                    throw new Error("fail" + rate + " " + profile.round_10);
                }
            } else if (data.round === 100 * 100) {
                const rate = data.win_count / data.round;
                if (rate === profile.round_100) {
                    console.log("pass");
                } else {
                    throw new Error("fail" + rate + " " + profile.round_100);
                }
            }
        }
        
	}
	for (const profile of test_profiles.score) {
        console.log(profile.test);
        const result = await score(profile.test, 100 * 100);
        for (const data of result.raw_data) {
            if (data.round === 10 * 100) {
                if (data.score * 10 === profile.round_10) {
                    console.log("pass");
                } else {
                    throw new Error("fail" + data.score + " " + profile.round_10);
                }
            } else if (data.round === 100 * 100) {
                if (data.score === profile.round_100) {
                    console.log("pass");
                } else {
                    throw new Error("fail" + data.score + " " + profile.round_100);
                }
            }
        }

	}
}

test();
