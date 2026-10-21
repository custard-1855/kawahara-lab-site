# 川原研究室サイト 実装初期仕様

Oct 14, 2026 · @Custard(Oct 15, 2026 改訂:初期仕様の詰めの結果を反映)

この文書が仕様の正本。仕様を変えるときは、この文書を Pull Request で直す(Claude Docs の旧版は更新を止め、ここへのリンクだけにした)。

デザイン案A'を、AstroでGitHub Pagesにデプロイできるサイトとして実装する。この文書だけで実装を始められるよう、決定事項をまとめる。

## 目的とスコープ

研究室を選ぶ段階の学部生が、研究内容と研究室生活を把握できる静的サイトを作る。日本語と英語に対応し、GitHub Pagesで公開する。

**MVPに含めるもの**

- 9ページ:トップ、研究、メンバー、業績、記事一覧、記事ページ、配属希望の方へ、メッセージ、アクセス
- 記事のMarkdown執筆(数式・コード対応)と、タグ・分類ごとの一覧
- メンバーと学生の業績をYAMLで管理
- 先生の業績をresearchmapから取得(週1回、キャッシュに保存)
- 英語版(固定ページのみ)
- GitHub Actionsによる自動デプロイと週一回の再ビルド
- 更新手順を書いたREADME

**MVPに含めないもの**

- 問い合わせフォーム、見学・面談の申し込み機能(窓口が未決のため、プレースホルダーのみ)
- 記事の英語訳、サイト内検索、コメント機能、アクセス解析
- トップモーションの新規制作(作成済みのものを組み込むだけ)
- アクセスページの地図(INIADのアクセスページへ誘導する)
- 展示(akabane2026)の参加証ページやスマホ向けアプリ。展示の特設サイトは akabane2026 リポジトリで別に作る

本文や氏名など未確定の内容は `[プレースホルダー]` のまま実装し、後から差し替える。存在しない人名や業績を作らないこと。実データとして入れるのは、川原先生(氏名、職位、所属、researchmapの業績)と竹本さん(M1、ブログ・Cosense・GitHubへのリンク)だけとする。先生の写真は使わない。

**期限と段階**

- 2026-10-19(月)に、先生に見せるレビュー版をGitHub Pagesで公開する。内容はプレースホルダーでよい
- 間に合わないときは、英語版、researchmapの実データ、Playwrightのテストの順に後回しにする

## リポジトリと公開先

- 新しい公開リポジトリ `custard-1855/kawahara-lab-site` に置く。akabane2026 とは分ける(研究室サイトは後輩が何年も保守し、展示は一回きりのため)
- 公開URLは `https://custard-1855.github.io/kawahara-lab-site/`(`base` は `/kawahara-lab-site/`)
- 先生の確認後に研究室のOrganizationへ移転する。`site` と `base` はワークフローがPagesの設定から取るので、移転しても書き換えは要らない
- 無料プランでGitHub Pagesを使うため、リポジトリは公開する。プレースホルダーに実在しない人名や業績を書かないので、公開しても問題ない

## 技術スタック

Astroの標準機能を中心に組み、依存を最小限にする。後輩が引き継ぐことを前提に、読めば分かる構成を優先する。

| 役割 | 採用するもの | 備考 |
| --- | --- | --- |
| フレームワーク | Astro 7 + TypeScript(`astro/tsconfigs/strict`) | `output: 'static'`、`trailingSlash: 'always'` |
| スタイル | 素のCSS + CSS変数 + Astroのscoped style | TailwindやCSS-in-JSは使わない |
| コンテンツ | Content Collections(`glob` / `file` loader) | スキーマはzod(`astro/zod`)で定義 |
| Markdown | `@astrojs/markdown-remark` の `unified()` | Astro 7 の既定(Sätteri)ではなく、remark/rehype のプラグインを使うため |
| 数式 | remark-math + rehype-katex | KaTeXのCSSを記事レイアウトで読み込む |
| コードの色付け | Shiki(Astro標準) | テーマは `github-dark`。背景は `--color-code-bg` で上書き |
| 多言語 | Astroのi18nルーティング | 日本語が既定 |
| フォント | FontsourceのIBM Plex Sans JP / IBM Plex Mono | セルフホスト |
| 画像 | `astro:assets` | メンバー写真など |
| SEO | `@astrojs/sitemap`、OGPメタタグ | OGP画像は `public/og.png`(仮) |
| YAML | js-yaml | `file` loader の配列に id を振るため |
| コード整形 | Prettier(prettier-plugin-astro) | 　 |
| テスト | Vitest(処理)、Playwright(受け入れ基準) | 後述 |
| パッケージ管理 | npm、Node.js 24 LTS | 引き継ぎやすさを優先 |
| デプロイ | GitHub Actions(`configure-pages` / `upload-pages-artifact` / `deploy-pages`) | GitHub PagesのSourceを「GitHub Actions」にする |

