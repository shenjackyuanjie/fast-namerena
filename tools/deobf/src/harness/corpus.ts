export type CorpusOp =
	| { id: string; kind: "fight"; input: string }
	| { id: string; kind: "fight_log"; input: string }
	| { id: string; kind: "win_rate"; input: string; round: number }
	| { id: string; kind: "score"; input: string; round: number };

export interface Corpus {
	name: string;
	version: string;
	ops: CorpusOp[];
}

const FIGHT_A = [
	"vy5we",
	"w",
	" ryyb",
	"b",
	"rv",
	"v",
	"etet4y 54 w",
	"e rg",
	"we by",
	"rw ",
	"te",
	"w ",
	"nbyrb",
	" ew",
	"yn re",
	"ryb",
	"ey w",
	"neb r",
	"bwe",
	"n yrbq34nb",
	"et",
	"ab",
	"qbetq",
	"45ywy54",
	"y45",
	"45",
	"wv54",
	"yw",
	"vy",
	"5y",
	"vyev",
	"yeevy",
	"vey",
	"e",
	"rye",
	"yn",
	"43n",
	"63",
	"ub63 u",
	"b6r",
	"un",
	"3br",
	"ue",
	"rnbt",
	"4n",
	"5b",
	"wu",
	"4bw",
	"4nw",
	"4u ",
	"n6w",
	"r",
].join("\n");

const FIGHT_B = "m@fAIgFUL\n1 1 @Ehlt s";

// 与 branch/latest/test.ts 完全一致（含缩进），保证前 5 个用例可复现既有基线
const WIN_RATE_INPUT = `
            !test!
            
            http://shenjack.top:81/md5/branch/latest/
            
            http://shenjack.top:81/md5`;

const SCORE_INPUT_1 = `
            !test!
            
            http://shenjack.top:81/md5/branch/latest/`;

const SCORE_INPUT_2 = `
            !test!
!

鹿目圆EKSR"I]jIG@TLEWA
Niss7rclxb1]K@TLEWA`;

const MULTI_PLAY = `adawada
aeagfsdf

seed:seed`;

const STRONG_TEAM = String.raw`<αβ>-02pjt42k@ReturnVoid
飞雪PSODKKXWP@涵虚
虚境-4xtrv36e@涵虚
<βε>-lxecl3g6@ReturnVoid
十六夜咲夜 imIuZYJk@Squall
爱丽丝·玛格特洛依德 G26FRAL0@Squall
光YLqKf5rv9EU9lnc@Squall
魂魄妖梦 AKG1OENX@Squall
郭娱戈宏帅@otto
大家好啊，我是蟆猎命说@otto
\Empire\-692175165208@\XIV\-14
Momomomo #YAORzaY@Arcadia
Momo #L9GHU8F@Arcadia
CtC7gL9JNpvNpOl@新纪元
② vYtp0F-@新纪元
肪袍首阱丹@Hell
rkYDjfxB@coat
vRuH:z@耗子尾汁
史莱德 #XPMTVPKY@暗黑突击
\`I!.lf@紫微垣
涵虚不等式 PFVKEUPBU@TigerStar
癌细胞 Qgu35DIL[Q8us/3@TigerStar
wt(zEe]T@TigerStar
0000000I0bNQDRS@aaa
00000000MOYffOK@aaa
0000001p5tE2pMs@aaa
0000000hjMO5Zv5@aaa
Rick QUJTCGUVGHIJ@nan
U>7D3Ol7uWKIfTC@XJ联队
Lumos dtGoP!RM@Shabby_fish
Neverland RjRNrl4YV@candle
天依 'i[8S\`Aw@LuoTianyi`;

const DIY =
	'DiyTester+diy[66,66,66,66,66,66,66,66]{"SklFire":100,"SklHeal":100}\nNormal';
const WEAPONS = "刀客+剁手刀\n剑客+死亡笔记";

export const CORPUS: Corpus = {
	name: "v0.5.5-default",
	version: "0.5.5",
	ops: [
		// 前 5 项与 test.ts 顺序一致，用于复现既有 golden
		{ id: "golden-fight-1", kind: "fight", input: FIGHT_A },
		{ id: "golden-fight-2", kind: "fight", input: FIGHT_B },
		{ id: "golden-win-rate", kind: "win_rate", input: WIN_RATE_INPUT, round: 10000 },
		{ id: "golden-score-1", kind: "score", input: SCORE_INPUT_1, round: 10000 },
		{ id: "golden-score-2", kind: "score", input: SCORE_INPUT_2, round: 10000 },
		// 额外覆盖：日志、分身、seed、强单队伍、DIY、武器、boss
		{ id: "fight-log", kind: "fight_log", input: FIGHT_B },
		{ id: "multi-play", kind: "fight", input: FIGHT_A },
		{ id: "seed", kind: "fight", input: MULTI_PLAY },
		{ id: "strong-team", kind: "fight", input: STRONG_TEAM },
		{ id: "diy", kind: "fight", input: DIY },
		{ id: "weapons", kind: "fight", input: WEAPONS },
	],
};
