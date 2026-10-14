// 多言語: 英語が無いときは日本語で代用する
import { describe, expect, test } from "vitest";
import { pick, t } from "../../src/lib/i18n";

describe("pick", () => {
  test("指定した言語の値を返す", () => {
    expect(pick({ ja: "研究", en: "Research" }, "en")).toBe("Research");
    expect(pick({ ja: "研究", en: "Research" }, "ja")).toBe("研究");
  });

  test("英語が無ければ日本語で代用する", () => {
    expect(pick({ ja: "研究" }, "en")).toBe("研究");
  });

  test("日本語が無ければ英語で代用する(researchmap の英語だけの業績)", () => {
    expect(pick({ en: "Title" }, "ja")).toBe("Title");
  });

  test("値が空文字なら、もう一方の言語を使う", () => {
    expect(pick({ ja: "研究", en: "" }, "en")).toBe("研究");
  });

  test("undefined はそのまま返す", () => {
    expect(pick(undefined, "ja")).toBeUndefined();
  });
});

describe("t", () => {
  test("キーごとの文言を言語で引く", () => {
    expect(t("ja", "nav.research")).toBe("研究");
    expect(t("en", "nav.research")).toBe("Research");
  });
});