クライアント側のJavaScriptは、**トップのHeroと業績ページの絞り込み**だけに使う。どちらも `<script>` で読み込み、ReactなどのUIフレームワークとislandは入れない。JavaScriptが無効でもページは読める。

## ディレクトリ構成とURL

英語版は `/en/` 配下に同じ構成で置く。記事は日本語のみ。

```text
.
├ .github/workflows/site.yml
├ astro.config.mjs
├ docs/           spec.md(この文書)、mockups/(案A'のモックアップ)
├ scripts/        fetch-researchmap.ts
├ src/
│  ├ components/   Header, Footer, LangSwitch, Section, PageHead, ListRow, PillLink, Button, Pagination, PubEntry, Hero
│  ├ layouts/      BaseLayout.astro, ArticleLayout.astro
│  ├ views/        ページ本体(lang を受け取る。日英で共通)
│  ├ content/
│  │  ├ articles/  <slug>.md
│  │  ├ members/   <id>.yaml
│  │  ├ themes/    <id>.yaml
│  │  ├ tags.yaml  タグ名と英字スラッグの対応
│  │  ├ pubs.yaml  学生の業績
│  │  ├ careers.yaml 進路(企業名と読み仮名)
│  │  └ home/, message/, join/, access/  固定ページの文言(ja / en)
│  ├ content.config.ts
│  ├ data/         researchmap-cache.json
│  ├ hero/         トップのモーション(ネットワークのトポロジとパケット)
│  ├ i18n/         ui.ts(ナビなどの文言)
│  ├ lib/          url.ts, i18n.ts, tags.ts, articles.ts, pubs.ts, researchmap.ts, content.ts
│  ├ pages/        下の表を参照(views を呼ぶ薄いファイル)
│  ├ styles/       tokens.css, base.css
│  └ site.config.ts 窓口のURL、業績を出す最初の年など
├ public/         favicon.svg, og.png
├ tests/          unit/, e2e/, fixtures/researchmap/
└ README.md
```

| ページ | URL(日本語) | 英語版 |
| --- | --- | --- |
| トップ | `/` | `/en/` |
| 研究 | `/research/` | `/en/research/` |
| メンバー | `/members/` | `/en/members/` |
| 業績 | `/publications/` | `/en/publications/` |
| 記事一覧 | `/articles/`、`/articles/page/2/` | なし |
| 分類別 | `/articles/category/note/`、`/articles/category/column/`(10件を超えたら `.../page/2/`) | なし |
| タグ別 | `/articles/tag/<スラッグ>/`(同上) | なし |
| 記事ページ | `/articles/<slug>/` | なし |
| 配属希望の方へ | `/join/` | `/en/join/` |
| メッセージ | `/message/` | `/en/message/` |
| アクセス | `/access/` | `/en/access/` |
| 404 | `/404.html` | 共通(日英併記) |

- タグのURLには、`tags.yaml` で決めた英字のスラッグを使う。記事のfrontmatterには日本語のタグ名を書き、未登録のタグがあればビルドをエラーで止める
- 英語版の記事リンクは日本語の記事へ飛ばし、「Japanese only」と表示する
- 内部リンクはすべて `lib/url.ts` のヘルパー経由で生成し、`import.meta.env.BASE_URL` を付ける(絶対パスの直書き禁止)

