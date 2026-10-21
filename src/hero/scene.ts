// 回転するトポロジと、その上を飛ぶパケットの状態。時間を進める(update)が、描き方と DOM は知らない
import { BASE_TILT, CFG } from "./config";
import { clamp, smooth, type Vec3 } from "./math";
import { route } from "./routing";
import { ring, star, toGraph, tree, type Topology } from "./topologies";

/** 見せるトポロジ(この順に切り替える) */
export const showcase = (): Topology[] => [star(), ring(), tree()];

/** path に沿って1ホップずつ進むパケット。今は path[hop] → path[hop + 1] のリンクの上にいる */
export type Packet = { id: number; path: number[]; hop: number; t: number; dur: number };
/** flash は通過・到着したときに光る強さ(1 から減っていく) */
export type NodeState = { p: Vec3; flash: number };
/** 画面に投影した機器。k は遠近の倍率、d は手前ほど 1 に近い奥行き */
export type Projected = { x: number; y: number; k: number; d: number };

export type SceneHooks = {
  /** トポロジを読み込んだ */
  onShapeLoad(shape: Topology): void;
};

export class Scene {
  list = showcase();
  si = 0;
  /** 検証用に固定した形の番号(null は自動の切り替え) */
  lock: number | null = null;
  rot = 0;
  tilt = BASE_TILT;
  vRot = 0;
  vTilt = 0;
  pid = 0;
  shapeT = 0;
  fade = 1;
  dragging = false;
  idle = 99;
  hover = -1;
  hoverA = 0;
  hoverOn = false;
  ptr = { x: 0, y: 0, inside: false, mouse: false };
  /** 最後に投影した画面の大きさと、形の中心 */
  view = { W: 1, H: 1, cx: 0.5, cy: 0.5 };

  shape!: Topology;
  n = 0;
  nbrs: number[][] = [];
  len = new Map<number, number>();
  /** パケットの送信元・宛先になる機器 */
  terminals: number[] = [];
  packets: Packet[] = [];
  timer = 0;
  nodes: NodeState[] = [];
  proj: Projected[] = [];

  constructor(
    private readonly hooks: SceneHooks,
    private readonly reduceMotion: boolean,
  ) {
    this.load(this.list[0]);
  }

  load(shape: Topology) {
    const { n, nbrs, len } = toGraph(shape);
    Object.assign(this, { shape, n, nbrs, len, packets: [], timer: 0, hover: -1, hoverA: 0 });
    this.terminals = shape.roles.flatMap((r, i) => (r === "terminal" ? [i] : []));
    this.nodes = shape.nodes.map((p) => ({ p, flash: 0 }));
    this.proj = this.nodes.map(() => ({ x: 0, y: 0, k: 1, d: 0 }));
    this.hooks.onShapeLoad(shape);
  }

  /** リンク a→b を渡るのにかかる秒数 */
  hopDur(a: number, b: number) {
    return 0.25 + this.len.get(a * this.n + b)! * CFG.pace;
  }

  /** 端末からランダムに2台選び、その間を最短経路で送る */
  send() {
    const T = this.terminals;
    if (T.length < 2 || this.packets.length >= CFG.maxPackets) return;
    const ia = (Math.random() * T.length) | 0;
    let ib = (Math.random() * (T.length - 1)) | 0;
    if (ib >= ia) ib++;
    const [a, b] = [T[ia], T[ib]];
    const path = route(this.nbrs, a, b);
    if (!path) return;
    this.nodes[a].flash = 1;
    this.packets.push({ id: ++this.pid, path, hop: 0, t: 0, dur: this.hopDur(a, path[1]) });
  }

