// 経路: 機器のつながり(隣接リスト)の上で、パケットが進む道を決める

/** 故障した機器の集まり(Set でも、直るまでの秒数を持つ Map でもよい) */
export type Down = { has(i: number): boolean };

const NONE: Down = new Set();

/** src から幅優先にたどり、届いた機器の1つ手前を返す(届かない機器は -1)。故障した機器は通らない */
function search(nbrs: number[][], src: number, down: Down) {
  const prev = new Int32Array(nbrs.length).fill(-1);
  if (down.has(src)) return prev;
  prev[src] = src;
  const queue = [src];
  for (let qi = 0; qi < queue.length; qi++)
    for (const v of nbrs[queue[qi]])
      if (prev[v] < 0 && !down.has(v)) {
        prev[v] = queue[qi];
        queue.push(v);
      }
  return prev;
}

/** src から dst までの最短経路(ホップ数が最小)。故障した機器を避け、届かなければ null */
export function route(nbrs: number[][], src: number, dst: number, down = NONE): number[] | null {
  const prev = search(nbrs, src, down);
  if (prev[dst] < 0) return null;
  const path = [dst];
  while (path[0] !== src) path.unshift(prev[path[0]]);
  return path;
}

/** src から届く機器の印(届けば 1)。故障した機器は通らない */
export function reachable(nbrs: number[][], src: number, down = NONE) {
  return search(nbrs, src, down).map((p) => (p < 0 ? 0 : 1));
}
