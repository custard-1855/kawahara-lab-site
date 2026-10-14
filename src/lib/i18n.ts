// 多言語の小道具。文言そのものは src/i18n/ui.ts にある
import { ui, type UiKey } from "../i18n/ui";

export type Lang = "ja" | "en";
export const LANGS: Lang[] = ["ja", "en"];

/** 言語ごとの値。YAML の { ja, en } と researchmap の両方をこの形で扱う */
export type Localized<T> = { ja?: T; en?: T };

const isEmpty = (v: unknown) => v === undefined || v === null || v === "";

/** lang の値を返す。無ければもう一方の言語で代用する */
export function pick<T>(value: Localized<T> | undefined, lang: Lang): T | undefined {
  if (!value) return undefined;
  const other: Lang = lang === "ja" ? "en" : "ja";
  return isEmpty(value[lang]) ? value[other] : value[lang];
}

/** ナビやボタンなどの文言 */
export function t(lang: Lang, key: UiKey): string {
  return ui[lang][key] ?? ui.ja[key];
}
