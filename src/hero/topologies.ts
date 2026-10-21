// ネットワークのトポロジ。機器は原点を中心とした半径1以内の3次元の点
import { dist3, type Vec3 } from "./math";

/** 機器の役割。relay は中継機器、terminal は端末 */
export type Role = "relay" | "terminal";

export type Topology = {
  name: string;
  nodes: Vec3[];
  edges: [number, number][];
  roles: Role[];
};

/** 隣接リストと辺の長さを作る。len のキーは a * n + b */
export function toGraph(t: Topology) {
  const n = t.nodes.length;
  const nbrs: number[][] = Array.from({ length: n }, () => []);
  const len = new Map<number, number>();
  for (const [a, b] of t.edges) {
    nbrs[a].push(b);
    nbrs[b].push(a);
    const l = dist3(t.nodes[a], t.nodes[b]);
    len.set(a * n + b, l);
    len.set(b * n + a, l);
  }
  return { n, nbrs, len };
}

/** 単位球の上に n 個の点を均等に並べる(フィボナッチ格子) */
function sphere(n: number): Vec3[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - ((i + 0.5) / n) * 2,
      r = Math.sqrt(1 - y * y);
    return [Math.cos(golden * i) * r, y, Math.sin(golden * i) * r];
  });
}

/** ハブ1台を中心に、端末12台が球面上に並ぶ */
export function star(): Topology {
  const terminals = sphere(12);
  return {
    name: "STAR",
    nodes: [[0, 0, 0], ...terminals],
    edges: terminals.map((_, i): [number, number] => [0, i + 1]),
    roles: ["relay", ...terminals.map((): Role => "terminal")],
  };
}

/** 端末16台が水平な円に並び、隣どうしでつながる */
export function ring(): Topology {
  const n = 16;
  return {
    name: "RING",
    nodes: Array.from({ length: n }, (_, i): Vec3 => {
      const a = (i / n) * Math.PI * 2;
      return [Math.cos(a), 0, Math.sin(a)];
    }),
    edges: Array.from({ length: n }, (_, i): [number, number] => [i, (i + 1) % n]),
    roles: Array.from({ length: n }, (): Role => "terminal"),
  };
}

/** 根1台 → 中間3台 → 端末9台。根を上に、下の段ほど大きな円に並べる(円すい形) */
export function tree(): Topology {
  const nodes: Vec3[] = [[0, 0.75, 0]],
    edges: [number, number][] = [],
    roles: Role[] = ["relay"];
  const at = (angle: number, r: number, y: number): Vec3 => [
    Math.cos(angle) * r,
    y,
    Math.sin(angle) * r,
  ];
  for (let m = 0; m < 3; m++) {
    const am = (m / 3) * Math.PI * 2;
    const mid = nodes.push(at(am, 0.35, 0.05)) - 1;
    roles.push("relay");
    edges.push([0, mid]);
    // 端末は親の中間の真下あたりに、扇形に広げて並べる
    for (let k = -1; k <= 1; k++) {
      const leaf = nodes.push(at(am + (k * Math.PI * 2) / 9, 0.75, -0.6)) - 1;
      roles.push("terminal");
      edges.push([mid, leaf]);
    }
  }
  return { name: "TREE", nodes, edges, roles };
}
