// タグ: 記事の frontmatter には日本語のタグ名を書き、URL には tags.yaml のスラッグを使う

export type Tag = { id: string; name: string };

export function createTagIndex(tags: Tag[]) {
  const bySlug = new Map<string, Tag>();
  const byName = new Map<string, Tag>();
  for (const tag of tags) {
    if (byName.has(tag.name)) {
      throw new Error(`tags.yaml にタグ「${tag.name}」が2回登録されています。`);
    }
    byName.set(tag.name, tag);
    bySlug.set(tag.id, tag);
  }
  return {
    /** タグ名 → スラッグ。未登録ならビルドを止める */
    slugOf(name: string, article = "?"): string {
      const tag = byName.get(name);
      if (!tag) {
        throw new Error(
          `タグ「${name}」(記事 ${article})が src/content/tags.yaml に登録されていません。` +
            `tags.yaml に「- id: <英字のスラッグ>\\n  name: ${name}」を追加してください。`,
        );
      }
      return tag.id;
    },
    nameOf(slug: string): string | undefined {
      return bySlug.get(slug)?.name;
    },
    all(): Tag[] {
      return tags;
    },
  };
}

export type TagIndex = ReturnType<typeof createTagIndex>;