  update(dt: number) {
    this.idle += dt;
    if (!this.dragging) {
      // 手を離したあとは慣性で回り、やがて自動回転に戻る
      const decay = Math.exp(-dt * 2.5);
      this.vRot *= decay;
      this.vTilt *= decay;
      this.rot += dt * (CFG.spin + this.vRot);
      this.tilt = clamp(this.tilt + dt * this.vTilt, -1.2, 1.2);
      if (this.idle > 2) this.tilt += (BASE_TILT - this.tilt) * Math.min(1, dt * 0.5);
    }
    this.timer += dt;
    if (this.timer > CFG.interval) {
      this.timer -= CFG.interval;
      this.send();
    }
    // 触っている間は、形を切り替えない
    if (this.lock === null && !this.dragging && this.idle > 4) this.shapeT += dt;
    if (this.shapeT > CFG.hold) {
      this.fade = Math.max(0, this.fade - dt * 1.5);
      if (this.fade === 0) {
        this.si = (this.si + 1) % this.list.length;
        this.load(this.list[this.si]);
        this.shapeT = 0;
      }
    } else {
      this.fade = Math.min(1, this.fade + dt * 1.5);
    }
    const fl = Math.exp(-dt * 2.4);
    for (const nd of this.nodes) nd.flash *= fl;
    this.packets = this.packets.filter((q) => {
      q.t += dt;
      while (q.t >= q.dur) {
        q.t -= q.dur;
        q.hop++;
        const v = q.path[q.hop];
        this.nodes[v].flash = 1;
        if (q.hop === q.path.length - 1) return false;
        q.dur = this.hopDur(v, q.path[q.hop + 1]);
      }
      return true;
    });
    this.hoverA += ((this.hoverOn ? 1 : 0) - this.hoverA) * Math.min(1, dt * 8);
  }

  // 検証用: 形を選んで固定する(null で自動の切り替えに戻す)
  setShape(i: number | null) {
    this.lock = i;
    if (i === null) {
      this.shapeT = 0;
      return;
    }
    this.si = i;
    this.load(this.list[i]);
    this.shapeT = 0;
    // 動きを減らす設定ではフェードインが進まないので、すぐに静止画まで進める
    if (this.reduceMotion) this.settle();
    else this.fade = 0;
  }

  // パケットを3秒ぶん進める(形は切り替えない)
  settle() {
    for (let i = 0; i < 90; i++) {
      this.shapeT = 0;
      this.update(1 / 30);
    }
    this.fade = 1;
  }

  /** 画面の大きさに合わせて機器を投影し、ポインタの近くの機器を照らす対象に選ぶ。描く前に呼ぶ */
  project(W: number, H: number) {
    const wide = W > H * 1.3;
    // サイトでは文言を枠の外に置くので、形は枠の中央に描く
    const cx = W / 2,
      cy = H / 2;
    const S =
      (wide ? Math.min(H * 0.6, W * 0.34) : Math.min(W, H) * 0.56) *
      CFG.size *
      (0.85 + 0.15 * smooth(this.fade));
    const m0 = Math.cos(this.rot),
      m1 = Math.sin(this.rot),
      m2 = Math.cos(this.tilt),
      m3 = Math.sin(this.tilt);
    this.view = { W, H, cx, cy };
    this.nodes.forEach(({ p }, i) => {
      const out = this.proj[i];
      const x = p[0] * m0 + p[2] * m1,
        z1 = -p[0] * m1 + p[2] * m0;
      const y = -p[1] * m2 - z1 * m3,
        z = -p[1] * m3 + z1 * m2;
      const k = 3 / (3 - z);
      out.x = cx + x * S * k;
      out.y = cy + y * S * k;
      out.k = k;
      out.d = clamp((z + 1.2) / 2.4, 0, 1);
    });
    this.updateHover();
  }

  private updateHover() {
    const { ptr } = this;
    const h = ptr.inside && ptr.mouse && !this.dragging ? this.nearest(ptr.x, ptr.y, 40) : -1;
    this.hoverOn = h >= 0;
    if (h >= 0) this.hover = h;
    else if (this.hoverA < 0.02) this.hover = -1;
    if (this.reduceMotion) this.hoverA = this.hoverOn ? 1 : 0;
  }

  nearest(x: number, y: number, radius: number) {
    let best = -1,
      bd = radius * radius;
    this.proj.forEach((q, i) => {
      const d = (q.x - x) ** 2 + (q.y - y) ** 2 - q.d * 300;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  // クリック: 故障(#21)が入るまでは、触ったことだけを記録する
  click(_x: number, _y: number) {
    this.idle = 0;
  }
}
