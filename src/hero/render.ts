// canvas への描画。シーンの状態を読んで1コマ描く(シーンは書き換えない)
import { mix, rgba, type RGB } from "./color";
import { CFG } from "./config";
import { clamp, smooth } from "./math";
import type { EdgeEvent } from "./algorithms";
import { C } from "./palette";
import type { Projected, Scene } from "./scene";

export function createRenderer(ctx: CanvasRenderingContext2D, reduceMotion: boolean) {
  /* 光の粒(色ごとに1枚作って使い回す) */
  const glowCache = new Map<number, HTMLCanvasElement>();
  function glow(ci: number, x: number, y: number, r: number, a: number) {
    if (a <= 0.01) return;
    let s = glowCache.get(ci);
    if (!s) {
      const c = C.pal[ci];
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
      glowCache.set(ci, s);
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

  /** 辺(奥行きで3段階の濃さ) */
  function links(scene: Scene, Q: Projected[], a0: number) {
    const bands = [new Path2D(), new Path2D(), new Path2D()];
    for (const [a, b] of scene.shape.edges) {
      const path = bands[Math.min(2, Math.floor(((Q[a].d + Q[b].d) / 2) * 3))];
      path.moveTo(Q[a].x, Q[a].y);
      path.lineTo(Q[b].x, Q[b].y);
    }
    ctx.lineWidth = 1;
    bands.forEach((pa, i) => {
      ctx.strokeStyle = rgba(C.edge, (0.22 + i * 0.22) * a0);
      ctx.stroke(pa);
    });
  }

  /** ホバー: いちばん近い頂点と、その隣を照らす */
  function hover(scene: Scene, Q: Projected[], a0: number) {
    const hv = scene.hover,
      ha = scene.hoverA * a0;
    if (hv < 0 || ha <= 0.01) return;
    ctx.beginPath();
    for (const j of scene.nbrs[hv]) {
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

  /** 頂点ごとの、クリックした処理の色・濃さ・大きく描くか */
  type WaveMarks = { col: Int8Array; a: Float32Array; big: Uint8Array };

  /** クリックした処理: 出来事を時刻順にたどり、済んだ分だけ描く */
  function waves(scene: Scene, Q: Projected[], a0: number): WaveMarks {
    const marks: WaveMarks = {
      col: new Int8Array(scene.n).fill(-1),
      a: new Float32Array(scene.n),
      big: new Uint8Array(scene.n),
    };
    for (const w of scene.waves) {
      const tt = w.t,
        out = clamp((w.end - tt) / 0.8, 0, 1) * a0;
      const kept = new Map<string, EdgeEvent>(); // 残る辺(同じ key は後の出来事で上書き)
      let idx = 0;
      for (const ev of w.events) {
        if (tt < ev.t) break;
        if (ev.e) {
          if (ev.fade) {
            const al = Math.exp(-Math.max(0, tt - ev.t - ev.dur) / ev.fade) * out;
            if (al < 0.02) continue;
            const A = Q[ev.a],
              B = Q[ev.b],
              f = Math.min(1, (tt - ev.t) / ev.dur);
            ctx.strokeStyle = rgba(C.pal[ev.c], 0.85 * al);
            ctx.lineWidth = ev.w || 2;
            ctx.beginPath();
            ctx.moveTo(A.x, A.y);
            ctx.lineTo(A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f);
            ctx.stroke();
          } else {
            const key = ev.key || "i" + idx++;
            if (ev.c < 0) kept.delete(key);
            else kept.set(key, ev);
          }
        } else {
          marks.col[ev.v] = ev.c;
          marks.a[ev.v] = out;
          marks.big[ev.v] = ev.big ? 1 : 0;
          const age = tt - ev.t;
          if (ev.c >= 0 && age < 0.6)
            glow(
              ev.c,
              Q[ev.v].x,
              Q[ev.v].y,
              (10 + 14 * (1 - age / 0.6)) * Q[ev.v].k,
              (1 - age / 0.6) * out,
            );
        }
      }
      const groups = new Map<string, Path2D>();
      for (const ev of kept.values()) {
        const A = Q[ev.a],
          B = Q[ev.b],
          f = Math.min(1, (tt - ev.t) / ev.dur);
        const hx = A.x + (B.x - A.x) * f,
          hy = A.y + (B.y - A.y) * f;
        const g = `${ev.c}|${ev.w || 2}|${ev.alpha || 0.8}`;
        if (!groups.has(g)) groups.set(g, new Path2D());
        groups.get(g)!.moveTo(A.x, A.y);
        groups.get(g)!.lineTo(hx, hy);
        if (f < 1) glow(ev.c, hx, hy, 8 * B.k, 0.9 * out);
      }
      for (const [g, pa] of groups) {
        const [c, lw, al] = g.split("|").map(Number);
        ctx.strokeStyle = rgba(C.pal[c], al * out);
        ctx.lineWidth = lw;
        ctx.stroke(pa);
      }
      if (tt < 0.5) glow(w.c0, Q[w.src].x, Q[w.src].y, 46 * Q[w.src].k, (1 - tt / 0.5) * out);
    }
    return marks;
  }

  /** 環境の信号と、届いた頂点の光。尾は色ごとにまとめて描く */
  function pulses(scene: Scene, Q: Projected[], a0: number) {
    const tails = C.pal.map(() => new Path2D());
    const heads: number[] = [];
    for (const q of scene.pulses) {
      const t = Math.min(1, q.t / q.dur),
        t0 = Math.max(0, t - CFG.tail);
      const A = Q[q.a],
        B = Q[q.b];
      const hx = A.x + (B.x - A.x) * t,
        hy = A.y + (B.y - A.y) * t;
      tails[q.ci].moveTo(A.x + (B.x - A.x) * t0, A.y + (B.y - A.y) * t0);
      tails[q.ci].lineTo(hx, hy);
      heads.push(q.ci, hx, hy, A.k, A.d + (B.d - A.d) * t);
    }
    ctx.lineWidth = 1.8;
    tails.forEach((pa, ci) => {
      ctx.strokeStyle = rgba(C.pal[ci], 0.55 * a0);
      ctx.stroke(pa);
    });
    for (let i = 0; i < heads.length; i += 5)
      glow(heads[i], heads[i + 1], heads[i + 2], 7 * heads[i + 3], (0.4 + 0.5 * heads[i + 4]) * a0);
    for (let i = 0; i < scene.n; i++) {
      const nd = scene.nodes[i],
        q = Q[i];
      if (nd.flash > 0.05)
        glow(nd.ci, q.x, q.y, (10 + 26 * nd.flash) * q.k, 0.75 * nd.flash * (0.3 + 0.7 * q.d) * a0);
    }
  }

  /** 頂点の点 */
  function nodes(scene: Scene, Q: Projected[], a0: number, marks: WaveMarks) {
    for (let i = 0; i < scene.n; i++) {
      const nd = scene.nodes[i],
        q = Q[i];
      let col: RGB = mix(C.muted, C.dark ? mix(C.pal[nd.ci], C.ink, 0.2) : C.pal[nd.ci], nd.heat);
      if (marks.col[i] >= 0)
        col = mix(
          col,
          C.dark ? mix(C.pal[marks.col[i]], C.ink, 0.15) : C.pal[marks.col[i]],
          marks.a[i],
        );
      ctx.beginPath();
      ctx.arc(
        q.x,
        q.y,
        (1.5 + 1.8 * q.d) * q.k + (marks.col[i] >= 0 ? marks.a[i] * (marks.big[i] ? 3 : 1) : 0),
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = rgba(col, (0.3 + 0.7 * q.d) * a0);
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
    const marks = waves(scene, Q, a0);
    pulses(scene, Q, a0);
    ctx.globalCompositeOperation = "source-over";
    nodes(scene, Q, a0, marks);
  }

  return { draw, resetCaches };
}
