// 記事まわりの計算(Astro に依存しない部分)

/** Markdown の本文から、要約に使う冒頭の文を作る */
export function excerptFrom(body: string, max = 120): string {
  const text = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\$\$[\s\S]*?\$\$/g, "")
    .replace(/<[^>]+>/g, "")
    .split(/\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join("\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|`)/g, "")
    .replace(/\$([^$]*)\$/g, "$1")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .join(" ");
  const chars = [...text];
  return chars.length > max ? chars.slice(0, max).join("") + "…" : text;
}

export type Page<T> = { page: number; lastPage: number; items: T[] };

/** perPage 件ずつに分ける。0件でも1ページ目は返す */
export function paginate<T>(items: T[], perPage: number): Page<T>[] {
  const lastPage = Math.max(1, Math.ceil(items.length / perPage));
  return Array.from({ length: lastPage }, (_, i) => ({
    page: i + 1,
    lastPage,
    items: items.slice(i * perPage, (i + 1) * perPage),
  }));
}

type Relatable = { id: string; date: Date; tags: string[] };

/** 関連記事: 共通のタグが多い順、同じなら新しい順。足りなければ新しい記事で埋める */
export function relatedArticles<T extends Relatable>(target: T, all: T[], n = 3): T[] {
  const shared = (x: T) => x.tags.filter((tag) => target.tags.includes(tag)).length;
  return all
    .filter((x) => x.id !== target.id)
    .map((x) => ({ x, score: shared(x) }))
    .sort((a, b) => b.score - a.score || b.x.date.getTime() - a.x.date.getTime())
    .slice(0, n)
    .map(({ x }) => x);
}

/** 新しい順 */
export const byDateDesc = <T extends { date: Date }>(a: T, b: T) =>
  b.date.getTime() - a.date.getTime();

/** 日付を YYYY-MM-DD(日本時間)で表す */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(date);
}
