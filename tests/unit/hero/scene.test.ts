// シーン: トポロジの切り替え、パケットの送信、画面への投影とホバー
import { describe, expect, test } from "vitest";
import { seededRandom } from "./random";
import { CFG } from "../../../src/hero/config";
import { route } from "../../../src/hero/routing";
import { Scene, type SceneHooks } from "../../../src/hero/scene";

const W = 800,
  H = 460;
const hooks: SceneHooks = { onLabel() {} };

function sceneOf(reduceMotion = false) {
  Math.random = seededRandom(1);
  const scene = new Scene(hooks, reduceMotion);
  scene.project(W, H);
  return scene;
}

/** dt 秒ずつ sec 秒進め、毎コマ each を呼ぶ */
function run(scene: Scene, sec: number, each: () => void = () => {}, dt = 1 / 30) {
  for (let t = 0; t < sec; t += dt) {
    scene.update(dt);
    each();
  }
}

describe("トポロジの切り替え", () => {
  test("STAR → RING → TREE の順に、16秒ごとに切り替わる", () => {
    const names: string[] = [];
    Math.random = seededRandom(1);
    const scene = new Scene({ onLabel: (s) => names.push(s) }, false);
    run(scene, 3 * CFG.hold + 3);
    expect(names).toEqual(["STAR", "RING", "TREE", "STAR"]);
  });

  test("?dev で固定した形は切り替わらない", () => {
    const scene = sceneOf();
    scene.setShape(1);
    run(scene, 2 * CFG.hold);
    expect(scene.shape.name).toBe("RING");
  });
});

describe.each([0, 1, 2])("パケット(形 %i)", (si) => {
  const scene = sceneOf();
  scene.setShape(si);
  const isTerminal = (v: number) => scene.shape.roles[v] === "terminal";

  test("端末から別の端末へ、最短経路で1ホップずつ進む", () => {
    let seen = 0;
    run(scene, 10, () => {
      for (const q of scene.packets) {
        const [a, b] = [q.path[0], q.path.at(-1)!];
        expect(isTerminal(a) && isTerminal(b) && a !== b).toBe(true);
        expect(q.path).toEqual(route(scene.nbrs, a, b));
        expect(q.hop).toBeGreaterThanOrEqual(0);
        expect(q.hop).toBeLessThan(q.path.length - 1);
        seen++;
      }
    });
    expect(seen).toBeGreaterThan(0);
  });

  test("約0.5秒ごとに1つ送り、同時に飛ぶ数は上限を超えない", () => {
    const ids = new Set<number>();
    let most = 0;
    run(scene, 20, () => {
      for (const q of scene.packets) ids.add(q.id);
      most = Math.max(most, scene.packets.length);
    });
    expect(ids.size).toBeGreaterThanOrEqual(Math.floor(20 / CFG.interval) - 1);
    expect(most).toBeGreaterThan(1);
    expect(most).toBeLessThanOrEqual(CFG.maxPackets);
  });

  test("通過・到着した機器は一瞬光る", () => {
    const lit: number[] = [];
    run(scene, 5, () => {
      for (const q of scene.packets) {
        const prev = q.path[q.hop];
        if (q.hop > 0) lit.push(scene.nodes[prev].flash);
      }
    });
    expect(lit.length).toBeGreaterThan(0);
    expect(Math.max(...lit)).toBeGreaterThan(0.9);
  });
});

