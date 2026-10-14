// 文字のコントラスト比が4.5:1以上か(tokens.css の値で計算する)
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const css = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");
const token = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`--${name} が見つかりません`);
  return m[1];
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("コントラスト比", () => {
  const pairs: [string, string][] = [
    ["color-text", "color-bg"],
    ["color-text", "color-surface"],
    ["color-text-sub", "color-bg"],
    ["color-text-sub", "color-surface"],
    ["color-text-body2", "color-surface"],
    ["color-link", "color-bg"],
    ["color-link", "color-surface"],
    ["color-bg", "color-navy"],
    ["color-code-text", "color-code-bg"],
  ];
  test.each(pairs)("%s / %s は 4.5:1 以上", (fg, bg) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
