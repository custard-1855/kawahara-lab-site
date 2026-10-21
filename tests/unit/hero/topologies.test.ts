// トポロジ: 機器の台数と役割、つながり方、配置
import { describe, expect, test } from "vitest";
import { ring, star, tree, type Topology } from "../../../src/hero/topologies";

const count = (t: Topology, role: string) => t.roles.filter((r) => r === role).length;
const dist = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const neighbors = (t: Topology, v: number) =>
  t.edges.flatMap(([a, b]) => (a === v ? [b] : b === v ? [a] : []));
/** from からの段数(リンクをたどった数)。届かない機器は入らない */
function hops(t: Topology, from: number) {
  const d = new Map([[from, 0]]),
    q = [from];
  while (q.length) {
    const u = q.shift()!;
    for (const v of neighbors(t, u))
      if (!d.has(v)) {
        d.set(v, d.get(u)! + 1);
        q.push(v);
      }
  }
  return d;
}

describe("STAR", () => {
  const t = star();

  test("ハブ1台と端末12台で、端末はどれもハブとだけつながる", () => {
    expect(t.name).toBe("STAR");
    expect([count(t, "relay"), count(t, "terminal")]).toEqual([1, 12]);
    const hub = t.roles.indexOf("relay");
    expect(t.edges).toHaveLength(12);
    for (const e of t.edges) expect(e).toContain(hub);
  });

  test("端末はハブを中心とした球面の上に、偏らずに並ぶ", () => {
    const hub = t.nodes[t.roles.indexOf("relay")];
    const terminals = t.nodes.filter((_, i) => t.roles[i] === "terminal");
    const r = dist(hub, terminals[0]);
    for (const p of terminals) expect(dist(hub, p)).toBeCloseTo(r, 9);
    // 球面に12点を最も離して置く(正二十面体)と、隣との距離は半径の約1.05倍
    let min = Infinity;
    for (const p of terminals)
      for (const q of terminals) if (p !== q) min = Math.min(min, dist(p, q));
    expect(min / r).toBeGreaterThan(0.8);
  });
});

describe("RING", () => {
  const t = ring();

  test("端末16台が1つの輪につながる", () => {
    expect(t.name).toBe("RING");
    expect([count(t, "relay"), count(t, "terminal")]).toEqual([0, 16]);
    expect(t.edges).toHaveLength(16);
    for (let i = 0; i < 16; i++) expect(neighbors(t, i)).toHaveLength(2);
    // 0 から隣をたどると、16台すべてを回って 0 に戻る
    const seen = [0];
    let prev = -1,
      cur = 0;
    for (;;) {
      const next = neighbors(t, cur).find((v) => v !== prev)!;
      if (next === 0) break;
      seen.push(next);
      [prev, cur] = [cur, next];
    }
    expect(new Set(seen).size).toBe(16);
  });

  test("水平な円の上に並ぶ", () => {
    const r = Math.hypot(t.nodes[0][0], t.nodes[0][2]);
    for (const p of t.nodes) {
      expect(p[1]).toBeCloseTo(0, 9);
      expect(Math.hypot(p[0], p[2])).toBeCloseTo(r, 9);
    }
  });
});

describe("TREE", () => {
  const t = tree();
  const root = 0;
  const depth = hops(t, root);
  const children = (v: number) => neighbors(t, v).filter((c) => depth.get(c) === depth.get(v)! + 1);
  const level = (k: number) => t.nodes.map((_, i) => i).filter((i) => depth.get(i) === k);

  test("根1台の下に中間3台、その下に端末が3台ずつ(計9台)つながる", () => {
    expect(t.name).toBe("TREE");
    expect(t.edges).toHaveLength(12);
    expect(level(1)).toHaveLength(3);
    for (const m of level(1)) expect(children(m)).toHaveLength(3);
    expect(level(2)).toHaveLength(9);
    expect(level(3)).toHaveLength(0);
  });

  test("根と中間は中継機器、いちばん下の段は端末", () => {
    expect([count(t, "relay"), count(t, "terminal")]).toEqual([4, 9]);
    expect(t.roles[root]).toBe("relay");
    for (const m of level(1)) expect(t.roles[m]).toBe("relay");
    for (const l of level(2)) expect(t.roles[l]).toBe("terminal");
  });

  test("根を上に、下の段ほど大きな円に並ぶ(円すい形)", () => {
    const y = (k: number) => level(k).map((i) => t.nodes[i][1]);
    const radius = (k: number) => level(k).map((i) => Math.hypot(t.nodes[i][0], t.nodes[i][2]));
    expect(Math.min(...y(0))).toBeGreaterThan(Math.max(...y(1)));
    expect(Math.min(...y(1))).toBeGreaterThan(Math.max(...y(2)));
    expect(Math.min(...radius(1))).toBeGreaterThan(Math.max(...radius(0)));
    expect(Math.min(...radius(2))).toBeGreaterThan(Math.max(...radius(1)));
  });
});

describe.each([
  ["STAR", star],
  ["RING", ring],
  ["TREE", tree],
])("%s", (_, make) => {
  const t = make();

  test("自己ループと重複したリンクがなく、端点は機器の範囲にある", () => {
    const keys = new Set(t.edges.map(([a, b]) => (a < b ? `${a},${b}` : `${b},${a}`)));
    expect(keys.size).toBe(t.edges.length);
    for (const [a, b] of t.edges) {
      expect(a).not.toBe(b);
      for (const v of [a, b]) expect(v >= 0 && v < t.nodes.length).toBe(true);
    }
    expect(t.roles).toHaveLength(t.nodes.length);
  });

  test("全体がつながっている", () => {
    expect(hops(t, 0).size).toBe(t.nodes.length);
  });

  test("座標は3次元で、原点からの距離が1以下に収まる", () => {
    for (const p of t.nodes) {
      expect(p).toHaveLength(3);
      expect(Math.hypot(...p)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
