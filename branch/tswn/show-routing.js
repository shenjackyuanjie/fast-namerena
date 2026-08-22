import { formatError } from "./show-utils.js";

/** @type {string[]} URL 参数名，值为 URL-safe Base64 编码后的原始对局输入 */
export const STATIC_INPUT_PARAM_NAMES = ["input", "replay", "data"];

/**
 * 从 URL-safe Base64 解码 UTF-8 原始输入。
 * @param {string} encoded
 * @returns {string}
 */
export function decodeBase64UrlUtf8(encoded) {
  const compact = encoded.trim();
  if (!compact) {
    throw new Error("URL 参数为空。");
  }
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(compact)) {
    throw new Error("不是合法的 URL-safe Base64。");
  }

  const base64 = compact.replace(/-/g, "+").replace(/_/g, "/");
  if (base64.length % 4 === 1) {
    throw new Error("Base64 长度不合法。");
  }

  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/**
 * 将 UTF-8 字符串编码成 URL-safe Base64。
 * @param {string} input
 * @returns {string}
 */
export function encodeBase64UrlUtf8(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * 为当前对局输入生成分享链接。
 * @param {string} rawInput
 * @param {{ href: string }} options
 * @returns {string}
 */
export function buildShowShareUrl(rawInput, { href }) {
  const url = new URL(href);
  for (const paramName of STATIC_INPUT_PARAM_NAMES) {
    url.searchParams.delete(paramName);
  }
  for (const paramName of ["engine", "runtime"]) {
    url.searchParams.delete(paramName);
  }
  url.searchParams.set("input", encodeBase64UrlUtf8(rawInput));
  url.hash = "";
  return url.href;
}

/**
 * 从 URL search 中读取静态对局输入参数。
 * @param {string} search
 * @returns {{ ok: true, input: string, paramName: string }|{ ok: false, message: string }|null}
 */
export function readStaticReplayInputFromSearch(search) {
  const params = new URLSearchParams(search);
  for (const paramName of STATIC_INPUT_PARAM_NAMES) {
    if (!params.has(paramName)) {
      continue;
    }
    try {
      return {
        ok: true,
        input: decodeBase64UrlUtf8(params.get(paramName) ?? ""),
        paramName,
      };
    } catch (error) {
      return {
        ok: false,
        message: `URL 参数 ${paramName} 解码失败：${formatError(error)}`,
      };
    }
  }
  return null;
}
