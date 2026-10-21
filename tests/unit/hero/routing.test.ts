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