## デザイントークンと共通コンポーネント

下の値を `styles/tokens.css` にCSS変数として定義し、コンポーネントでは変数だけを使う。モチーフ(ネットワークのトポロジ)はトップのヒーローだけに使い、他のページは余白と文字だけで構成する。輸送多面体のSVGは使わない(動くトポロジと重ねると情報が多すぎ、研究テーマにも最適輸送を含めないため)。

```css
:root {
  /* 色 */
  --color-bg: #FFFFFF;
  --color-surface: #F4F6F9;   /* モーション枠、入口カード、フッター */
  --color-text: #1B2230;      /* 真っ黒は使わない */
  --color-text-sub: #5B6372;  /* ラベル、日付、説明 */
  --color-text-body2: #3A4252; /* カードの中の本文 */
  --color-line: #E3E6EB;      /* 罫線 */
  --color-line-strong: #CBD1DA; /* タイムラインの線 */
  --color-navy: #0F2547;      /* プライマリボタン、選択中 */
  --color-link: #0A5BB8;      /* INIADの青の代用(要確認) */
  --color-code-bg: #0F1A2E;
  --color-code-text: #DCE3EE;
  /* 文字 */
  --font-sans: 'IBM Plex Sans JP', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
  --font-size-body: 16px;
  --line-height-body: 1.9;
  --letter-spacing-body: 0.03em;
  --font-size-h1: 34px;   /* トップのキャッチコピーは36px */
  --font-size-h2: 22px;
  --heading-weight: 500;  /* 見出しを太字にしない */
  --measure: 40em;        /* 読み物の1行の最大幅 */
  /* レイアウト */
  --container: 1120px;
  --gutter: 32px;         /* 幅640px以下では16px */
  --section-gap: 128px;   /* セクション間。幅640px以下では88px */
  --radius-card: 16px;
  --radius-hero: 20px;
  --radius-pill: 999px;
  --tap-min: 44px;
}
```

区切りは罫線と余白で表し、影やグラデーションは使わない。カード(面の色)は入口の案内だけに使う。スクロールアニメーションも入れない。サイトは明るい配色だけにする(ダークモードは作らない)。

| コンポーネント | 役割 |
| --- | --- |
| `Header` | サイト名(川原研究室 / Kawahara Lab)、ナビ(研究・メンバー・業績・記事・配属希望の方へ)、`LangSwitch`。現在ページは紺の下線 + `aria-current`。スマホでは折り返す |
| `Section` | 左にH2と英語ラベル(Mono 12px)、右に内容。`flex-wrap` で左は `1 1 200px`、右は `999 1 560px`。スマホでは縦に並ぶ。全ページでこの型を使う |
| `PageHead` | 各ページの冒頭(英語ラベル、H1、リード文) |
| `ListRow` | 罫線で区切る1行(日付・本文・メタ)。記事、業績、メンバー、研究テーマで共通 |
| `PillLink` | ページ内の移動や絞り込み。通常は面の色、選択中は紺地に白文字 |
| `Button` | 紺地・白文字・角丸999px。1ページにつき最大でも1つ |
| `Hero` | トップのみ。角丸20pxの面の中に作成済みのモーション(下記)。`prefers-reduced-motion` で静止する |
| `Footer` | 面の色。研究室名、所属、所在地、アクセス・問い合わせ・GitHubへのリンク |

リンクやボタンのクリック範囲は高さ44px以上。フォーカスリングは消さない。

**Hero(トップのモーション)**

- 研究室サイト独自のもの(`src/hero/`)。用語は `GLOSSARY.md`
- トポロジを3次元で回し、16秒ごとに STAR → RING → TREE → WIRELESS MESH の順に切り替える。ドラッグで回せる。触っている間と故障している間は切り替えない
  - STAR: ハブ1 + 端末12。端末はハブを囲む球面上に均等に並べる
  - RING: 端末16。水平な円に並べる
  - TREE: 根1 → 中間3 → 端末9。根を上に、下の段ほど大きな円に並べる(円すい形)
  - WIRELESS MESH: センサー40 + ゲートウェイ1。少しつぶした球の中にばらまき、電波の届く距離の中にいるもの同士をつなぐ。配置は固定の乱数種で毎回同じにし、全体がつながることを保証する。ゲートウェイは中心に置く
