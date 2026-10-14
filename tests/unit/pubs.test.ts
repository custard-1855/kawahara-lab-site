// 業績: 年ごとのまとめ、件数、研究室メンバーの太字、名寄せ、進路の並び
import { describe, expect, test } from "vitest";
import {
  countByType,
  groupByYear,
  isSameName,
  markMembers,
  mergePubs,
  sortCareers,
  type Pub,
} from "../../src/lib/pubs";

const pub = (over: Partial<Pub>): Pub => ({
  id: "x",
  type: "paper",
  date: "2025",
  title: { en: "A Title" },
  authors: { en: [{ name: "Ryoichi Kawahara" }] },
  venue: { en: "Venue" },
  themes: [],
  source: "researchmap",
  ...over,
});

describe("groupByYear", () => {
  test("新しい年から並べ、年の中も新しい順", () => {
    const groups = groupByYear([
      pub({ id: "a", date: "2024-03" }),
      pub({ id: "b", date: "2025" }),
      pub({ id: "c", date: "2024-11-02" }),
    ]);
    expect(groups.map((g) => g.year)).toEqual([2025, 2024]);
    expect(groups[1].items.map((p) => p.id)).toEqual(["c", "a"]);
  });

  test("fromYear より前の年は除く", () => {
    const groups = groupByYear([pub({ date: "2016" }), pub({ date: "2017" })], { fromYear: 2017 });
    expect(groups.map((g) => g.year)).toEqual([2017]);
  });
});

describe("countByType", () => {
  test("種別ごとの件数と合計", () => {
    expect(
      countByType([pub({ type: "paper" }), pub({ type: "intl" }), pub({ type: "intl" })]),
    ).toEqual({
      all: 3,
      paper: 1,
      intl: 2,
      domestic: 0,
      award: 0,
    });
  });
});

describe("isSameName", () => {
  test.each([
    ["Ryoichi Kawahara", "Kawahara Ryoichi"],
    ["Ryoichi Kawahara", "ryoichi  kawahara"],
    ["川原 亮一", "川原亮一"],
    ["川原 亮一", "川原　亮一"],
    ["Ryoichi Kawahara", "Ryoichi KAWAHARA"],
  ])("%s と %s は同じ人", (a, b) => {
    expect(isSameName(a, b)).toBe(true);
  });

  test.each([
    ["Ryoichi Kawahara", "Ryo Kawahara"],
    ["川原 亮一", "川原 亮"],
  ])("%s と %s は別の人", (a, b) => {
    expect(isSameName(a, b)).toBe(false);
  });
});

describe("markMembers", () => {
  const members = [
    { id: "kawahara", names: ["川原 亮一", "Ryoichi Kawahara"] },
    { id: "takemoto", names: ["竹本 志恩", "Shion Takemoto"] },
  ];

  test("氏名が一致した著者に member を付ける(日本語・英語の両方)", () => {
    const p = markMembers(
      pub({
        authors: {
          ja: [{ name: "田中 太郎" }, { name: "川原亮一" }],
          en: [{ name: "Taro Tanaka" }, { name: "Kawahara Ryoichi" }],
        },
      }),
      members,
    );
    expect(p.authors.ja?.map((a) => a.member)).toEqual([undefined, "kawahara"]);
    expect(p.authors.en?.map((a) => a.member)).toEqual([undefined, "kawahara"]);
  });

  test("pubs.yaml で member が指定済みなら、そのまま使う", () => {
    const p = markMembers(
      pub({ source: "local", authors: { ja: [{ name: "竹本", member: "takemoto" }] } }),
      members,
    );
    expect(p.authors.ja?.[0].member).toBe("takemoto");
  });
});

describe("mergePubs", () => {
  test("DOI が同じものは pubs.yaml 側を残す(DOI の大文字小文字は区別しない)", () => {
    const local = [pub({ id: "l", source: "local", doi: "10.1/ABC" })];
    const remote = [
      pub({ id: "r", doi: "10.1/abc", title: { en: "Same paper, different title" } }),
      pub({ id: "r2", doi: "10.1/other", title: { en: "Another paper" } }),
    ];
    expect(mergePubs(local, remote).map((p) => p.id)).toEqual(["l", "r2"]);
  });

  test("DOI が無ければ、正規化したタイトルで名寄せする", () => {
    const local = [pub({ id: "l", source: "local", title: { ja: "A Study of  Graphs." } })];
    const remote = [pub({ id: "r", title: { en: "a study of graphs" } })];
    expect(mergePubs(local, remote).map((p) => p.id)).toEqual(["l"]);
  });

  test("researchmap の中の重複(同じ DOI の登録が2件)も1件にする", () => {
    const remote = [pub({ id: "r1", doi: "10.1/x" }), pub({ id: "r2", doi: "10.1/x" })];
    expect(mergePubs([], remote).map((p) => p.id)).toEqual(["r1"]);
  });
});

describe("sortCareers", () => {
  test("読み仮名の五十音順に並べる", () => {
    const sorted = sortCareers([
      { name: { ja: "日本電気" }, kana: "にっぽんでんき" },
      { name: { ja: "アクセンチュア" }, kana: "あくせんちゅあ" },
      { name: { ja: "KDDI" }, kana: "けーでぃーでぃーあい" },
    ]);
    expect(sorted.map((c) => c.name.ja)).toEqual(["アクセンチュア", "KDDI", "日本電気"]);
  });

  test("カタカナで書いた読み仮名も同じ順で並べる", () => {
    const sorted = sortCareers([
      { name: { ja: "B" }, kana: "ビー" },
      { name: { ja: "A" }, kana: "えー" },
    ]);
    expect(sorted.map((c) => c.name.ja)).toEqual(["A", "B"]);
  });
});
