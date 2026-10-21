// 受け入れ基準のうち、ブラウザで確かめられるもの
import { expect, test } from "@playwright/test";
import { PAGES } from "./pages";

test.describe("リンクと読み込み", () => {
  test("全ページのサイト内リンクが開け、画像・CSS・スクリプトの読み込みに失敗しない", async ({
    page,
    request,
    baseURL,
  }) => {
    const origin = new URL(baseURL!).origin;
    const links = new Set<string>();
    const failed: string[] = [];
    page.on("response", (res) => {
      if (res.url().startsWith(origin) && res.status() >= 400)
        failed.push(`${res.status()} ${res.url()}`);
    });
    for (const p of PAGES) {
      const res = await page.goto(p);
      expect(res?.status(), p).toBe(200);
      for (const href of await page
        .locator("a[href]")
        .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))) {
        if (href.startsWith(origin)) links.add(href.split("#")[0]);
      }
    }
    for (const link of links) {
      const res = await request.get(link);
      expect(res.status(), link).toBe(200);
    }
    expect(failed).toEqual([]);
  });

  test("ナビから主要ページへたどれる", async ({ page }) => {
    await page.goto("");
    for (const name of ["研究", "メンバー", "業績", "記事", "配属希望の方へ"]) {
      await page
        .getByRole("navigation", { name: "メインメニュー" })
        .getByRole("link", { name })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name }),
      ).toHaveAttribute("aria-current", "page");
    }
  });
});

