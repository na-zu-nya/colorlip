import { describe, expect, it } from "vitest";
import { colorlipFromImageData } from "../adapters/canvas";

/**
 * Canvas アダプターのテスト。
 *
 * extractFromImage は OffscreenCanvas / createImageBitmap に依存するため
 * Node.js 環境では完全なテストが難しい。ここでは colorlipFromImageData のみテスト。
 */
describe("colorlipFromImageData", () => {
  function makeImageData(
    r: number,
    g: number,
    b: number,
    a: number,
    w: number,
    h: number,
  ): ImageData {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = a;
    }
    return { data, width: w, height: h, colorSpace: "srgb" } as ImageData;
  }

  it("彩度のある単色 ImageData から色を抽出できる", () => {
    const imageData = makeImageData(200, 50, 50, 255, 10, 10);
    const result = colorlipFromImageData(imageData);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]?.hueCategory).toBe("red");
  });

  it("透明画像では空配列を返す", () => {
    const imageData = makeImageData(0, 0, 0, 0, 10, 10);
    const result = colorlipFromImageData(imageData);
    expect(result).toEqual([]);
  });

  it("numColors オプションで抽出数を制御できる", () => {
    // 上半分赤、下半分青の ImageData
    const w = 20;
    const h = 20;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (y < h / 2) {
          data[i] = 200;
          data[i + 1] = 50;
          data[i + 2] = 50;
        } else {
          data[i] = 50;
          data[i + 1] = 50;
          data[i + 2] = 200;
        }
        data[i + 3] = 255;
      }
    }
    const imageData = { data, width: w, height: h, colorSpace: "srgb" } as ImageData;
    const result = colorlipFromImageData(imageData, { numColors: 1 });
    expect(result.length).toBe(1);
  });
});
