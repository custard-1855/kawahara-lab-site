// researchmap の公開 API から教員の業績を取り、Pub の形にそろえる。
// フィールド名と種別の判定は、2026-10-15 に取得した実際のレスポンスで確かめた
// (tests/fixtures/researchmap/)。presentations と awards はこの時点で0件だったため、まだ扱っていない
import type { Localized } from "./i18n";
import type { Pub, PubType } from "./pubs";

const API = "https://api.researchmap.jp";
const LIMIT = 100;

/** published_papers の1件(使うフィールドだけ) */
export type RmPaper = {
  "rm:id"?: string;
  paper_title?: Localized<string>;
  authors?: Localized<{ name: string }[]>;
  publication_date?: string;
  publication_name?: Localized<string>;
  volume?: string;
  number?: string;
  starting_page?: string;
  ending_page?: string;
  published_paper_type?: string | null;
  identifiers?: { doi?: string[]; issn?: string[] };
};

/** 種別の判定。表示しないもの(学位論文など)は null */
export function classifyPaper(item: RmPaper): PubType | null {
  switch (item.published_paper_type) {
    case "scientific_journal":
      return "paper";
    case "international_conference_proceedings":
      return "intl";
    case "research_society":
    case "symposium":
      return "domestic";
    case null:
    case undefined:
      // 種別が空の登録がある(IEICE ComEx のレターなど)。ISSN があれば論文誌とみなす
      return item.identifiers?.issn?.length ? "paper" : null;
    default:
      return null;
  }
}

function venueOf(item: RmPaper, lang: "ja" | "en"): string | undefined {
  const name = item.publication_name?.[lang];
  if (!name) return undefined;
  const parts = [name];
  if (item.volume) parts.push(`Vol. ${item.volume}`);
  if (item.number) parts.push(`No. ${item.number}`);
  if (item.starting_page) {
    parts.push(
      item.ending_page && item.ending_page !== item.starting_page
        ? `pp. ${item.starting_page}–${item.ending_page}`
        : `p. ${item.starting_page}`,
    );
  }
  return parts.join(", ");
}

/** researchmap の1件を Pub にする。種別を判定できなければ null */
export function normalizePaper(item: RmPaper): Pub | null {
  const type = classifyPaper(item);
  if (!type) return null;
  const doi = item.identifiers?.doi?.[0];
  const authors = (lang: "ja" | "en") => item.authors?.[lang]?.map((a) => ({ name: a.name }));
  return {
    id: `rm-${item["rm:id"]}`,
    type,
    date: item.publication_date ?? "",
    title: { ja: item.paper_title?.ja, en: item.paper_title?.en },
    authors: { ja: authors("ja"), en: authors("en") },
    venue: { ja: venueOf(item, "ja"), en: venueOf(item, "en") },
    doi,
    url: doi ? `https://doi.org/${doi}` : undefined,
    themes: [],
    source: "researchmap",
  };
}

type FetchLike = (url: string) => Promise<Response>;

/** published_papers を全件取る。limit と start でページを送る */
export async function fetchPublishedPapers(
  permalink: string,
  fetchImpl: FetchLike = fetch,
): Promise<RmPaper[]> {
  const all: RmPaper[] = [];
  for (let start = 1; ; start += LIMIT) {
    const url = `${API}/${permalink}/published_papers?limit=${LIMIT}&start=${start}`;
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`researchmap: ${url} が ${res.status} を返しました`);
    const body = (await res.json()) as { total_items?: number; items?: RmPaper[] };
    const items = body.items ?? [];
    all.push(...items);
    if (items.length < LIMIT || all.length >= (body.total_items ?? 0)) return all;
  }
}

/** src/data/researchmap-cache.json の形。fetchedAt は内容が最後に変わったときの取得日時 */
export type ResearchmapCache = {
  fetchedAt: string | null;
  sources: { permalink: string; papers: RmPaper[] }[];
};

/** キャッシュに残すフィールド(レスポンスの他の項目は捨てる) */
export function trimPaper(item: RmPaper): RmPaper {
  const keep = [
    "rm:id",
    "paper_title",
    "authors",
    "publication_date",
    "publication_name",
    "volume",
    "number",
    "starting_page",
    "ending_page",
    "published_paper_type",
  ] as const;
  const out: RmPaper = {};
  for (const k of keep) if (item[k] !== undefined) (out as Record<string, unknown>)[k] = item[k];
  if (item.identifiers) {
    out.identifiers = { doi: item.identifiers.doi, issn: item.identifiers.issn };
  }
  return out;
}
