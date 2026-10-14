// researchmap から教員の業績を取り、src/data/researchmap-cache.json を更新する。
// 使い方: npm run fetch:researchmap
// 取得に失敗したらキャッシュは変えずに終了コード1で終わる(ビルドはキャッシュで続けられる)
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { load } from "js-yaml";
import { fetchPublishedPapers, trimPaper, type ResearchmapCache } from "../src/lib/researchmap.ts";

const CACHE = new URL("../src/data/researchmap-cache.json", import.meta.url);
const MEMBERS = new URL("../src/content/members/", import.meta.url);

const permalinks = readdirSync(MEMBERS)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => load(readFileSync(new URL(f, MEMBERS), "utf8")) as { researchmap?: string })
  .map((m) => m.researchmap)
  .filter((p): p is string => !!p);

if (permalinks.length === 0) {
  console.log("researchmap のパーマリンクを持つメンバーがいないため、取得をスキップします。");
  process.exit(0);
}

const old = JSON.parse(readFileSync(CACHE, "utf8")) as ResearchmapCache;
try {
  const sources = [];
  for (const permalink of permalinks) {
    const papers = (await fetchPublishedPapers(permalink)).map(trimPaper);
    console.log(`${permalink}: ${papers.length} 件`);
    sources.push({ permalink, papers });
  }
  if (JSON.stringify(sources) === JSON.stringify(old.sources)) {
    console.log("前回から変わっていないため、キャッシュは更新しません。");
  } else {
    const next: ResearchmapCache = { fetchedAt: new Date().toISOString(), sources };
    writeFileSync(CACHE, JSON.stringify(next, null, 1) + "\n");
    console.log("キャッシュを更新しました。");
  }
} catch (e) {
  console.error("researchmap の取得に失敗しました。キャッシュはそのまま使います。");
  console.error(e);
  process.exit(1);
}
