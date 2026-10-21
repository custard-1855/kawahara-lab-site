// シーン: トポロジの切り替え、パケットの送信、画面への投影とホバー
import { describe, expect, test } from "vitest";
import { seededRandom } from "./random";
import { CFG } from "../../../src/hero/config";
import { route } from "../../../src/hero/routing";
import { Scene, type SceneHooks } from "../../../src/hero/scene";

const W = 800,
  H = 460;
const hooks: SceneHooks = { onShapeLoad() {} };

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
    const scene = new Scene({ onShapeLoad: (t) => names.push(t.name) }, false);
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
