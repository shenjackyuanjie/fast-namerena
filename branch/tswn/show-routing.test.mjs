import test from "node:test";
import assert from "node:assert/strict";

import {
  buildShowShareUrl,
  decodeBase64UrlUtf8,
  encodeBase64UrlUtf8,
  readStaticReplayInputFromSearch,
} from "./show-routing.js";

test("show routing decodes static replay input aliases", () => {
  const rawInput = "seed: fixed\nleft@red\n\nright@blue\n";
  const encoded = encodeBase64UrlUtf8(rawInput);

  assert.equal(decodeBase64UrlUtf8(encoded), rawInput);
  assert.deepEqual(readStaticReplayInputFromSearch(`?replay=${encoded}`), {
    ok: true,
    input: rawInput,
    paramName: "replay",
  });
});

test("show routing reports invalid static replay input", () => {
  const result = readStaticReplayInputFromSearch("?input=*not-base64*");

  assert.equal(result?.ok, false);
  assert.match(result?.message ?? "", /URL 参数 input 解码失败/);
  assert.match(result?.message ?? "", /URL-safe Base64/);
});

test("show share URL removes obsolete runtime selection", () => {
  const rawInput = "left@red\n\nright@blue\n";
  const shareUrl = buildShowShareUrl(rawInput, {
    href: "https://example.test/index.html?runtime=runtime&data=old#section",
  });

  const parsed = new URL(shareUrl);
  assert.equal(parsed.hash, "");
  assert.equal(parsed.searchParams.has("runtime"), false);
  assert.equal(parsed.searchParams.has("engine"), false);
  assert.equal(parsed.searchParams.has("data"), false);
  assert.equal(decodeBase64UrlUtf8(parsed.searchParams.get("input") ?? ""), rawInput);
});