- 中継機器(ハブ、ツリーの根と中間)とゲートウェイは端末より大きく描く。ゲートウェイには輪を重ねる
- 約0.5秒ごとに1つ、端末からランダムに選んだ2台の間を最短経路でパケットを送る。無線メッシュではセンサーからゲートウェイへの1方向だけ。パケットは1ホップずつ進み、同時に飛ぶのは14個まで。数値は `src/hero/config.ts` で調整する
- パケットは青。通過・到着した機器は一瞬光る
- ホバーでいちばん近い機器とその隣を照らす
- クリックした機器が故障する。複数台を同時に故障させられる。もう一度クリックするか、約8秒で直る
  - 故障した機器に着いたパケットは、そこで橙に光って消える。新しいパケットは届く組の端末の間だけで、故障した機器を避けた最短経路で送る
  - 故障した機器は橙の輪にし、つながるリンクを薄くする。どこにも届かなくなった端末も薄くする
- 右下にトポロジの名前を、どちらの言語でも英語の大文字で出す(`STAR` など)。故障中は台数を添える(`STAR · 1 DOWN`)
- `?dev`(または開発サーバー)で検証用の切り替えを出し、トポロジを固定できる
- `prefers-reduced-motion` では、パケットを3秒ぶん進めた静止画を1枚出す。クリックすると故障の状態だけを描き直し、パケットは動かさない。自動では直らない(もう一度クリックすると直る)。`?dev` で形を選んだときも静止画を出す
- テーマの切り替えボタンは外し、明るい配色に固定する。色はヒーローの青と橙のまま(サイトのトークンには合わせない)。描画色は `Hero.astro` の要素に定義したCSS変数から読む
- キャッチコピーなどの文言は枠の外(下)に置くので、形は枠の中央に描く

## ページ仕様

各ページはモックアップ(`docs/mockups/`)の同名のアートボードを再現する。下の表はその要素と並び。各ページの冒頭は「英語ラベル(Mono)、H1、リード文」で統一する。

| ページ | 要素(上から順) | データ |
| --- | --- | --- |
| トップ | Hero、キャッチコピー+「配属を考えている人へ」ボタン、メッセージ冒頭+全文リンク、研究テーマ一覧、配属希望の方への入口カード4枚(研究室生活、前提知識、メンバーと研究テーマ、卒業生の進路)、新着記事3件 | home、themes、articles、message |
| 研究 | リード、テーマへのページ内リンク。テーマごとに `Section`:番号・名前・英名 / 説明、キーワード、取り組むメンバー、関連記事、主な業績。末尾に配属希望の方への導線 | home、themes、members、articles、pubsを `themes` で結合 |
| メンバー | 教員(写真、職位、専門、紹介、業績とメッセージへのリンク)、在籍学生(学年・氏名・テーマ・リンク、記事があればリンク)、卒業生(年度・論文種別・テーマ)、進路(企業名のみ、読点区切り、五十音順) | members、careers |
| 業績 | リード(太字=研究室メンバー)、researchmapの最終更新日、種別ボタン(すべて/論文/国際会議/国内発表/受賞、件数付き)、年への移動リンク。年ごとに `Section`(左に年、右に業績)。2017年以降を出し、それ以前はresearchmapへリンク | researchmap + pubs.yaml |
| 記事一覧 | 研究ノートとコラムの説明(2列)、分類ボタン、タグ、一覧(左:日付・分類 / 右:タイトル、要約2行、著者、タグ)、10件ごとのページ送り | articles |
| 記事ページ | パンくず、H1、著者・日付・分類・タグ、左に目次(H2から自動生成。「参考文献」は除く)、右に本文(最大40em)、参考文献、著者紹介、関連記事3件(同じタグ優先) | articles、members |
| 配属希望の方へ | ページ内リンク5つ、研究室生活(1週間の一覧、1年の流れの縦タイムライン)、前提知識(カード3枚+おすすめの授業・本)、進路、FAQ(`<details>`)、見学・面談(プレースホルダー) | join、careers |
| メッセージ | 左に写真と名前、右に本文(書き出しは21px)、署名、研究・配属希望の方へへのリンク | message |
| アクセス | 所在地(INIAD HUB-1、部屋番号はプレースホルダー)とINIADのアクセスページへのリンク、交通、お問い合わせ(プレースホルダー)。地図は置かない | access |

