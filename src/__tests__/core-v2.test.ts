import { describe, expect, it } from "vitest";
import { _internals, extractFromPixelsV2 } from "../core-v2";

const { rgbToLab, deltaE76, analyzeImageStats } = _internals;

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------
function makeSolidPixels(
  r: number,
  g: number,
  b: number,
  w: number,
  h: number,
  channels = 3,
): Uint8Array {
  const data = new Uint8Array(w * h * channels);
  for (let i = 0; i < w * h; i++) {
    data[i * channels] = r;
    data[i * channels + 1] = g;
    data[i * channels + 2] = b;
    if (channels === 4) data[i * channels + 3] = 255;
  }
  return data;
}

function makeStripedPixels(
  c1: [number, number, number],
  c2: [number, number, number],
  w: number,
  h: number,
  channels = 3,
): Uint8Array {
  const data = new Uint8Array(w * h * channels);
  for (let y = 0; y < h; y++) {
    const [r, g, b] = y < h / 2 ? c1 : c2;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      if (channels === 4) data[i + 3] = 255;
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// rgbToLab
// ---------------------------------------------------------------------------
describe("rgbToLab", () => {
  it("黒は L≈0", () => {
    const lab = rgbToLab(0, 0, 0);
    expect(lab.L).toBeCloseTo(0, 0);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });

  it("白は L≈100", () => {
    const lab = rgbToLab(255, 255, 255);
    expect(lab.L).toBeCloseTo(100, 0);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });

  it("純赤の L, a, b が既知の範囲内", () => {
    const lab = rgbToLab(255, 0, 0);
    // 赤: L≈53, a≈80, b≈67
    expect(lab.L).toBeCloseTo(53.2, 0);
    expect(lab.a).toBeCloseTo(80.1, 0);
    expect(lab.b).toBeCloseTo(67.2, 0);
  });

  it("純緑の L, a, b が既知の範囲内", () => {
    const lab = rgbToLab(0, 255, 0);
    // 緑: L≈87, a≈-86, b≈83
    expect(lab.L).toBeCloseTo(87.7, 0);
    expect(lab.a).toBeCloseTo(-86.2, 0);
    expect(lab.b).toBeCloseTo(83.2, 0);
  });

  it("純青の L, a, b が既知の範囲内", () => {
    const lab = rgbToLab(0, 0, 255);
    // 青: L≈32, a≈79, b≈-108
    expect(lab.L).toBeCloseTo(32.3, 0);
    expect(lab.a).toBeCloseTo(79.2, 0);
    expect(lab.b).toBeCloseTo(-107.9, 0);
  });
});

// ---------------------------------------------------------------------------
// deltaE76
// ---------------------------------------------------------------------------
describe("deltaE76", () => {
  it("同一色の距離は 0", () => {
    const lab = rgbToLab(128, 64, 32);
    expect(deltaE76(lab, lab)).toBe(0);
  });

  it("近い色は小さい距離", () => {
    const lab1 = rgbToLab(100, 100, 100);
    const lab2 = rgbToLab(105, 100, 100);
    expect(deltaE76(lab1, lab2)).toBeLessThan(5);
  });

  it("遠い色は大きい距離", () => {
    const lab1 = rgbToLab(255, 0, 0);
    const lab2 = rgbToLab(0, 0, 255);
    expect(deltaE76(lab1, lab2)).toBeGreaterThan(100);
  });

  it("知覚的に近い色は Delta E < 15 に収まる", () => {
    // 似た青2色
    const lab1 = rgbToLab(36, 108, 156);
    const lab2 = rgbToLab(48, 132, 168);
    expect(deltaE76(lab1, lab2)).toBeLessThan(15);
  });
});

// ---------------------------------------------------------------------------
// analyzeImageStats
// ---------------------------------------------------------------------------
describe("analyzeImageStats", () => {
  it("彩度の高い画像では medianSaturation が高い", () => {
    const data = makeSolidPixels(255, 0, 0, 20, 20);
    const stats = analyzeImageStats(data, 20, 20, 3);
    expect(stats.medianSaturation).toBeGreaterThan(0.5);
  });

  it("グレー画像では medianSaturation が低い", () => {
    const data = makeSolidPixels(128, 128, 128, 20, 20);
    const stats = analyzeImageStats(data, 20, 20, 3);
    expect(stats.medianSaturation).toBe(0);
  });

  it("空画像でもクラッシュしない", () => {
    const stats = analyzeImageStats(new Uint8Array(0), 0, 0, 3);
    expect(stats.medianSaturation).toBe(0);
    expect(stats.edgeCentrality).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// extractFromPixelsV2
// ---------------------------------------------------------------------------
describe("extractFromPixelsV2", () => {
  it("彩度のある単色画像から 1色を返す", () => {
    const data = makeSolidPixels(200, 50, 50, 10, 10);
    const result = extractFromPixelsV2(data, 10, 10, 3);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]?.hueCategory).toBe("red");
  });

  it("グレー画像ではフォールバックする", () => {
    const data = makeSolidPixels(128, 128, 128, 10, 10);
    const result = extractFromPixelsV2(data, 10, 10, 3);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("空のピクセルデータでは空配列を返す", () => {
    const result = extractFromPixelsV2(new Uint8Array(0), 0, 0, 3);
    expect(result).toEqual([]);
  });

  it("2色のストライプから 2色を検出する", () => {
    const data = makeStripedPixels([200, 50, 50], [50, 50, 200], 20, 20);
    const result = extractFromPixelsV2(data, 20, 20, 3, { numColors: 2 });
    expect(result.length).toBe(2);
    const categories = result.map((c) => c.hueCategory);
    expect(categories).toContain("red");
    expect(categories).toContain("blue");
  });

  it("パステル色（低彩度）でも色を拾える", () => {
    // 薄いピンク (彩度が低い)
    const data = makeSolidPixels(220, 190, 200, 20, 20);
    const result = extractFromPixelsV2(data, 20, 20, 3);
    // V2 は適応的閾値により低彩度画像でも拾えるはず
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("RGBA データ (4 channels) でも動作する", () => {
    const data = makeSolidPixels(200, 50, 50, 10, 10, 4);
    const result = extractFromPixelsV2(data, 10, 10, 4);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});
