/**
 * `$` 命名空间成员重命名映射（第三轮）。
 *
 * 来源：`D:/githubs/namer/namer-src` 中的 Dart 静态字段 / getter。
 * - kind=lazy：由 lazy_old / lazy_final / lazy 注册；注册参数字符串与所有 `$.name` 同步改写
 * - kind=field：staticFields 阶段直接挂在 `$` 上的静态字段
 *
 * 约束：
 * - old 只能通过 `$.old`（或 `$["old"]`）访问；存在其它字符串引用时整条跳过
 * - new 不得与 `$` 上已有成员、slot 或其它映射目标重名
 * - 本地 namer-src 缺少对应源文件时，evidence 记录推断依据
 */
export type NamespaceMemberKind = "lazy" | "field";

export interface NamespaceRename {
	old: string;
	new: string;
	kind: NamespaceMemberKind;
	dart: string;
	evidence: string;
	batch: 1;
}

export const NAMESPACE_RENAMES: NamespaceRename[] = [
	// Sgls / Sgl（html/sgl.dart, html/sgl_gen.dart）
	{ old: "k8", new: "sgls", kind: "field", dart: "Sgls.sgls", evidence: "html/sgl.dart:15", batch: 1 },
	{ old: "mg", new: "dataUrls", kind: "field", dart: "Sgls.dataUrls", evidence: "html/sgl.dart:14", batch: 1 },
	{ old: "e_", new: "iconidx", kind: "field", dart: "Sgls.iconidx", evidence: "html/sgl.dart:16", batch: 1 },
	{ old: "mf", new: "sigColors", kind: "field", dart: "Sgl.sig_colors", evidence: "html/sgl_gen.dart:5", batch: 1 },
	{ old: "md", new: "pattern", kind: "field", dart: "Sgl._pattern", evidence: "html/sgl_gen.dart:71", batch: 1 },
	{ old: "dZ", new: "datas", kind: "field", dart: "Sgl.datas", evidence: "html/sgl_gen.dart:129", batch: 1 },
	{ old: "me", new: "borders", kind: "field", dart: "Sgl.borders", evidence: "html/sgl_gen.dart:131", batch: 1 },
	{ old: "o5", new: "masks", kind: "field", dart: "Sgl.masks", evidence: "html/sgl_gen.dart:132", batch: 1 },
	{ old: "nv", new: "cdif", kind: "lazy", dart: "Sgl.cdif", evidence: "html/sgl_gen.dart:44", batch: 1 },
	{ old: "nt", new: "initComplete", kind: "lazy", dart: "Sgl._initComplete", evidence: "html/sgl_gen.dart:72", batch: 1 },
	{ old: "nu", new: "canvas", kind: "lazy", dart: "Sgl.canvas", evidence: "html/sgl_gen.dart:142", batch: 1 },
	{ old: "lS", new: "shapeCanvas", kind: "lazy", dart: "Sgl.shapeCanvas", evidence: "html/sgl_gen.dart:201", batch: 1 },
	{ old: "d8", new: "shapeImage", kind: "lazy", dart: "Sgl.shapeImage", evidence: "html/sgl_gen.dart:202", batch: 1 },

	// PlrView（html/plrview.dart）
	{ old: "ay", new: "plrViewDict", kind: "field", dart: "PlrView.dict", evidence: "html/plrview.dart:41", batch: 1 },
	{ old: "jU", new: "plrViewPid", kind: "field", dart: "PlrView.pid", evidence: "html/plrview.dart:40", batch: 1 },

	// HtmlRenderer / Images / helper
	{ old: "rW", new: "bosses", kind: "field", dart: "Images.bosses", evidence: "html/image.dart:2", batch: 1 },
	{ old: "bU", new: "img", kind: "lazy", dart: "HtmlRenderer.img", evidence: "html/html.dart:427", batch: 1 },
	{ old: "rm", new: "updateReg", kind: "lazy", dart: "renderer._updateReg", evidence: "html/renderer.dart:3", batch: 1 },
	{ old: "bV", new: "noValidator", kind: "lazy", dart: "noValidator", evidence: "helper.dart:14", batch: 1 },

	// Fgt 输入清洗正则（fgt.dart）
	{ old: "r0", new: "replaceSpace0", kind: "lazy", dart: "Fgt.replaceSpace0", evidence: "fgt.dart:13", batch: 1 },
	{ old: "nq", new: "replaceSpace1", kind: "lazy", dart: "Fgt.replaceSpace1", evidence: "fgt.dart:14", batch: 1 },
	{ old: "r_", new: "regNewLine", kind: "lazy", dart: "Fgt.regNewLine", evidence: "fgt.dart:15", batch: 1 },

	// 武器（weapon/）
	{ old: "rj", new: "specialList", kind: "lazy", dart: "Weapon.specialList", evidence: "weapon/weapon.dart:5", batch: 1 },
	{ old: "r5", new: "rinickModifierHP", kind: "lazy", dart: "RinickModifierHP", evidence: "weapon/rinick_modifier.dart:3", batch: 1 },
	{ old: "r6", new: "s11AttrNames", kind: "lazy", dart: "SklS11.attrNames", evidence: "weapon/s11.dart:5", batch: 1 },
	{ old: "r1", new: "guiYueMembers", kind: "lazy", dart: "GuiYue.members", evidence: "weapon/gui_yue.dart:15", batch: 1 },
	{
		old: "rk",
		new: "xuanYueMembers",
		kind: "lazy",
		dart: "XuanYue.members",
		evidence: "namer-src 无 xuan_yue.dart；按 T.ku 工厂返回 T.kv 推断",
		batch: 1,
	},

	// Boss / RunUpdate / 语言表
	{ old: "nr", new: "boosted", kind: "lazy", dart: "Boss.boosted", evidence: "boss/boss.dart:56", batch: 1 },
	{ old: "K", new: "newline", kind: "lazy", dart: "RunUpdate.newline", evidence: "misc.dart:62", batch: 1 },
	{ old: "od", new: "langDict", kind: "field", dart: "top-level _L", evidence: "lan_data.dart:19", batch: 1 },
];
