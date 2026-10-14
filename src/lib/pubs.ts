// 業績: researchmap と pubs.yaml を同じ形(Pub)にそろえて扱う
import type { Localized } from "./i18n";

export const PUB_TYPES = ["paper", "intl", "domestic", "award"] as const;
export type PubType = (typeof PUB_TYPES)[number];

export type Author = { name: string; /** 研究室メンバーの id(太字にする) */ member?: string };

export type Pub = {
  id: string;
  type: PubType;
  /** "2025"、"2025-04"、"2025-04-12" のいずれか */
  date: string;
  title: Localized<string>;
  authors: Localized<Author[]>;
  venue: Localized<string>;
  doi?: string;
  url?: string;
  themes: string[];
  source: "local" | "researchmap";
};

export const yearOf = (p: Pub) => Number(p.date.slice(0, 4));

/** 年ごとにまとめる。新しい年から、年の中も新しい順 */
export function groupByYear(pubs: Pub[], opts: { fromYear?: number } = {}) {
  const from = opts.fromYear ?? -Infinity;
  const map = new Map<number, Pub[]>();
  for (const p of [...pubs].sort((a, b) => b.date.localeCompare(a.date))) {
    const y = yearOf(p);
    if (y < from) continue;
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push(p);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]).map(([year, items]) => ({ year, items }));
}

export function countByType(pubs: Pub[]): Record<PubType | "all", number> {
  const counts = { all: pubs.length, paper: 0, intl: 0, domestic: 0, award: 0 };
  for (const p of pubs) counts[p.type]++;
  return counts;
}

/** 氏名の比較用の鍵。空白・大文字小文字・姓名の順の違いを無視する */
function nameKeys(name: string): Set<string> {
  const tokens = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return new Set([tokens.join(""), [...tokens].reverse().join("")]);
}

export function isSameName(a: string, b: string): boolean {
  const ka = nameKeys(a);
  for (const k of nameKeys(b)) if (ka.has(k)) return true;
  return false;
}

export type MemberNames = { id: string; names: string[] };

/** 著者のうち、研究室メンバーと氏名が一致する人に member を付ける */
export function markMembers(pub: Pub, members: MemberNames[]): Pub {
  const mark = (authors?: Author[]) =>
    authors?.map((a) => {
      if (a.member) return a;
      const m = members.find((m) => m.names.some((n) => isSameName(n, a.name)));
      return m ? { ...a, member: m.id } : a;
    });
  return { ...pub, authors: { ja: mark(pub.authors.ja), en: mark(pub.authors.en) } };
}

const normTitle = (s = "") =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

function dedupeKeys(p: Pub): string[] {
  const keys: string[] = [];
  if (p.doi) keys.push("doi:" + p.doi.toLowerCase());
  for (const t of [p.title.ja, p.title.en]) if (t) keys.push("title:" + normTitle(t));
  return keys;
}

/** pubs.yaml(local)と researchmap(remote)をまとめる。重複は先に出たもの(local 優先)を残す */
export function mergePubs(local: Pub[], remote: Pub[]): Pub[] {
  const seen = new Set<string>();
  const out: Pub[] = [];
  for (const p of [...local, ...remote]) {
    const keys = dedupeKeys(p);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(p);
  }
  return out;
}

export type Career = { name: Localized<string>; kana: string };

const toHiragana = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** 進路を読み仮名の五十音順に並べる */
export function sortCareers<T extends { kana: string }>(careers: T[]): T[] {
  return [...careers].sort((a, b) => toHiragana(a.kana).localeCompare(toHiragana(b.kana), "ja"));
}
