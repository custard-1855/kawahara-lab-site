// @ts-check
import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

// 公開先の URL は環境変数で切り替える。
//   ユーザー/Organization のサイト(https://<org>.github.io/)      → SITE_BASE=/
//   リポジトリのサイト(https://<user>.github.io/<repo>/)          → SITE_BASE=/<repo>/
const site = process.env.SITE_URL ?? "https://custard-1855.github.io";
const base = process.env.SITE_BASE ?? "/kawahara-lab-site/";

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "always",
  i18n: {
    defaultLocale: "ja",
    locales: ["ja", "en"],
    routing: { prefixDefaultLocale: false },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
    shikiConfig: { theme: "github-dark" },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: "ja", locales: { ja: "ja", en: "en" } },
    }),
  ],
});
