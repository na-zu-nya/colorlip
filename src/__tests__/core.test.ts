import { describe, expect, it } from "vitest";
import {
  aggregateColors,
  calculateColorDistance,
  calculateColorSimilarity,
  createDominantColor,
  extractFallbackPalette,
  extractFromPixels,
  getHueCategory,
  rgbToHex,
  rgbToHsl,
} from "../core";

// ---------------------------------------------------------------------------
// ヘルパー: 単色の画像ピクセルデータを生成
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

/** ストライプ画像: 上半分 color1, 下半分 color2 */
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
// rgbToHex
// ---------------------------------------------------------------------------
describe("rgbToHex", () => {
  it("基本的な変換", () => {
    expect(rgbToHex(255, 0, 0)).toBe("#FF0000");
    expect(rgbToHex(0, 255, 0)).toBe("#00FF00");
    expect(rgbToHex(0, 0, 255)).toBe("#0000FF");
  });

  it("ゼロパディング", () => {
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(1, 2, 3)).toBe("#010203");
  });

  it("白", () => {
    expect(rgbToHex(255, 255, 255)).toBe("#FFFFFF");
  });
});

// ---------------------------------------------------------------------------
// rgbToHsl
// ---------------------------------------------------------------------------
describe("rgbToHsl", () => {
  it("純粋な赤", () => {
    const hsl = rgbToHsl(255, 0, 0);
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });

  it("純粋な緑", () => {
    const hsl = rgbToHsl(0, 255, 0);
    expect(hsl.h).toBe(120);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });

  it("純粋な青", () => {
    const hsl = rgbToHsl(0, 0, 255);
    expect(hsl.h).toBe(240);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });

  it("グレー（彩度0）", () => {
    const hsl = rgbToHsl(128, 128, 128);
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// getHueCategory
// ---------------------------------------------------------------------------
describe("getHueCategory", () => {
  it("赤系", () => {
    expect(getHueCategory(0)).toBe("red");
    expect(getHueCategory(350)).toBe("red");
  });

  it("オレンジ系", () => {
    expect(getHueCategory(30)).toBe("orange");
  });

  it("黄色系", () => {
    expect(getHueCategory(60)).toBe("yellow");
  });

  it("緑系", () => {
    expect(getHueCategory(120)).toBe("green");
  });

  it("シアン系", () => {
    expect(getHueCategory(180)).toBe("cyan");
  });

  it("青系", () => {
    expect(getHueCategory(240)).toBe("blue");
  });

  it("紫系", () => {
    expect(getHueCategory(300)).toBe("violet");
  });

  it("負の値を正規化", () => {
    expect(getHueCategory(-10)).toBe("red");
  });

  it("360以上を正規化", () => {
    expect(getHueCategory(370)).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// createDominantColor
// ---------------------------------------------------------------------------
describe("createDominantColor", () => {
  it("全フィールドが正しくセットされる", () => {
    const c = createDominantColor(255, 0, 0, 0.5);
    expect(c.r).toBe(255);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
    expect(c.hex).toBe("#FF0000");
    expect(c.percentage).toBe(0.5);
    expect(c.hue).toBe(0);
    expect(c.saturation).toBe(100);
    expect(c.lightness).toBe(50);
    expect(c.hueCategory).toBe("red");
  });

  it("グレーは hueCategory が gray になる", () => {
    const c = createDominantColor(128, 128, 128, 1);
    expect(c.hueCategory).toBe("gray");
  });
});

// ---------------------------------------------------------------------------
// calculateColorDistance
// ---------------------------------------------------------------------------
describe("calculateColorDistance", () => {
  it("同じ色の距離は 0", () => {
    expect(calculateColorDistance(100, 100, 100, 100, 100, 100)).toBe(0);
  });

  it("異なる色の距離は正の値", () => {
    const d = calculateColorDistance(255, 0, 0, 0, 255, 0);
    expect(d).toBeGreaterThan(0);
  });

  it("近い色は遠い色より距離が小さい", () => {
    const dNear = calculateColorDistance(100, 100, 100, 110, 100, 100);
    const dFar = calculateColorDistance(100, 100, 100, 200, 0, 0);
    expect(dNear).toBeLessThan(dFar);
  });
});

// ---------------------------------------------------------------------------
// calculateColorSimilarity
// ---------------------------------------------------------------------------
describe("calculateColorSimilarity", () => {
  it("同じ色は 1", () => {
    const c = createDominantColor(100, 100, 100, 1);
    expect(calculateColorSimilarity(c, c)).toBeCloseTo(1);
  });

  it("反対色は低い類似度", () => {
    const c1 = createDominantColor(255, 0, 0, 1);
    const c2 = createDominantColor(0, 255, 255, 1);
    expect(calculateColorSimilarity(c1, c2)).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// extractFromPixels
// ---------------------------------------------------------------------------
describe("extractFromPixels", () => {
  it("彩度のある単色画像から 1色を返す", () => {
    // 鮮やかな赤
    const data = makeSolidPixels(200, 50, 50, 10, 10);
    const result = extractFromPixels(data, 10, 10, 3);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]?.hueCategory).toBe("red");
  });

  it("グレー画像ではフォールバックする", () => {
    const data = makeSolidPixels(128, 128, 128, 10, 10);
    const result = extractFromPixels(data, 10, 10, 3);
    // フォールバックにより最低 1色は返る
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("空のピクセルデータでは空配列を返す", () => {
    const result = extractFromPixels(new Uint8Array(0), 0, 0, 3);
    expect(result).toEqual([]);
  });

  it("2色のストライプから 2色を検出する", () => {
    const data = makeStripedPixels([200, 50, 50], [50, 50, 200], 20, 20);
    const result = extractFromPixels(data, 20, 20, 3, { numColors: 2 });
    expect(result.length).toBe(2);
    // 赤系と青系が含まれるはず
    const categories = result.map((c) => c.hueCategory);
    expect(categories).toContain("red");
    expect(categories).toContain("blue");
  });

  it("RGBA データ (4 channels) でも動作する", () => {
    const data = makeSolidPixels(200, 50, 50, 10, 10, 4);
    const result = extractFromPixels(data, 10, 10, 4);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("numColors オプションで抽出数を制御できる", () => {
    const data = makeStripedPixels([200, 50, 50], [50, 200, 50], 20, 20);
    const result = extractFromPixels(data, 20, 20, 3, { numColors: 1 });
    expect(result.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// extractFallbackPalette
// ---------------------------------------------------------------------------
describe("extractFallbackPalette", () => {
  it("単色画像から 1色を返す", () => {
    const data = makeSolidPixels(128, 128, 128, 5, 5);
    const result = extractFallbackPalette(data, 5, 5, 3);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("透明画像では空配列を返す", () => {
    const data = new Uint8Array(10 * 10 * 4); // 全て 0 (alpha=0)
    const result = extractFallbackPalette(data, 10, 10, 4);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// aggregateColors
// ---------------------------------------------------------------------------
describe("aggregateColors", () => {
  it("複数セットの色を集約する", () => {
    const set1 = [createDominantColor(255, 0, 0, 0.8), createDominantColor(0, 255, 0, 0.2)];
    const set2 = [createDominantColor(255, 0, 0, 0.6), createDominantColor(0, 0, 255, 0.4)];

    const result = aggregateColors([set1, set2]);
    expect(result.length).toBeLessThanOrEqual(3);
    // 赤が最もweight が高いはず
    expect(result[0]?.hex).toBe("#FF0000");
  });

  it("空の入力では空配列を返す", () => {
    expect(aggregateColors([])).toEqual([]);
  });
});
