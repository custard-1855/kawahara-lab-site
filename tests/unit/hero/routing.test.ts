// 経路: パケットが端末から端末へ進む最短経路
import { describe, expect, test } from "vitest";
import { route } from "../../../src/hero/routing";
import { ring, star, toGraph, tree, type Topology } from "../../../src/hero/topologies";

const terminals = (t: Topology) => t.roles.flatMap((r, i) => (r === "terminal" ? [i] : []));
const pairs = (t: Topology) =>
  terminals(t).flatMap((a) => terminals(t).flatMap((b) => (a === b ? [] : [[a, b]])));

describe.each([
  ["STAR", star],
  ["RING", ring],
  ["TREE", tree],
])("%s", (_, make) => {
  const t = make();
  const { nbrs } = toGraph(t);

  test("経路は送信元から宛先まで、リンクに沿って1ホップずつ進む", () => {
    for (const [a, b] of pairs(t)) {
      const path = route(nbrs, a, b)!;
      expect(path[0]).toBe(a);
      expect(path.at(-1)).toBe(b);
      for (let i = 1; i < path.length; i++) expect(nbrs[path[i - 1]]).toContain(path[i]);
    }
  });
});

test("STAR: 端末どうしはハブだけを経由する", () => {
  const t = star();
  const hub = t.roles.indexOf("relay");
  for (const [a, b] of pairs(t)) expect(route(toGraph(t).nbrs, a, b)).toEqual([a, hub, b]);
});

test("RING: 輪の短い向きを回る", () => {
  const t = ring();
  for (const [a, b] of pairs(t)) {
    const d = Math.abs(a - b);
    expect(route(toGraph(t).nbrs, a, b)!.length - 1).toBe(Math.min(d, 16 - d));
  }
});

test("TREE: 同じ中間の下なら中間だけを、違う中間の下なら中間・根・中間を経由する", () => {
  const t = tree();
  const { nbrs } = toGraph(t);
  const root = 0;
  const mid = (leaf: number) => nbrs[leaf][0];
  for (const [a, b] of pairs(t)) {
    const expected = mid(a) === mid(b) ? [a, mid(a), b] : [a, mid(a), root, mid(b), b];
    expect(route(nbrs, a, b)).toEqual(expected);
    for (const v of expected.slice(1, -1)) expect(t.roles[v]).toBe("relay");
  }
});

describe("故障した機器を避ける", () => {
  test("RING: 隣が故障すると、輪を反対向きに回って迂回する", () => {
    const { nbrs } = toGraph(ring());
    const path = route(nbrs, 0, 2, new Set([1]))!;
    expect(path).toEqual([0, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  });

  test("STAR: ハブが故障すると、どの端末の組にも経路がない", () => {
    const t = star();
    const hub = t.roles.indexOf("relay");
    for (const [a, b] of pairs(t)) expect(route(toGraph(t).nbrs, a, b, new Set([hub]))).toBeNull();
  });

  test("TREE: 根が故障しても、同じ中間の下の端末どうしは届く", () => {
    const t = tree();
    const { nbrs } = toGraph(t);
    const mid = (leaf: number) => nbrs[leaf][0];
    for (const [a, b] of pairs(t)) {
      const path = route(nbrs, a, b, new Set([0]));
      if (mid(a) === mid(b)) expect(path).toEqual([a, mid(a), b]);
      else expect(path).toBeNull();
    }
  });

  test("送信元か宛先が故障していれば、経路はない", () => {
    const { nbrs } = toGraph(ring());
    expect(route(nbrs, 0, 2, new Set([0]))).toBeNull();
    expect(route(nbrs, 0, 2, new Set([2]))).toBeNull();
  });
});