**絞り込みの実装**

- 記事の分類とタグは、それぞれのページを静的に生成する(JavaScript不要)。分類とタグは `<a>` で、選択中のものに `aria-current` を付ける
- 業績の種別は1ページに全件を出力し、小さな素のJavaScriptで `hidden` を切り替える。ボタンは `<button aria-pressed>`。JavaScriptが無効なら全件表示、ボタンは非表示
- 該当が0件の年や条件には「該当する業績はありません」と表示する

## データスキーマ(Content Collections)

更新する人がHTMLやコンポーネントに触らず、MarkdownとYAMLだけを編集すれば済むようにする。正本は `src/content.config.ts`。要点は次のとおり。

- `i18n` 型は `{ ja: string, en?: string }`。`en` が無ければ `ja` を表示する
- `articles`:`title`、`date`、`category`(note / column)、`tags`(日本語のタグ名)、`themes`、`author`(members の id)、`excerpt`(無ければ本文冒頭から生成)、`draft`
- `tags`(`tags.yaml`):`id`(英字スラッグ)と `name`(日本語)
- `members`:`name`、`role`(faculty / student / alumni)、`title`(職位)、`specialty`(専門)、`bio`(紹介)、`grade`、`research`、`themes`、`photo`、`thesis`(年度・種別・題目)、`researchmap`(パーマリンク)、`links`(ラベルとURL)、`order`
- `themes`:`order`、`name`、`label`(英語の小見出し)、`summary`(トップ用の1〜2行)、`body`(研究ページの説明)、`keywords`
- `pubs`(`pubs.yaml`):`type`(paper / intl / domestic / award)、`date`、`authors`(`member` があれば太字)、`title`、`venue`、`doi`、`url`、`themes`。書く人が id を考えなくて済むよう、配列の並び順から id を振る
- `careers`(`careers.yaml`):`name` と `kana`(読み仮名。必須)。読み仮名の五十音順に並べる。個人と結びつけないため、members とは別に管理する
- `home` / `message` / `join` / `access`:固定ページの文言。`ja` と `en` のファイルを置く

その他の決まり:

- `draft: true` の記事は本番ビルドで出力しない
- 記事の著者が members にいない場合と、タグが `tags.yaml` に無い場合は、ビルドをエラーで止める(直し方をメッセージに出す)
- サンプル記事として「Sinkhorn Distances:双対性で最適輸送を速く解く」(コラム、著者は竹本 志恩、2026-07-10)を入れる。図1はモックアップの図をSVGで再現する

## researchmap連携

先生の業績はresearchmapの公開APIから取得して `pubs.yaml` と同じ形に整形し、学生の業績とまとめて表示する。ブラウザからAPIは呼ばない。

