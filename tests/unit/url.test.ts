// 内部リンクの組み立て: base が "/" でも "/<repo>/" でも同じ書き方で正しい URL になるか
import { describe, expect, test } from "vitest";
import { joinBase, localePath, tagHref } from "../../src/lib/url";

describe("joinBase", () => {
  test.each([
    ["/", "/", "/"],
    ["/", "research/", "/research/"],
    ["/", "/research/", "/research/"],
    ["/kawahara-lab-site/", "/", "/kawahara-lab-site/"],
    ["/kawahara-lab-site/", "/research/", "/kawahara-lab-site/research/"],
    ["/kawahara-lab-site", "research/", "/kawahara-lab-site/research/"],
  ])("base=%s path=%s → %s", (base, path, expected) => {
    expect(joinBase(base, path)).toBe(expected);
  });

  test("末尾のスラッシュを補う", () => {
    expect(joinBase("/", "/research")).toBe("/research/");
  });

  test("ファイルへのパスにはスラッシュを足さない", () => {
    expect(joinBase("/repo/", "/favicon.svg")).toBe("/repo/favicon.svg");
    expect(joinBase("/repo/", "/404.html")).toBe("/repo/404.html");
  });

  test("ページ内リンク(#)とクエリを残す", () => {
    expect(joinBase("/repo/", "/join/#life")).toBe("/repo/join/#life");
    expect(joinBase("/repo/", "/join#life")).toBe("/repo/join/#life");
    expect(joinBase("/", "/publications/?dev")).toBe("/publications/?dev");
  });
});

describe("localePath", () => {
  test("日本語は接頭辞なし、英語は /en/ を付ける", () => {
    expect(localePath("ja", "/research/")).toBe("/research/");
    expect(localePath("en", "/research/")).toBe("/en/research/");
    expect(localePath("en", "/")).toBe("/en/");
  });
});

describe("tagHref", () => {
  test("タグのスラッグからタグページのパスを作る", () => {
    expect(tagHref("optimal-transport")).toBe("/articles/tag/optimal-transport/");
  });
});
