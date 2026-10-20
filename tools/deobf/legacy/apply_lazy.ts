/**
 * 应用 lazy 常量替换到 md5.js
 * 在 Bun 中运行: bun run apply_lazy.ts
 */

import * as fs from "fs";

const MD5_PATH = "D:\\githubs\\namer\\namerena.github.io\\md5.js";
const VALUES_PATH =
  "D:\\githubs\\namer\\fast-namerena\\branch\\latest\\lazy_values.json";
const BACKUP_PATH = "D:\\githubs\\namer\\namerena.github.io\\md5.js.bak";

interface LazyValue {
  getter: string;
  line: number;
  canInline: boolean;
  replacement: string;
  valuePreview: string;
}

async function main() {
  const values: Record<string, LazyValue> = JSON.parse(
    fs.readFileSync(VALUES_PATH, "utf-8"),
  );

  // 备份原文件
  fs.copyFileSync(MD5_PATH, BACKUP_PATH);
  console.log(`已备份到 ${BACKUP_PATH}`);

  let source = fs.readFileSync(MD5_PATH, "utf-8");
  let replacedCount = 0;

  // 对每个可内联的条目，找到并替换 return 语句
  for (const [name, info] of Object.entries(values)) {
    if (!info.canInline) continue;

    // 找到这个 lazy initializer 的代码块
    // 模式: u($, "name", "getter", function (...) { ... return expr; ... });
    const funcPattern = new RegExp(
      `u\\(\\$,\\s*"${name}",\\s*"${info.getter}",\\s*function\\s*\\([^)]*\\)\\s*\\{`,
      "m",
    );

    const funcMatch = funcPattern.exec(source);
    if (!funcMatch) {
      console.log(`  找不到 ${name} (${info.getter}) 的函数定义`);
      continue;
    }

    const funcStart = funcMatch.index + funcMatch[0].length;

    // 在函数体内找到 return 语句
    // 需要处理多行的情况
    let pos = funcStart;
    let braceDepth = 1;
    let returnStart = -1;
    let returnEnd = -1;

    for (let i = pos; i < source.length && braceDepth > 0; i++) {
      const ch = source[i];

      if (ch === "{") {
        braceDepth++;
        continue;
      }
      if (ch === "}") {
        braceDepth--;
        if (braceDepth === 0) {
          // 找到函数体的结束
          break;
        }
        continue;
      }

      if (returnStart === -1) {
        // 寻找 "return "
        if (
          source[i] === "r" &&
          source[i + 1] === "e" &&
          source[i + 2] === "t" &&
          source[i + 3] === "u" &&
          source[i + 4] === "r" &&
          source[i + 5] === "n" &&
          (source[i + 6] === " " || source[i + 6] === "\n" || source[i + 6] === "\r")
        ) {
          returnStart = i;
          i += 5; // 跳过 "return"
        }
        continue;
      }

      if (returnStart !== -1 && returnEnd === -1 && ch === ";") {
        // 需要确保这个分号不是字符串或正则内的
        returnEnd = i;
      }
    }

    if (returnStart === -1 || returnEnd === -1) {
      console.log(
        `  找不到 ${name} (${info.getter}) 的 return 语句`,
      );
      continue;
    }

    // 提取原始的 return 语句
    const oldReturn = source.substring(returnStart, returnEnd + 1);
    const indentMatch = oldReturn.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : "";

    // 构建替换
    const replacement = info.replacement;
    const newReturn = `${indent}return ${replacement};`;

    if (oldReturn === newReturn) {
      continue;
    }

    source =
      source.substring(0, returnStart) +
      newReturn +
      source.substring(returnEnd + 1);

    replacedCount++;
    console.log(
      `  ${name}: ${info.valuePreview.substring(0, 40)} -> ${replacement.substring(0, 60)}`,
    );
  }

  // 写入结果
  fs.writeFileSync(MD5_PATH, source, "utf-8");
  console.log(`\n替换了 ${replacedCount} 个 lazy initializer`);
  console.log(`写入 ${MD5_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
