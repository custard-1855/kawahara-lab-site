// 内部リンクの組み立て。リンクはすべてここを通し、絶対パスを直接書かない
// (公開先が "/" でも "/<repo>/" でも動くように、base を必ず付ける)
import type { Lang } from "./i18n";

/** base とサイト内のパスをつなぐ。ページへのパスには末尾の "/" を補う */
export function joinBase(base: string, path: string): string {
  const b = base.endsWith("/") ? base : base + "/";
  const m = path.match(/^([^?#]*)(.*)$/)!;
  let p = m[1].replace(/^\/+/, "");
  const isFile = /\.[a-z0-9]+$/i.test(p);
  if (p !== "" && !isFile && !p.endsWith("/")) p += "/";
  return b + p + m[2];
}

/** 言語ごとのパス。日本語は接頭辞なし、英語は /en/ */
export function localePath(lang: Lang, path: string): string {
  const p = path.startsWith("/") ? path : "/" + path;
  return lang === "en" ? "/en" + p : p;
}

/** サイト内リンクの href。lang を渡すとその言語のページへ */
export function href(path: string, lang: Lang = "ja"): string {
  return joinBase(import.meta.env.BASE_URL, localePath(lang, path));
}

export const articleHref = (id: string) => `/articles/${id}/`;
export const categoryHref = (category: string) => `/articles/category/${category}/`;
export const tagHref = (slug: string) => `/articles/tag/${slug}/`;
/** 一覧の n ページ目(1ページ目は一覧そのもの) */
export const pageHref = (listPath: string, page: number) =>
  page === 1 ? listPath : `${listPath}page/${page}/`;
