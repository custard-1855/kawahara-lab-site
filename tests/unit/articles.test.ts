// 記事: 要約の生成、ページ送り、関連記事の選び方
import { describe, expect, test } from "vitest";
import { excerptFrom, formatDate, paginate, relatedArticles } from "../../src/lib/articles";

describe("excerptFrom", () => {
  test("見出し・強調・数式・コード・HTMLコメントを除いて、本文の冒頭を返す", () => {
    const body = [
      "## はじめに",
      "",
      "<!-- メモ -->",
      "機械学習では**分布**の距離 $d(p, q)$ を測ります。",
      "",
      "```python",
      "print(1)",
      "```",
      "",
      "[リンク](https://example.com)も読む。",
    ].join("\n");
    expect(excerptFrom(body, 100)).toBe(
      "機械学習では分布の距離 d(p, q) を測ります。 リンクも読む。",
    );
  });

  test("ブロック数式は除く", () => {
    expect(excerptFrom("前。\n\n$$\nx = 1\n$$\n\n後。", 100)).toBe("前。 後。");
  });

  test("長いときは指定の文字数で切って … を付ける", () => {
    expect(excerptFrom("あいうえおかきくけこ", 5)).toBe("あいうえお…");
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, i) => i);

  test("10件ずつに分け、ページ番号は1から", () => {
    const pages = paginate(items, 10);
    expect(pages.map((p) => p.items.length)).toEqual([10, 10, 3]);
    expect(pages.map((p) => p.page)).toEqual([1, 2, 3]);
    expect(pages[0].lastPage).toBe(3);
  });

  test("0件でも1ページ目は作る(「該当なし」を出すため)", () => {
    expect(paginate([], 10)).toEqual([{ page: 1, lastPage: 1, items: [] }]);
  });
});

describe("relatedArticles", () => {
  const a = (id: string, date: string, tags: string[]) => ({ id, date: new Date(date), tags });
  const target = a("t", "2026-07-10", ["x", "y"]);
  const all = [
    target,
    a("new-untagged", "2026-09-01", []),
    a("one-tag-old", "2026-01-01", ["x"]),
    a("two-tags", "2025-01-01", ["x", "y"]),
    a("one-tag-new", "2026-08-01", ["y"]),
  ];

  test("自分を除き、共通のタグが多い順、同じなら新しい順に3件", () => {
    expect(relatedArticles(target, all, 3).map((x) => x.id)).toEqual([
      "two-tags",
      "one-tag-new",
      "one-tag-old",
    ]);
  });

  test("タグが同じ記事が足りなければ、新しい記事で埋める", () => {
    expect(relatedArticles(target, all, 4).map((x) => x.id)).toEqual([
      "two-tags",
      "one-tag-new",
      "one-tag-old",
      "new-untagged",
    ]);
  });
});

describe("formatDate", () => {
  test("日本時間の YYYY-MM-DD で表す", () => {
    expect(formatDate(new Date("2026-07-10"))).toBe("2026-07-10");
    expect(formatDate(new Date("2026-10-14T16:16:35Z"))).toBe("2026-10-15");
  });
});
