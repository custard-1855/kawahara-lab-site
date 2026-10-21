// シーン: 画面への投影と、ポインタの近くの機器を照らす判定
import { describe, expect, test } from "vitest";
import { seededRandom } from "./load-hero";
import { Scene, type SceneHooks } from "../../../src/hero/scene";

const W = 800,
  H = 460;
const hooks: SceneHooks = { onShapeLoad() {}, onAlgoStart() {}, onAlgoIdle() {} };

function sceneOf(reduceMotion = false) {
  Math.random = seededRandom(1);
  const scene = new Scene(hooks, reduceMotion);
  scene.project(W, H);
  return scene;
}

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
