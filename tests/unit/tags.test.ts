// タグ: 記事には日本語のタグ名を書き、tags.yaml でスラッグに対応させる
import { describe, expect, test } from "vitest";
import { createTagIndex } from "../../src/lib/tags";

const index = createTagIndex([
  { id: "optimal-transport", name: "最適輸送" },
  { id: "duality", name: "双対性" },
  { id: "sinkhorn", name: "Sinkhorn" },
]);

describe("createTagIndex", () => {
  test("タグ名からスラッグを引く", () => {
    expect(index.slugOf("最適輸送")).toBe("optimal-transport");
  });

  test("スラッグからタグ名を引く", () => {
    expect(index.nameOf("duality")).toBe("双対性");
  });

  test("未登録のタグは、記事名と直し方を添えてエラーにする", () => {
    expect(() => index.slugOf("最適化", "sinkhorn-distances")).toThrow(
      /「最適化」.*sinkhorn-distances.*tags\.yaml/,
    );
  });

  test("同じ名前が2回登録されていたらエラーにする", () => {
    expect(() =>
      createTagIndex([
        { id: "a", name: "最適輸送" },
        { id: "b", name: "最適輸送" },
      ]),
    ).toThrow(/最適輸送/);
  });

  test("tags.yaml の並び順を保つ", () => {
    expect(index.all().map((x) => x.id)).toEqual(["optimal-transport", "duality", "sinkhorn"]);
  });
});
