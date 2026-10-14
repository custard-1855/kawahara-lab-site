// コンテンツの読み出し。ページはここを通してデータを取る(検証と結合もここで行う)
import { getCollection, getEntry, type CollectionEntry } from "astro:content";
import cache from "../data/researchmap-cache.json";
import { byDateDesc, excerptFrom } from "./articles";
import type { Lang } from "./i18n";
import { markMembers, mergePubs, sortCareers, type Pub } from "./pubs";
import { normalizePaper, type ResearchmapCache } from "./researchmap";
import { createTagIndex, type TagIndex } from "./tags";

export type Member = CollectionEntry<"members">;
export type Theme = CollectionEntry<"themes">;

export type Article = {
  id: string;
  entry: CollectionEntry<"articles">;
  title: string;
  date: Date;
  category: "note" | "column";
  /** タグのスラッグ(tags.yaml の id) */
  tags: string[];
  themes: string[];
  author: Member;
  excerpt: string;
};

let tagIndex: TagIndex | undefined;
export async function getTagIndex(): Promise<TagIndex> {
  tagIndex ??= createTagIndex((await getCollection("tags")).map((t) => ({ id: t.id, ...t.data })));
  return tagIndex;
}

export async function getMembers(): Promise<Member[]> {
  return (await getCollection("members")).sort(
    (a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id),
  );
}

export async function getThemes(): Promise<Theme[]> {
  return (await getCollection("themes")).sort((a, b) => a.data.order - b.data.order);
}

/** 記事(新しい順)。本番では下書きを除く。タグと著者が登録済みかを確かめる */
export async function getArticles(): Promise<Article[]> {
  const tags = await getTagIndex();
  const members = await getMembers();
  const entries = await getCollection("articles", (e) => import.meta.env.DEV || !e.data.draft);
  return entries
    .map((entry) => {
      const author = members.find((m) => m.id === entry.data.author);
      if (!author) {
        throw new Error(
          `記事 ${entry.id} の著者「${entry.data.author}」が src/content/members/ にいません。`,
        );
      }
      return {
        id: entry.id,
        entry,
        title: entry.data.title,
        date: entry.data.date,
        category: entry.data.category,
        tags: entry.data.tags.map((name) => tags.slugOf(name, entry.id)),
        themes: entry.data.themes,
        author,
        excerpt: entry.data.excerpt ?? excerptFrom(entry.body ?? ""),
      };
    })
    .sort(byDateDesc);
}

/** researchmap の取得日時(内容が最後に変わったとき)。未取得なら null */
export const researchmapFetchedAt = (cache as ResearchmapCache).fetchedAt;

/** 業績: pubs.yaml と researchmap のキャッシュをまとめ、研究室メンバーに印を付ける */
export async function getPubs(): Promise<Pub[]> {
  const members = await getMembers();
  const names = members.map((m) => ({
    id: m.id,
    names: [m.data.name.ja, m.data.name.en].filter((n): n is string => !!n),
  }));
  const local: Pub[] = (await getCollection("pubs")).map((e) => ({
    id: `local-${e.id}`,
    type: e.data.type,
    date: e.data.date.toISOString().slice(0, 10),
    title: { ja: e.data.title },
    authors: { ja: e.data.authors },
    venue: { ja: e.data.venue },
    doi: e.data.doi,
    url: e.data.url ?? (e.data.doi ? `https://doi.org/${e.data.doi}` : undefined),
    themes: e.data.themes,
    source: "local",
  }));
  // キャッシュは教員の members/*.yaml の researchmap と一致するものだけを使う
  const permalinks = new Set(members.map((m) => m.data.researchmap).filter(Boolean));
  const remote = (cache as ResearchmapCache).sources
    .filter((s) => permalinks.has(s.permalink))
    .flatMap((s) => s.papers)
    .map(normalizePaper)
    .filter((p): p is Pub => p !== null);
  return mergePubs(local, remote).map((p) => markMembers(p, names));
}

export async function getCareers() {
  return sortCareers((await getCollection("careers")).map((e) => e.data));
}

/** 言語ごとの固定ページの文言 */
export async function getPage<C extends "home" | "join" | "access" | "message">(
  collection: C,
  lang: Lang,
) {
  const entry = await getEntry(collection, lang);
  if (!entry) throw new Error(`src/content/${collection}/${lang} がありません。`);
  return entry;
}
