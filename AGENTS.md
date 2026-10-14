# AGENTS.md

川原研究室サイト(Astro 7、GitHub Pages)。仕様は `docs/spec.md`、更新手順は `README.md`。

- 開発サーバーは `npx astro dev --background`(止めるときは `astro dev stop`)
- 確認: `npm run check`(整形・astro check・Vitest)と `npm run test:e2e`(Playwright)
- 内部リンクは必ず `src/lib/url.ts` の `href()` を通す(base を付けるため。絶対パスの直書き禁止)
- 色・文字・余白は `src/styles/tokens.css` の変数だけを使う
- 未確定の内容は `[プレースホルダー]` のまま。存在しない人名や業績を作らない
- researchmap のフィールドは推測で書かない。`tests/fixtures/researchmap/` の実データで確かめる

Astro のドキュメント: https://docs.astro.build
