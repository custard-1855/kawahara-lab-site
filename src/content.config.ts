// コンテンツの定義。更新する人は src/content/ の Markdown と YAML だけを編集する
import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";
import { load } from "js-yaml";

/** 日本語は必須、英語は任意(無ければ日本語を表示する) */
const i18n = z.object({ ja: z.string(), en: z.string().optional() });

/** YAML の配列の各項目に、並び順から id を振る(書く人が id を考えなくて済むように) */
const indexed = (text: string) =>
  ((load(text) as Record<string, unknown>[] | null) ?? []).map((item, i) => ({
    id: String(i + 1),
    ...item,
  }));

const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(["note", "column"]), // 研究ノート / コラム
    tags: z.array(z.string()).default([]), // 日本語のタグ名。tags.yaml に登録が必要
    themes: z.array(z.string()).default([]), // themes の id
    author: z.string(), // members の id
    excerpt: z.string().optional(), // 無ければ本文の冒頭から作る
    draft: z.boolean().default(false),
  }),
});

const tags = defineCollection({
  loader: file("src/content/tags.yaml"),
  schema: z.object({ name: z.string() }), // id が URL に使う英字のスラッグ
});

const members = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/members" }),
  schema: ({ image }) =>
    z.object({
      name: i18n,
      role: z.enum(["faculty", "student", "alumni"]),
      title: i18n.optional(), // 教員の職位
      specialty: i18n.optional(), // 教員の専門
      bio: i18n.optional(), // 紹介文
      grade: z.enum(["B4", "M1", "M2", "D1", "D2", "D3"]).optional(),
      research: i18n.optional(), // 研究テーマ
      themes: z.array(z.string()).default([]),
      photo: image().optional(),
      thesis: z
        .object({
          year: z.number(), // 年度
          kind: z.enum(["bachelor", "master", "doctor"]),
          title: i18n,
        })
        .optional(),
      researchmap: z.string().optional(), // パーマリンク(例: g0000218011)
      links: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
      order: z.number().default(0),
    }),
});

const themes = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/themes" }),
  schema: z.object({
    order: z.number(),
    name: i18n,
    label: z.string(), // 英語の小さな見出し
    summary: i18n, // トップの一覧に出す1〜2行
    body: i18n, // 研究ページに出す説明
    keywords: z.array(z.string()).default([]),
  }),
});

const pubs = defineCollection({
  loader: file("src/content/pubs.yaml", { parser: indexed }),
  schema: z.object({
    type: z.enum(["paper", "intl", "domestic", "award"]),
    date: z.coerce.date(),
    authors: z.array(z.object({ name: z.string(), member: z.string().optional() })), // member があれば太字
    title: z.string(),
    venue: z.string(),
    doi: z.string().optional(),
    url: z.url().optional(),
    themes: z.array(z.string()).default([]),
  }),
});

const careers = defineCollection({
  loader: file("src/content/careers.yaml", { parser: indexed }),
  // 個人と結びつけないため、members とは別に企業名だけを持つ。kana で五十音順に並べる
  schema: z.object({ name: i18n, kana: z.string() }),
});

/** 言語ごとの固定ページの文言(ファイル名が ja / en) */
const home = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/home" }),
  schema: z.object({
    catchcopy: z.string(),
    lead: z.string(),
    researchLead: z.string(), // 研究ページのリード文
    guides: z.array(z.object({ title: z.string(), desc: z.string(), anchor: z.string() })),
    visitNote: z.string(),
  }),
});

const message = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/message" }),
  schema: z.object({
    title: z.string(),
    opening: z.string(), // 書き出し(大きく表示する)
    summary: z.string(), // トップに出す冒頭
    date: z.string(),
  }),
});

const join = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/join" }),
  schema: z.object({
    lead: z.string(),
    week: z.array(z.object({ name: z.string(), when: z.string(), desc: z.string() })),
    yearNote: z.string(),
    year: z.array(
      z.object({
        month: z.string(),
        title: z.string(),
        desc: z.string(),
        milestone: z.boolean().default(false),
      }),
    ),
    masterNote: z.string(),
    prepLead: z.string(),
    prep: z.array(z.object({ area: z.string(), items: z.array(z.string()) })),
    books: z.array(z.object({ kind: z.string(), title: z.string(), note: z.string() })),
    careersNote: z.string(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })),
    visit: z.object({ title: z.string(), body: z.string() }),
  }),
});

const access = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/access" }),
  schema: z.object({
    place: z.string(),
    address: z.array(z.string()),
    campusLink: z.object({ label: z.string(), url: z.url() }),
    routes: z.array(z.object({ station: z.string(), detail: z.string() })),
    inside: z.string(),
    contact: z.string(),
  }),
});

export const collections = {
  articles,
  tags,
  members,
  themes,
  pubs,
  careers,
  home,
  message,
  join,
  access,
};
