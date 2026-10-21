// canvas への描画。シーンの状態を読んで1コマ描く(シーンは書き換えない)
import { mix, rgba, type RGB } from "./color";
import { CFG } from "./config";
import { smooth } from "./math";
import { C } from "./palette";
import type { Projected, Scene } from "./scene";

export function createRenderer(ctx: CanvasRenderingContext2D) {
  /* 光の粒(色ごとに1枚作って使い回す) */
  const glowCache = new Map<string, HTMLCanvasElement>();
  function glow(c: RGB, x: number, y: number, r: number, a: number) {
    if (a <= 0.01) return;
    const key = c.join(",");
    let s = glowCache.get(key);
    if (!s) {
      s = document.createElement("canvas");
      s.width = s.height = 64;
      const g = s.getContext("2d")!;
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(c, 1));
      gr.addColorStop(0.18, rgba(c, 0.55));
      gr.addColorStop(0.5, rgba(c, 0.12));
      gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      glowCache.set(key, s);
    }
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  /* 背景のグラデーションは大きさが変わったときだけ描き直す */
  let bgCache: HTMLCanvasElement | null = null,
    bgKey = "";
  function background(W: number, H: number, cx: number, cy: number) {
    const k = [W, H, cx | 0, cy | 0].join("|");
    if (k !== bgKey || !bgCache) {
      bgKey = k;
      bgCache = document.createElement("canvas");
      bgCache.width = W;
      bgCache.height = H;
      const b = bgCache.getContext("2d")!;
      const g = b.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) * 0.7);
      g.addColorStop(0, rgba(mix(C.bg, C.accent, C.dark ? 0.07 : 0.05)));
      g.addColorStop(1, rgba(C.bg));
      b.fillStyle = g;
      b.fillRect(0, 0, W, H);
    }
    ctx.drawImage(bgCache, 0, 0, W, H);
  }

  /** テーマが変わったら、色を焼き込んだ画像を作り直す */
  function resetCaches() {
    glowCache.clear();
    bgKey = "";
  }

  /** リンク(奥行きで3段階の濃さ) */
  function links(scene: Scene, Q: Projected[], a0: number) {
    const bands = [new Path2D(), new Path2D(), new Path2D()];
    const dead = new Path2D(); // 故障した機器につながるリンクは薄く描く
    for (const [a, b] of scene.shape.edges) {
      const path =
        scene.down.has(a) || scene.down.has(b)
          ? dead
          : bands[Math.min(2, Math.floor(((Q[a].d + Q[b].d) / 2) * 3))];
      path.moveTo(Q[a].x, Q[a].y);
      path.lineTo(Q[b].x, Q[b].y);
    }
    ctx.lineWidth = 1;
    bands.forEach((pa, i) => {
      ctx.strokeStyle = rgba(C.edge, (0.22 + i * 0.22) * a0);
      ctx.stroke(pa);
    });
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = rgba(C.edge, 0.3 * a0);
    ctx.stroke(dead);
    ctx.setLineDash([]);
  }

  /** ホバー: いちばん近い機器と、その隣を照らす */
  function hover(scene: Scene, Q: Projected[], a0: number) {
    const hv = scene.hover,
      ha = scene.hoverA * a0;
    if (hv < 0 || ha <= 0.01) return;
    ctx.beginPath();
    for (const j of scene.nbrs[hv]) {
      // 故障した機器につながるリンクは、薄いまま見せる
      if (scene.down.has(hv) || scene.down.has(j)) continue;
      ctx.moveTo(Q[hv].x, Q[hv].y);
      ctx.lineTo(Q[j].x, Q[j].y);
    }
    ctx.strokeStyle = rgba(C.ink, 0.6 * ha);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;
    for (const j of scene.nbrs[hv]) {
      ctx.beginPath();
      ctx.arc(Q[j].x, Q[j].y, (3 + 1.8 * Q[j].d) * Q[j].k + 2, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(C.ink, 0.55 * ha);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(Q[hv].x, Q[hv].y, (3 + 1.8 * Q[hv].d) * Q[hv].k + 6, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(C.accent, 0.9 * ha);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /** パケットと、通過・到着した機器の光(パケットが落ちた機器は橙)。尾はまとめて描く */
  function packets(scene: Scene, Q: Projected[], a0: number) {
    const tails = new Path2D();
    const heads: number[] = [];
    for (const q of scene.packets) {
      const t = Math.min(1, q.t / q.dur),
        t0 = Math.max(0, t - CFG.tail);
      const A = Q[q.path[q.hop]],
        B = Q[q.path[q.hop + 1]];
      const hx = A.x + (B.x - A.x) * t,
        hy = A.y + (B.y - A.y) * t;
      tails.moveTo(A.x + (B.x - A.x) * t0, A.y + (B.y - A.y) * t0);
      tails.lineTo(hx, hy);
      heads.push(hx, hy, A.k + (B.k - A.k) * t, A.d + (B.d - A.d) * t);
    }
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = rgba(C.accent, 0.55 * a0);
    ctx.stroke(tails);
    for (let i = 0; i < heads.length; i += 4)
      glow(C.accent, heads[i], heads[i + 1], 9 * heads[i + 2], (0.5 + 0.5 * heads[i + 3]) * a0);
    for (let i = 0; i < scene.n; i++) {
      const nd = scene.nodes[i],
        q = Q[i];
      if (nd.flash > 0.05)
        glow(
          C.accent,
          q.x,
          q.y,
          (10 + 22 * nd.flash) * q.k,
          0.75 * nd.flash * (0.3 + 0.7 * q.d) * a0,
        );
      if (nd.drop > 0.05) glow(C.accent2, q.x, q.y, (12 + 26 * nd.drop) * q.k, 0.9 * nd.drop * a0);
    }
  }

  /** 機器の点。中継機器は端末より大きく描く。故障した機器は橙の輪、届かない端末は薄く描く */
  function nodes(scene: Scene, Q: Projected[], a0: number) {
    for (let i = 0; i < scene.n; i++) {
      const nd = scene.nodes[i],
        q = Q[i];
      const relay = scene.shape.roles[i] === "relay";
      const r = (relay ? 4 + 2.4 * q.d : 2 + 1.8 * q.d) * q.k;
      const depth = 0.35 + 0.65 * q.d;
      ctx.beginPath();
      ctx.arc(q.x, q.y, scene.down.has(i) ? r + 2 : r, 0, Math.PI * 2);
      if (scene.down.has(i)) {
        ctx.strokeStyle = rgba(C.accent2, (0.6 + 0.4 * q.d) * a0);
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.lineWidth = 1;
        continue;
      }
      const col: RGB = mix(relay ? C.ink : C.muted, C.accent, Math.min(1, nd.flash));
      ctx.fillStyle = rgba(col, depth * (scene.cut.has(i) ? 0.3 : 1) * a0);
      ctx.fill();
    }
  }

  /** 1コマ描く。先に scene.project() で投影しておく */
  function draw(scene: Scene) {
    const { W, H, cx, cy } = scene.view;
    const Q = scene.proj,
      a0 = smooth(scene.fade);
    background(W, H, cx, cy);
    links(scene, Q, a0);
    hover(scene, Q, a0);
    ctx.globalCompositeOperation = C.dark ? "lighter" : "source-over";
    ctx.lineCap = "round";
    packets(scene, Q, a0);
    ctx.globalCompositeOperation = "source-over";
    nodes(scene, Q, a0);
  }

  return { draw, resetCaches };
}
