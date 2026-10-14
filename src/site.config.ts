// サイト全体の設定。窓口などが決まったら、ここを書き換える
export const SITE = {
  /** このサイトのリポジトリ(フッターのリンク) */
  githubUrl: "https://github.com/custard-1855/kawahara-lab-site",
  /** お問い合わせ先の URL。null の間は「確認中」と表示する */
  contactUrl: null as string | null,
  /** 見学・面談の申し込み先の URL。null の間は「確認中」と表示する */
  visitUrl: null as string | null,
  /** 業績ページに出す最初の年。これより前は researchmap へのリンクにする */
  pubsFromYear: 2017,
  /** 記事一覧の1ページの件数 */
  articlesPerPage: 10,
};