- 先生のパーマリンクは `g0000218011`(川原 亮一 教授)。教員の `members/*.yaml` の `researchmap` から読む(空なら取得をスキップ)
- 取得は `scripts/fetch-researchmap.ts`(`npm run fetch:researchmap`)が行い、結果を `src/data/researchmap-cache.json` に保存する。**ビルドはキャッシュだけを読む**
- 週1回の定期実行で取得し、内容が変わっていればキャッシュをmainにコミットしてから公開する。取得に失敗したら、前回のキャッシュのまま公開する
- 取得先は `https://api.researchmap.jp/<パーマリンク>/published_papers`。`limit=100` と `start` でページを送る。2026-10-15 時点で129件
- `presentations` と `awards` は、2026-10-15 時点で0件だったため扱わない。登録が始まったら、実際のレスポンスを見てから対応を足す(推測で書かない)
- 種別の対応(`published_paper_type`。実データで確認済み):`scientific_journal` → `paper`、`international_conference_proceedings` → `intl`、`research_society` / `symposium` → `domestic`。種別が空の登録(IEICE ComExのレターなど)はISSNがあれば `paper`。それ以外は表示しない
- 会場名は `publication_name` に巻・号・ページを付けて作る。リンクはDOIがあれば `https://doi.org/<DOI>`
- 各項目は日本語と英語の値を別々に持つことがある(タイトルが英語だけのものが多い)。表示中の言語を優先し、無ければもう一方で代用する
- 重複は、DOI(大文字小文字を区別しない)か、正規化したタイトルで名寄せする。`pubs.yaml` 側を優先する。researchmapの中の重複登録も1件にする
- 太字は、メンバーの氏名(日本語と英語)と、空白・大文字小文字・姓名の順の違いを無視して照合して決める
- 業績ページの「最終更新」には、キャッシュの内容が最後に変わったときの取得日時を出す

## 多言語対応

日本語を既定(接頭辞なし)、英語を `/en/` にする。記事は日本語のみ。

```js
// astro.config.mjs(抜粋)
i18n: {
  defaultLocale: 'ja',
  locales: ['ja', 'en'],
  routing: { prefixDefaultLocale: false },
},
```

- ナビやボタンなどの文言は `src/i18n/ui.ts` にキーごとにまとめ、`t(lang, key)` で引く
- ページ本体は言語ごとにファイルを分けず、`lang` を受け取る `src/views/` のコンポーネントで書く。`pages/research.astro` と `pages/en/research.astro` は薄いラッパーにする
- `LangSwitch` は同じページのもう一方の言語へ飛ばす。対応ページが無い場合(記事)はその言語のトップへ
- `<html lang>`、`hreflang` の `<link rel="alternate">` を出力する
- 英語版の記事一覧は置かず、トップの新着記事と研究ページの関連記事に「Japanese only」のラベルを付ける

## デプロイと運用

ワークフロー `.github/workflows/site.yml` は1本にまとめる。

| きっかけ | すること |
| --- | --- |
| Pull Request | 整形・`astro check`・Vitest、ビルドとPlaywright(`base` が `/kawahara-lab-site/` と `/` の2通り) |
| mainへのpush、`workflow_dispatch` | 上のチェックが通れば、ビルドしてGitHub Pagesに公開する |
| 週1回(月曜 3:00 JST、`cron: '0 18 * * 0'`) | researchmapから取得し、キャッシュに差分があればmainにコミットしてから、チェックと公開を行う |

- 公開時の `site` と `base` は `actions/configure-pages` の出力から取る。手元では環境変数 `SITE_URL` / `SITE_BASE` で切り替えられる
- mainを保護するときは、「Pull Request必須」の対象からGitHub Actionsを除外する(キャッシュの自動コミットのため)
- 更新はPull Request経由にする
- READMEに書くこと:ローカルでの起動方法、記事の追加手順(frontmatterの例つき)、メンバー・業績・進路の更新手順、researchmapのキャッシュの更新方法、年度替わりの作業、公開の設定

## テスト

- TypeScriptは `strict`。コンテンツはzodのスキーマで型を付け、YAMLやfrontmatterの書き間違いをビルド時のエラーにする
- **TDD** の対象は `src/lib/`(researchmapの整形・種別の判定・名寄せ、`url.ts`、`i18n.ts`、タグ、記事の要約・ページ送り・関連記事、業績の年ごとのまとめ・件数・太字・進路の並び)。researchmapのテストには、実際のレスポンス(`tests/fixtures/researchmap/`)を入力に使う
- ヒーローはトポロジの生成、最短経路、`Scene`(パケットの送信・切り替え・ホバー・故障)をVitestで確かめる。canvasの画素比較は保守の負担が大きいので外す
- ページとコンポーネントはTDDの対象にしない。受け入れ基準をPlaywrightのテスト(`tests/e2e/`)にして確かめる
- 文字のコントラスト比は `tokens.css` の値から計算してテストする