test.describe("スマホの幅(375px)", () => {
  test.use({ viewport: { width: 375, height: 800 } });
  for (const p of PAGES) {
    test(`横スクロールが出ない: /${p}`, async ({ page }) => {
      await page.goto(p);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }
});

test.describe("業績の絞り込み", () => {
  test("種別のボタンで表示が切り替わる", async ({ page }) => {
    await page.goto("publications/");
    const filters = page.getByRole("group", { name: "種別で絞り込む" });
    await expect(filters).toBeVisible();
    const items = page.locator("li[data-type]");
    const total = await items.count();
    expect(total).toBeGreaterThan(0);

    await filters.getByRole("button", { name: /国際会議/ }).click();
    await expect(filters.getByRole("button", { name: /国際会議/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const visibleTypes = await page
      .locator("li[data-type]:visible")
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.type));
    expect(visibleTypes.length).toBeGreaterThan(0);
    expect(new Set(visibleTypes)).toEqual(new Set(["intl"]));

    await filters.getByRole("button", { name: /すべて/ }).click();
    await expect(page.locator("li[data-type]:visible")).toHaveCount(total);
  });

  test("該当が0件の年には「該当する業績はありません」を出す", async ({ page }) => {
    await page.goto("publications/");
    await page
      .getByRole("group", { name: "種別で絞り込む" })
      .getByRole("button", { name: /受賞/ })
      .click();
    await expect(page.getByText("該当する業績はありません。").first()).toBeVisible();
  });
});

test.describe("JavaScript が無効", () => {
  test.use({ javaScriptEnabled: false });
  test("業績は全件が読め、絞り込みのボタンは出ない", async ({ page }) => {
    await page.goto("publications/");
    await expect(page.getByRole("group", { name: "種別で絞り込む" })).toBeHidden();
    const items = page.locator("li[data-type]");
    expect(await items.count()).toBeGreaterThan(0);
    await expect(page.locator("li[data-type]:visible")).toHaveCount(await items.count());
  });
});

test.describe("記事", () => {
  test("数式は KaTeX、コードは Shiki で表示し、目次は H2 から作る", async ({ page }) => {
    await page.goto("articles/sinkhorn-distances/");
    expect(await page.locator(".katex").count()).toBeGreaterThan(10);
    await expect(page.locator(".katex-display").first()).toBeVisible();
    await expect(page.locator("pre.astro-code")).toHaveCount(1);
    const toc = await page
      .getByRole("navigation", { name: "Contents" })
      .getByRole("link")
      .allTextContents();
    const h2 = await page.locator(".prose h2").allTextContents();
    expect(toc).toEqual(h2.filter((t) => t !== "参考文献"));
    expect(toc[0]).toBe("はじめに");
  });

  test("分類とタグのページがあり、選択中のものに aria-current が付く", async ({ page }) => {
    await page.goto("articles/tag/optimal-transport/");
    await expect(page.getByRole("link", { name: "#最適輸送", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByText("Sinkhorn Distances", { exact: false }).first()).toBeVisible();
    await page.goto("articles/category/note/");
    await expect(page.getByText("条件に合う記事はありません。")).toBeVisible();
  });
});

test.describe("多言語", () => {
  test("lang と hreflang を出し、言語の切り替えで同じページへ移る", async ({ page }) => {
    await page.goto("en/research/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveAttribute(
      "href",
      /\/research\/$/,
    );
    await page.getByRole("link", { name: "日本語" }).click();
    await expect(page).toHaveURL(/\/research\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  });

  test("記事から英語へ切り替えると英語版トップへ", async ({ page }) => {
    await page.goto("articles/sinkhorn-distances/");
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/$/);
  });

  test("英語版の記事へのリンクに Japanese only を付ける", async ({ page }) => {
    await page.goto("en/");
    await expect(page.getByText("Japanese only").first()).toBeVisible();
  });
});

test.describe("操作性", () => {
  test("キーボードで移動したとき、フォーカスが見える", async ({ page }) => {
    await page.goto("");
    for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      return { tag: el.tagName, style: s.outlineStyle, width: s.outlineWidth };
    });
    expect(outline.tag).toBe("A");
    expect(outline.style).not.toBe("none");
    expect(outline.width).not.toBe("0px");
  });

  test("リンクとボタンのクリック範囲は高さ44px以上(本文中のリンクを除く)", async ({ page }) => {
    for (const p of ["", "publications/", "articles/", "join/"]) {
      await page.goto(p);
      const small = await page
        .locator("header a, footer a, nav a, .text-link, button, .button")
        .evaluateAll((els) =>
          els
            .filter((e) => (e as HTMLElement).offsetParent !== null)
            .map((e) => ({ text: e.textContent?.trim(), h: e.getBoundingClientRect().height }))
            .filter((x) => x.h < 44),
        );
      expect(small, p).toEqual([]);
    }
  });
});

test.describe("動きを減らす設定", () => {
  test.use({ reducedMotion: "reduce" });
  test("トップのモーションが止まる", async ({ page }) => {
    await page.goto("");
    const canvas = page.locator("[data-hero] canvas");
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(500);
    const a = await canvas.screenshot();
    await page.waitForTimeout(1500);
    const b = await canvas.screenshot();
    expect(a.equals(b)).toBe(true);
  });

  test("?dev から形を選んでも、「自動」に戻しても、ヒーローに何か描かれている", async ({
    page,
  }) => {
    await page.goto("?dev");
    const canvas = page.locator("[data-hero] canvas");
    await expect(canvas).toBeVisible();
    // 背景のグラデーションより濃い画素の数。画素の厳密な比較はしない
    const inked = () =>
      canvas.evaluate((cv: HTMLCanvasElement) => {
        const { data } = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height);
        let n = 0;
        for (let i = 0; i < data.length; i += 4)
          if (Math.min(data[i], data[i + 1], data[i + 2]) < 200) n++;
        return n;
      });
    const dev = page.getByRole("navigation", { name: "検証用の図形切り替え" });
    const buttons = dev.getByRole("button");
    for (let i = 1; i < (await buttons.count()); i++) {
      await buttons.nth(i).click();
      expect(await inked(), (await buttons.nth(i).textContent()) ?? "").toBeGreaterThan(100);
    }
    await dev.getByRole("button", { name: "自動" }).click();
    expect(await inked()).toBeGreaterThan(100);
  });
});
