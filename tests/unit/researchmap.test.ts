// researchmap: 実際のレスポンス(tests/fixtures/researchmap/、2026-10-15 取得)を入力にして確かめる
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  classifyPaper,
  fetchPublishedPapers,
  normalizePaper,
  trimPaper,
  type RmPaper,
} from "../../src/lib/researchmap";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/researchmap/${name}`, import.meta.url), "utf8"));
const page1 = fixture("published_papers-1.json");
const page2 = fixture("published_papers-2.json");
const items: RmPaper[] = [...page1.items, ...page2.items];
const byId = (id: string) => items.find((x) => x["rm:id"] === id)!;

describe("classifyPaper", () => {
  test("論文誌は paper、国際会議は intl", () => {
    expect(classifyPaper({ published_paper_type: "scientific_journal" })).toBe("paper");
    expect(classifyPaper({ published_paper_type: "international_conference_proceedings" })).toBe(
      "intl",
    );
  });

  test("研究会・シンポジウムは domestic", () => {
    expect(classifyPaper({ published_paper_type: "research_society" })).toBe("domestic");
    expect(classifyPaper({ published_paper_type: "symposium" })).toBe("domestic");
  });

  test("種別が空でも ISSN があれば論文誌として paper(IEICE ComEx など)", () => {
    expect(
      classifyPaper({ published_paper_type: null, identifiers: { issn: ["2187-0136"] } }),
    ).toBe("paper");
  });

  test("判定できないものは null(表示しない)", () => {
    expect(classifyPaper({ published_paper_type: null })).toBeNull();
    expect(classifyPaper({ published_paper_type: "master_thesis" })).toBeNull();
  });

  test("実データの全件が、表示しない分を含めて判定できる", () => {
    const types = items.map(classifyPaper);
    expect(types.filter((x) => x === "paper").length).toBeGreaterThan(50);
    expect(types.filter((x) => x === "intl").length).toBeGreaterThan(60);
  });
});

describe("normalizePaper", () => {
  test("英語だけの論文誌: 巻・号・ページを会場名にまとめ、DOI を取り出す", () => {
    const p = normalizePaper(byId("51568455"))!;
    expect(p).toMatchObject({
      id: "rm-51568455",
      type: "paper",
      date: "2025-04",
      title: {
        en: "Optimization of Data and Model Transfer for Federated Learning to Manage Large-Scale Network.",
      },
      venue: {
        en: "IEEE Transactions on Network and Service Management, Vol. 22, No. 2, pp. 958–973",
      },
      doi: "10.1109/TNSM.2025.3538156",
      source: "researchmap",
      themes: [],
    });
    expect(p.authors.en?.map((a) => a.name)).toEqual(["Kengo Tajiri", "Ryoichi Kawahara"]);
    expect(p.authors.ja).toBeUndefined();
  });

  test("日本語と英語の両方があれば両方持つ", () => {
    const jp = items.find((x) => x.paper_title?.ja && x.authors?.ja)!;
    const p = normalizePaper(jp)!;
    expect(p.title.ja).toBe(jp.paper_title!.ja);
    expect(p.authors.ja?.length).toBe(jp.authors!.ja!.length);
    expect(p.title.en).toBe(jp.paper_title!.en);
  });

  test("ページが無ければ pp. を付けない", () => {
    const p = normalizePaper({
      "rm:id": "1",
      paper_title: { en: "T" },
      publication_name: { en: "Conf" },
      publication_date: "2020",
      published_paper_type: "international_conference_proceedings",
    })!;
    expect(p.venue.en).toBe("Conf");
  });

  test("種別を判定できないものは null", () => {
    expect(normalizePaper({ "rm:id": "1", published_paper_type: null })).toBeNull();
  });
});

describe("fetchPublishedPapers", () => {
  test("limit と start でページを送り、全件を集める", async () => {
    const urls: string[] = [];
    const fakeFetch = async (url: string) => {
      urls.push(url);
      const start = Number(new URL(url).searchParams.get("start"));
      return new Response(JSON.stringify(start === 1 ? page1 : page2));
    };
    const all = await fetchPublishedPapers("g0000218011", fakeFetch);
    expect(all.length).toBe(page1.total_items);
    expect(urls).toEqual([
      "https://api.researchmap.jp/g0000218011/published_papers?limit=100&start=1",
      "https://api.researchmap.jp/g0000218011/published_papers?limit=100&start=101",
    ]);
  });

  test("HTTP エラーなら例外を投げる(呼び出し側はキャッシュを残す)", async () => {
    const fakeFetch = async () => new Response("", { status: 503 });
    await expect(fetchPublishedPapers("x", fakeFetch)).rejects.toThrow(/503/);
  });
});

describe("trimPaper", () => {
  test("表示と判定に使うフィールドだけを残す", () => {
    const trimmed = trimPaper(byId("51568455"));
    expect(Object.keys(trimmed).sort()).toEqual(
      [
        "authors",
        "ending_page",
        "identifiers",
        "number",
        "paper_title",
        "publication_date",
        "publication_name",
        "published_paper_type",
        "rm:id",
        "starting_page",
        "volume",
      ].sort(),
    );
    expect(normalizePaper(trimmed)).toEqual(normalizePaper(byId("51568455")));
  });
});
