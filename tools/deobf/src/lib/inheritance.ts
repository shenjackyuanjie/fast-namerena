import { collectPrototypeBlocks, memberOwner, traverseAst } from "./ast";

export interface RenameLike {
	old: string;
	new: string;
	owners: string[];
}

interface Model {
	ownKeys: Map<string, Map<string, string>>;
	supers: Map<string, string[]>;
	mixins: Map<string, string[]>;
	classes: Set<string>;
}

function buildModel(ast: any): Model {
	const ownKeys = new Map<string, Map<string, string>>();
	for (const block of collectPrototypeBlocks(ast)) {
		const keys = ownKeys.get(block.owner) ?? new Map<string, string>();
		for (const key of block.keys.keys()) keys.set(key, `${block.owner}#${key}`);
		ownKeys.set(block.owner, keys);
	}

	const supers = new Map<string, string[]>();
	const mixins = new Map<string, string[]>();

	// 继承初始化块用 hunkHelpers.inheritMany 的本地别名（inherit_many）
	const aliases = new Map<string, string>();
	traverseAst(ast, {
		VariableDeclarator(path: any) {
			const { id, init } = path.node;
			if (id.type !== "Identifier" || init?.type !== "MemberExpression" || init.computed) return;
			if (init.object.type !== "Identifier" || init.object.name !== "hunkHelpers") return;
			if (init.property.type !== "Identifier") return;
			aliases.set(id.name, init.property.name);
		},
	});
	const helper = (name: string): string => aliases.get(name) ?? name;

	function ident(node: any): string | null {
		if (!node) return null;
		if (node.type === "MemberExpression" || node.type === "Identifier") return memberOwner(node);
		return null;
	}

	traverseAst(ast, {
		CallExpression(path: any) {
			const callee = path.node.callee;
			if (callee.type !== "Identifier") return;
			const name = helper(callee.name);
			const args = path.node.arguments;
			if (name === "inherit" && args.length >= 2) {
				const sub = ident(args[0]);
				const sup = ident(args[1]);
				if (!sub || !sup) return;
				const list = supers.get(sub) ?? [];
				list.push(sup);
				supers.set(sub, list);
			} else if (name === "inheritMany" && args.length >= 2 && args[1].type === "ArrayExpression") {
				const sup = ident(args[0]);
				if (!sup) return;
				for (const el of args[1].elements) {
					const sub = ident(el);
					if (!sub) continue;
					const list = supers.get(sub) ?? [];
					list.push(sup);
					supers.set(sub, list);
				}
			} else if ((name === "mixin" || name === "mixinMany") && args.length >= 2) {
				const cls = ident(args[0]);
				if (!cls) return;
				const sources = args[1].type === "ArrayExpression" ? args[1].elements : [args[1]];
				for (const src of sources) {
					const m = ident(src);
					if (!m) continue;
					const list = mixins.get(cls) ?? [];
					list.push(m);
					mixins.set(cls, list);
				}
			}
		},
	});

	const classes = new Set<string>([...ownKeys.keys(), ...supers.keys(), ...mixins.keys()]);
	return { ownKeys, supers, mixins, classes };
}

function buildResolver(model: Model, nameOf: (owner: string, key: string) => string) {
	const cache = new Map<string, Map<string, string>>();

	function table(cls: string, seen: Set<string>): Map<string, string> {
		const cached = cache.get(cls);
		if (cached) return cached;
		if (seen.has(cls)) return new Map();
		seen.add(cls);

		const own = new Map<string, string>();
		// mixinProperties 只复制目标原型缺失的键；多个 mixin 先到先得
		for (const m of model.mixins.get(cls) ?? []) {
			for (const [k, v] of table(m, seen)) if (!own.has(k)) own.set(k, v);
		}
		// 类自身的键覆盖 mixin
		for (const [k, v] of model.ownKeys.get(cls) ?? []) own.set(k, v);

		const out = new Map<string, string>();
		for (const [k, v] of own) {
			const [owner, key] = v.split("#") as [string, string];
			out.set(nameOf(owner, key), v);
		}
		for (const s of model.supers.get(cls) ?? []) {
			for (const [k, v] of table(s, seen)) if (!out.has(k)) out.set(k, v);
		}
		cache.set(cls, out);
		return out;
	}

	return (cls: string, name: string): string | null => table(cls, new Set()).get(name) ?? null;
}

/**
 * 检查重命名是否改变任意类的原型方法解析结果。
 * 返回 old -> 冲突说明；调用方应把冲突条目从映射中剔除。
 */
export function findDispatchConflicts(ast: any, entries: RenameLike[]): Map<string, string> {
	const model = buildModel(ast);
	const renameByOwnerKey = new Map<string, string>();
	for (const entry of entries) {
		for (const owner of entry.owners) renameByOwnerKey.set(`${owner}#${entry.old}`, entry.new);
	}
	const nameAfter = (identity: string): string => {
		const [owner, key] = identity.split("#") as [string, string];
		return renameByOwnerKey.get(`${owner}#${key}`) ?? key;
	};

	const resolveBefore = buildResolver(model, (_owner, key) => key);
	const resolveAfter = buildResolver(model, (owner, key) => renameByOwnerKey.get(`${owner}#${key}`) ?? key);

	const conflicts = new Map<string, string>();
	for (const cls of model.classes) {
		const reachable = new Set<string>();
		const seen = new Set<string>();
		const walk = (c: string): void => {
			if (seen.has(c)) return;
			seen.add(c);
			for (const n of model.ownKeys.get(c)?.keys() ?? []) reachable.add(n);
			for (const m of model.mixins.get(c) ?? []) walk(m);
			for (const s of model.supers.get(c) ?? []) walk(s);
		};
		walk(cls);

		for (const name of reachable) {
			const identity = resolveBefore(cls, name);
			if (!identity) continue;
			const expected = nameAfter(identity);
			const actual = resolveAfter(cls, expected);
			if (actual === identity) continue;
			const [owner, key] = identity.split("#") as [string, string];
			const entry = entries.find((e) => e.old === key && e.owners.includes(owner));
			if (!entry) continue;
			conflicts.set(
				entry.old,
				`${cls} 上 ${name} -> ${expected} 解析到 ${actual ?? "undefined"}，期望 ${identity}`,
			);
		}
	}
	return conflicts;
}
