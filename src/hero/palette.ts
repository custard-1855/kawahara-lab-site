// 色(CSS の変数から読む)
//
// 基本は2色: パケットと光る機器は青(accent)、操作で起きたことは橙(accent2)
import { hexRgb, type RGB } from "./color";

export type Colors = {
  bg: RGB;
  ink: RGB;
  muted: RGB;
  edge: RGB;
  accent: RGB;
  accent2: RGB;
  /** 背景が暗いか */
  dark: boolean;
};

/** 今の色。readColors() で読み直す */
export const C = {} as Colors;

/** 色の CSS の変数を el(ヒーローの要素)から読む */
export function readColors(el: Element) {
  const cs = getComputedStyle(el);
  const g = (n: string) => hexRgb(cs.getPropertyValue(n));
  Object.assign(C, {
    bg: g("--bg"),
    ink: g("--ink"),
    muted: g("--muted"),
    edge: g("--edge"),
    accent: g("--accent"),
    accent2: g("--accent2"),
  });
  C.dark = (C.bg[0] + C.bg[1] + C.bg[2]) / 3 < 128;
}
