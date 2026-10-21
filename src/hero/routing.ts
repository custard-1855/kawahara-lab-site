// 経路: 機器のつながり(隣接リスト)の上で、パケットが進む道を決める

/** src から dst までの最短経路(ホップ数が最小)。届かなければ null */
export function route(nbrs: number[][], src: number, dst: number): number[] | null {
  const prev = new Int32Array(nbrs.length).fill(-1);
  prev[src] = src;
  const queue = [src];
  for (let qi = 0; qi < queue.length && prev[dst] < 0; qi++)
    for (const v of nbrs[queue[qi]])
      if (prev[v] < 0) {
        prev[v] = queue[qi];
        queue.push(v);
      }
  if (prev[dst] < 0) return null;
  const path = [dst];
  while (path[0] !== src) path.unshift(prev[path[0]]);
  return path;
}
