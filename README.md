# 川原研究室サイト

東洋大学 情報連携学部(INIAD)川原研究室のWebサイトです。[Astro](https://docs.astro.build/) で作り、GitHub Pages で公開しています。

- 公開先: https://custard-1855.github.io/kawahara-lab-site/
- 仕様: [`docs/spec.md`](docs/spec.md)、デザインの元: [`docs/mockups/`](docs/mockups/)(レイアウト・余白・色の参照用。単体では正しく表示されない)

更新はほとんどの場合、`src/content/` の Markdown と YAML を編集するだけで済みます。HTML やコンポーネントに触る必要はありません。

## ローカルで動かす

Node.js 24 以上が必要です。

```sh
npm install
npm run dev        # http://localhost:4321/kawahara-lab-site/ で確認(保存すると自動で更新される)
npm run build      # dist/ に公開用のファイルを出力
npm run check      # 整形・型チェック・処理のテストをまとめて確認
npm run test:e2e   # ブラウザのテスト(ビルドしてから確かめる)
npm run format     # Prettier で整形する
```

## 更新の流れ

1. ブランチを作って編集する
2. `npm run dev` で見た目を確かめ、`npm run check` を通す
3. Pull Request を作る。GitHub Actions がチェックとブラウザのテストを実行する
4. main にマージすると、自動で公開される

## 記事を追加する

`src/content/articles/<スラッグ>.md` を作ります。ファイル名がURLになります(`/articles/<スラッグ>/`)。英小文字・数字・ハイフンで付けてください。`page`、`category`、`tag` は一覧のURLと重なるので使えません。

```markdown
---
title: "Sinkhorn Distances:双対性で最適輸送を速く解く"
date: 2026-07-10
category: column # note(研究ノート)または column(コラム)
tags: ["最適輸送", "双対性"] # 日本語のタグ名。src/content/tags.yaml に登録が必要
themes: [] # 関係する研究テーマの id(src/content/themes/ のファイル名)
author: takemoto # src/content/members/ のファイル名
excerpt: "一覧に出す要約。省略すると本文の冒頭から作る"
draft: false # true にすると公開されない(npm run dev では表示される)
---

## はじめに

本文。数式は $E = mc^2$ や $$ ... $$ で書けます(KaTeX)。
```

- 見出しは `##`(H2)から始めます。H2 が記事ページの目次になります。`## 参考文献` は目次に出ません
- コードは ` ```python ` のように言語名を付けると色が付きます
- 新しいタグを使うときは、`src/content/tags.yaml` に1つ追加します(未登録だとビルドがエラーで止まり、直し方が表示されます)

  ```yaml
  - id: optimal-transport # URL に使う英字
    name: 最適輸送 # 記事に書く名前
  ```

## メンバーを追加する

`src/content/members/<id>.yaml` を作ります。`<id>` は記事の `author` や業績の `member` に使います。

```yaml
name: { ja: 山田 太郎, en: Taro Yamada } # en は省略可(無ければ日本語を表示)
role: student # faculty(教員)/ student(在籍学生)/ alumni(卒業生)
grade: B4 # B4 / M1 / M2 / D1 / D2 / D3
research: { ja: "研究テーマ", en: "Research topic" }
bio: { ja: "記事の著者紹介に出す1行" }
themes: [network] # 取り組んでいる研究テーマの id
links:
  - { label: GitHub, url: "https://github.com/..." }
order: 10 # 同じ学年の中での並び順
```

写真を載せるときは、同じフォルダに画像を置いて `photo: ./yamada.jpg` と書きます。

## 業績を追加する

- **教員の業績**は researchmap から自動で取ります(下記)。手で書く必要はありません
- **学生の業績**は `src/content/pubs.yaml` に足します。書き方の例はファイルの先頭にあります。著者のうち研究室のメンバーには `member: <id>` を付けると太字になります。researchmap の業績と DOI またはタイトルが同じものは1件にまとめ、`pubs.yaml` 側を表示します
- 業績ページに出すのは 2017 年以降です。変えるときは `src/site.config.ts` の `pubsFromYear` を書き換えます

## 進路を追加する

`src/content/careers.yaml` に企業名と読み仮名を足します。読み仮名の五十音順に並びます。個人とは結びつけません。

```yaml
- name: { ja: 日本電気, en: NEC }
  kana: にっぽんでんき
```

## researchmap のキャッシュ

教員の業績は、`src/content/members/` の教員の `researchmap`(パーマリンク)を使って researchmap の公開 API から取り、`src/data/researchmap-cache.json` に保存しています。ビルドはこのファイルだけを読みます(ビルド中に API は呼びません)。

- GitHub Actions が毎週月曜 3:00(日本時間)に取り直し、内容が変わっていればキャッシュを main にコミットして公開し直します。取得に失敗したときは、前回のキャッシュのまま公開します
- すぐ反映したいときは、GitHub の Actions → site → Run workflow を実行するか、手元で `npm run fetch:researchmap` を実行してコミットします
- 業績ページの「最終更新」は、キャッシュの内容が最後に変わったときの取得日時です
- いま取り込んでいるのは published_papers(論文・国際会議など)だけです。presentations と awards は、2026-10 時点で先生の登録が0件だったため、まだ扱っていません。登録が始まったら、実際のレスポンスを見て `src/lib/researchmap.ts` に対応を足してください

## 年度替わりの作業

1. 在籍学生の `grade` を1つ上げる(B4 → M1 など)
2. 卒業・修了した人は `role: alumni` にし、`thesis` を書く。`grade` は消す

   ```yaml
   role: alumni
   thesis: { year: 2026, kind: bachelor, title: { ja: "卒業論文のテーマ" } } # kind: bachelor / master / doctor
   ```

3. 就職・内定先を `careers.yaml` に足す
4. 新しく配属された人を `members/` に足す

## そのほかの設定

- お問い合わせ先、見学・面談の申し込み先: `src/site.config.ts` の `contactUrl`、`visitUrl`。null の間は「確認中」と表示します
- トップのキャッチコピーなど固定ページの文言: `src/content/home/`、`message/`、`join/`、`access/`(それぞれ `ja` と `en`)
- 研究テーマ: `src/content/themes/`
- ナビやボタンの文言: `src/i18n/ui.ts`
- 色・文字・余白: `src/styles/tokens.css`(INIAD の正式な青が分かったら `--color-link` を差し替える)

## 公開の設定(最初の1回と、移転のとき)

1. リポジトリの Settings → Pages → Build and deployment の Source を「GitHub Actions」にする
2. Settings → Rules で main を保護する場合は、「Pull Request 必須」の対象から GitHub Actions を除外する(週1回のキャッシュ更新が main に直接コミットするため)

公開先の URL(`site` と `base`)は、ワークフローが Pages の設定から自動で取ります。Organization へ移転しても書き換えは要りません。手元でビルドするときは環境変数 `SITE_URL`、`SITE_BASE` で変えられます(既定は `https://custard-1855.github.io` と `/kawahara-lab-site/`)。

## 構成

```text
src/
  content/        更新する人が編集するデータ(Markdown と YAML)
  content.config.ts  データの形(スキーマ)。項目を増やすときはここも直す
  data/           researchmap のキャッシュ(自動で更新される)
  views/          ページ本体(日本語と英語で共通。lang を受け取る)
  pages/          URL ごとの薄いファイル(views を呼ぶだけ)
  layouts/        BaseLayout(全ページの土台)、ArticleLayout(記事ページ)
  components/     Header、Footer、Section、ListRow など
  hero/           トップのモーション(canvas)。akabane2026 の lab-site から移したもの
  lib/            データの計算(Astro に依存しない部分はテストあり)
  i18n/ui.ts      ナビやボタンの文言
  styles/         tokens.css(デザイントークン)、base.css
  site.config.ts  窓口の URL など
scripts/fetch-researchmap.ts  researchmap からキャッシュを作る
tests/unit/       処理のテスト(Vitest)
tests/e2e/        ブラウザのテスト(Playwright)。受け入れ基準を確かめる
tests/fixtures/   researchmap の実際のレスポンス(テスト用)
```

クライアント側の JavaScript は、トップのモーションと業績ページの絞り込みだけで使っています。どちらも JavaScript が無効でもページは読めます。
