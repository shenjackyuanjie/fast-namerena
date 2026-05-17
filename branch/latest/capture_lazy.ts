/**
 * 捕获所有 lazy initializer 的值
 * 在 Bun 中运行: bun run capture_lazy.ts
 *
 * 策略:
 * 1. 加载 md5.js 模块
 * 2. 解析源码找到所有 u($, "xx", "yy", function() { return expr; })
 * 3. 调用每个 getter 触发 lazy 初始化
 * 4. 序列化捕获到的值
 * 5. 输出 JSON mapping
 */

import * as fs from "fs";
import * as path from "path";

const MD5_PATH = "D:\\githubs\\namer\\namerena.github.io\\md5.js";
const OUTPUT_PATH = "D:\\githubs\\namer\\fast-namerena\\branch\\latest\\lazy_values.json";

interface LazyEntry {
  name: string;    // $.xx 属性名
  getter: string;  // $.yy() getter 方法名
  line: number;    // 行号
  rawExpr: string; // 原始 return 表达式
  value: any;      // 捕获的值
  canInline: boolean;
  replacement: string; // 替换用的字面量字符串
}

function serializeValue(v: any): { canInline: boolean; replacement: string } {
  if (v === null || v === undefined) {
    return { canInline: true, replacement: String(v) };
  }
  const t = typeof v;
  if (t === "string") {
    return { canInline: true, replacement: JSON.stringify(v) };
  }
  if (t === "number") {
    if (!Number.isFinite(v)) {
      return { canInline: false, replacement: "" };
    }
    return { canInline: true, replacement: String(v) };
  }
  if (t === "boolean") {
    return { canInline: true, replacement: String(v) };
  }
  if (v instanceof RegExp) {
    return { canInline: true, replacement: v.toString() };
  }
  if (Array.isArray(v)) {
    // 尝试序列化数组
    const items: string[] = [];
    for (const item of v) {
      const s = serializeValue(item);
      if (!s.canInline) {
        return { canInline: false, replacement: "" };
      }
      items.push(s.replacement);
    }
    return { canInline: true, replacement: "[" + items.join(", ") + "]" };
  }
  // 对象或其他类型，不能安全内联
  return { canInline: false, replacement: "" };
}

async function main() {
  // 1. 读取 md5.js 源码
  const source = fs.readFileSync(MD5_PATH, "utf-8");
  const lines = source.split("\n");

  // 2. 解析所有 u($, "xx", "yy", function 模式
  const pattern = /^\s*u\(\$,\s*"(\w+)",\s*"(\w+)",\s*function\b/;
  const entries: { name: string; getter: string; line: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(pattern);
    if (m) {
      entries.push({ name: m[1], getter: m[2], line: i + 1 });
    }
  }

  console.log(`找到 ${entries.length} 个 lazy initializers`);

  // 3. 加载模块
  const $ = require(MD5_PATH);

  // 4. 触发所有 getter
  const valueMap: Map<string, any> = new Map();

  // 先触发那些不依赖其他 getter 的（O.i, P.dI, 数字等）
  // 然后再触发依赖其他 getter 的
  // 为了安全，分多轮调用

  const MAX_ROUNDS = 5;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    let triggered = 0;
    for (const entry of entries) {
      if (valueMap.has(entry.name)) continue;

      const getterFn = $[entry.getter];
      if (typeof getterFn !== "function") {
        // 可能已经被之前的调用触发了
        const stored = $[entry.name];
        if (stored !== undefined && stored !== $) {
          valueMap.set(entry.name, stored);
          triggered++;
        }
        continue;
      }

      try {
        const value = getterFn.call($);
        if (value !== null && value !== $) {
          valueMap.set(entry.name, value);
          triggered++;
        }
      } catch (e) {
        // 依赖还没就绪，下轮再试
      }
    }
    console.log(`  第 ${round + 1} 轮: 触发了 ${triggered} 个`);
    if (triggered === 0) break;
  }

  console.log(`成功捕获 ${valueMap.size}/${entries.length} 个值`);

  // 5. 构建结果
  const results: LazyEntry[] = [];
  for (const entry of entries) {
    const value = valueMap.get(entry.name);
    const ser = serializeValue(value);
    results.push({
      name: entry.name,
      getter: entry.getter,
      line: entry.line,
      rawExpr: "",
      value: value,
      canInline: ser.canInline,
      replacement: ser.replacement,
    });
  }

  // 6. 输出
  const output: Record<string, any> = {};
  for (const r of results) {
    output[r.name] = {
      getter: r.getter,
      line: r.line,
      canInline: r.canInline,
      replacement: r.replacement,
      valuePreview:
        typeof r.value === "string"
          ? r.value.substring(0, 80)
          : typeof r.value === "object" && r.value !== null
            ? (Array.isArray(r.value) ? `Array(${r.value.length})` : r.value.constructor?.name ?? "object")
            : String(r.value),
    };
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");
  console.log(`结果写入 ${OUTPUT_PATH}`);

  // 统计
  const canInline = results.filter((r) => r.canInline).length;
  const cannotInline = results.filter((r) => !r.canInline).length;
  console.log(`可内联: ${canInline}, 不可内联: ${cannotInline}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