describe("故障", () => {
  /** 形を選んだシーン。STAR は 0、RING は 1、TREE は 2 */
  function on(si: number) {
    const scene = sceneOf();
    scene.setShape(si);
    scene.project(W, H);
    return scene;
  }
  const HUB = 0;

  test("画面の中央をクリックすると STAR のハブが故障し、もう一度クリックすると直る", () => {
    const labels: string[] = [];
    Math.random = seededRandom(1);
    const scene = new Scene({ onLabel: (s) => labels.push(s) }, false);
    scene.project(W, H);
    scene.click(W / 2, H / 2);
    expect([...scene.down.keys()]).toEqual([HUB]);
    expect(labels.at(-1)).toBe("STAR · 1 DOWN");
    scene.click(W / 2, H / 2);
    expect(scene.down.size).toBe(0);
    expect(labels.at(-1)).toBe("STAR");
  });

  test("機器のないところをクリックしても何も起きない", () => {
    const scene = on(0);
    scene.click(5, 5);
    expect(scene.down.size).toBe(0);
  });

  test("複数台を同時に故障させられる", () => {
    const scene = on(1);
    scene.fail(3);
    scene.fail(11);
    expect(scene.label).toBe("RING · 2 DOWN");
  });

  test("約8秒で直る", () => {
    const scene = on(1);
    scene.fail(3);
    run(scene, 7.5);
    expect(scene.down.has(3)).toBe(true);
    run(scene, 1);
    expect(scene.down.has(3)).toBe(false);
    expect(scene.label).toBe("RING");
  });

  test("故障中はトポロジを切り替えず、すべて直ると切り替えが再開する", () => {
    const scene = sceneOf();
    scene.fail(1);
    run(scene, 7);
    scene.fail(2); // 1 は 8秒で直るが、2 は 15秒まで故障している
    run(scene, 13);
    expect(scene.shape.name).toBe("STAR");
    run(scene, CFG.hold);
    expect(scene.shape.name).toBe("RING");
  });

  test("故障した機器を経由するはずだったパケットは、そこで橙に光って消える", () => {
    const scene = on(0);
    // ハブへ向かっているパケットが出るまで進める
    run(scene, 1);
    const doomed = scene.packets.filter((q) => q.path.indexOf(HUB) > q.hop).map((q) => q.id);
    expect(doomed.length).toBeGreaterThan(0);
    scene.fail(HUB);
    let drop = 0;
    run(scene, 3, () => {
      drop = Math.max(drop, scene.nodes[HUB].drop);
      for (const q of scene.packets)
        if (doomed.includes(q.id)) expect(q.hop).toBeLessThan(q.path.indexOf(HUB));
    });
    expect(scene.packets.filter((q) => doomed.includes(q.id))).toHaveLength(0);
    expect(drop).toBeGreaterThan(0.9);
  });

  test("新しいパケットは届く組の間だけで送られ、故障した機器を通らない", () => {
    const scene = on(1);
    scene.fail(3);
    scene.fail(11);
    const after = scene.pid;
    let sent = 0;
    run(scene, 7, () => {
      for (const q of scene.packets.filter((q) => q.id > after)) {
        expect(q.path).not.toContain(3);
        expect(q.path).not.toContain(11);
        sent++;
      }
    });
    expect(sent).toBeGreaterThan(0);
  });

  test("STAR のハブが故障すると、端末はすべて届かなくなり、パケットは出ない", () => {
    const scene = on(0);
    scene.fail(HUB);
    expect(scene.cut.size).toBe(12);
    const after = scene.pid;
    run(scene, 5);
    expect(scene.pid).toBe(after);
  });

  test("TREE の中間が故障すると、その下の端末3台だけが届かなくなる", () => {
    const scene = on(2);
    const mid = scene.nbrs[0][0];
    scene.fail(mid);
    const below = scene.nbrs[mid].filter((v) => v !== 0);
    expect([...scene.cut].sort()).toEqual(below.sort());
  });

  test("TREE の根が故障しても、どの端末も同じ中間の下の端末には届く", () => {
    const scene = on(2);
    scene.fail(0);
    expect(scene.cut.size).toBe(0);
  });

  test("直ると、届かなかった端末も元に戻る", () => {
    const scene = on(0);
    scene.fail(HUB);
    scene.fail(HUB);
    expect(scene.cut.size).toBe(0);
  });
});

/** いちばん手前に投影された機器の番号 */
const front = (scene: Scene) =>
  scene.proj.reduce((best, q, i, all) => (q.d > all[best].d ? i : best), 0);

function pointAt(scene: Scene, i: number, mouse = true) {
  const { x, y } = scene.proj[i];
  Object.assign(scene.ptr, { x, y, inside: true, mouse });
  scene.project(W, H);
}

describe("ホバー", () => {
  test("投影した機器の上にマウスを置くと、その機器を照らす", () => {
    const scene = sceneOf();
    const i = front(scene);
    pointAt(scene, i);
    expect(scene.hover).toBe(i);
    expect(scene.hoverOn).toBe(true);
  });

  test("タッチではホバーしない", () => {
    const scene = sceneOf();
    pointAt(scene, front(scene), false);
    expect(scene.hover).toBe(-1);
  });

  test("ドラッグ中はホバーしない", () => {
    const scene = sceneOf();
    scene.dragging = true;
    pointAt(scene, front(scene));
    expect(scene.hover).toBe(-1);
  });

  test("マウスが離れると、照らす強さが下がりきってからホバーを外す", () => {
    const scene = sceneOf();
    const i = front(scene);
    pointAt(scene, i);
    for (let k = 0; k < 30; k++) scene.update(1 / 60);
    scene.ptr.inside = false;
    scene.project(W, H);
    expect(scene.hover).toBe(i);
    for (let k = 0; k < 120; k++) {
      scene.update(1 / 60);
      scene.project(W, H);
    }
    expect(scene.hover).toBe(-1);
  });

  test("動きを減らす設定では、照らす強さが即座に切り替わる", () => {
    const scene = sceneOf(true);
    pointAt(scene, front(scene));
    expect(scene.hoverA).toBe(1);
    scene.ptr.inside = false;
    scene.project(W, H);
    expect(scene.hoverA).toBe(0);
  });
});