## 受け入れ基準

次のすべてを満たしたらMVP完了とする。(e2e)はPlaywright、(unit)はVitestで自動で確かめる。

- [ ] `npm run build` と `astro check` がエラーなしで通る
- [ ] 「ディレクトリ構成とURL」の全ページが生成され、ナビとページ間リンクがすべてつながる(e2e)
- [ ] `base` が `/` と `/<repo>/` のどちらでも、リンク切れや画像の読み込み失敗がない(e2e、CIで2通り)
- [ ] GitHub ActionsでGitHub Pagesに公開でき、`workflow_dispatch` でも再デプロイできる
- [ ] 横幅375pxで横スクロールが出ない。`Section` が縦に並び、ナビが折り返す(e2e)
- [ ] 色・文字・余白が `tokens.css` の値と一致し、モックアップと見比べて大きな差がない
- [ ] サンプル記事の数式がKaTeXで、コードがShikiで正しく表示され、目次がH2から生成される(e2e)
- [ ] 記事の分類ページとタグページが生成される。業績の種別絞り込みが動き、JavaScript無効でも全件が読める(e2e)
- [ ] researchmapの取得に失敗してもビルドが通り、キャッシュが表示される
- [ ] 英語版の固定ページがあり、言語切り替えで同じページへ飛ぶ。`lang` と `hreflang` が出力される(e2e)
- [ ] 本文のコントラスト比が4.5:1以上(unit)。キーボードだけで全リンクとボタンを操作でき、フォーカスが見える(e2e)
- [ ] `prefers-reduced-motion` でトップのモーションが止まる(e2e)
- [ ] READMEの手順だけで、記事1件とメンバー1人を追加できる

## 未決事項と参照資料

未決のものはプレースホルダーで実装し、決まり次第データを差し替える。実装を止める必要はない。

| 項目 | 現状 | 実装での扱い |
| --- | --- | --- |
| Organizationへの移転 | 先生に確認中 | 移転してもワークフローがPagesの設定から `site` と `base` を取る |
| 問い合わせ窓口、見学・面談 | 先生に確認中 | 「確認中」の表示。`src/site.config.ts` の `contactUrl` / `visitUrl` で変える |
| キャッチコピー | 先生からもらう | プレースホルダー(`src/content/home/`) |
| 研究テーマ名 | 仮:ネットワーク、機械学習、IoT | `themes/*.yaml` で仮置き。最適輸送はテーマに含めない |
| INIADの正式な青 | 未確認 | `--color-link` の値だけ差し替える |
| 研究室の部屋番号 | 未確認 | プレースホルダー(`src/content/access/`) |
| 学部生の卒業研究発表を業績に載せるか | 未決 | 種別を足せるスキーマにしておく |
| researchmapの発表・受賞 | 先生の登録が0件 | 登録が始まったら実データを見て対応を足す |
| OGP画像 | 仮のもの | `public/og.png` を差し替える |

**決まったこと(2026-10-15)**

- 先生のresearchmapパーマリンク:`g0000218011`
- 公開先:新しいリポジトリ `custard-1855/kawahara-lab-site`(`https://custard-1855.github.io/kawahara-lab-site/`)
- トップモーション:akabane2026 の C-5 を移植した。2026-10-21 に、ネットワークのトポロジとパケットへ作り替えると決めた(#17)

**参照資料**

- [川原研究室サイト 仕様](https://claude.ai/code/artifact/f7c07af1-1553-4a41-ae27-18ea7a24d08d):対象、目的、コンテンツなど上位の仕様
- [川原研究室サイト モックアップ](https://claude.ai/artifact/UoQftTRiBPPN44BPLA9q87):キャンバスの「案A' 各ページ」の段と、案A'のトップ・メンバーが実装対象。案Aと中間案は不採用。元ファイルは `docs/mockups/`
- トップの表現の検討:akabane2026 の `docs/lab_site_top_concepts.md`
- [Astroドキュメント](https://docs.astro.build/):Content Collections、i18n、Markdown、GitHub Pagesへのデプロイの章
