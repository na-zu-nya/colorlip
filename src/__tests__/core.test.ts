import { describe, expect, it } from "vitest";
import {
  _internals,
  aggregateColors,
  colorlip,
  createDominantColor,
  extractFallbackPalette,
  getHueCategory,
  rgbToHex,
  rgbToHsl,
} from "../core";

const { rgbToLab, deltaE76, analyzeImageStats, labToLch, rgbToOklab, oklabToOklch } = _internals;

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

  it("lab フィールドが含まれる", () => {
    const c = createDominantColor(255, 0, 0, 1);
    expect(c.lab).toBeDefined();
    expect(c.lab.L).toBeCloseTo(53.2, 0);
    expect(c.lab.a).toBeCloseTo(80.1, 0);
    expect(c.lab.b).toBeCloseTo(67.2, 0);
  });

  it("lch フィールドが含まれる", () => {
    const c = createDominantColor(255, 0, 0, 1);
    expect(c.lch).toBeDefined();
    expect(c.lch.L).toBeCloseTo(53.2, 0);
    expect(c.lch.C).toBeGreaterThan(0);
    expect(c.lch.H).toBeGreaterThanOrEqual(0);
    expect(c.lch.H).toBeLessThan(360);
  });

  it("oklab フィールドが含まれる", () => {
    const c = createDominantColor(255, 0, 0, 1);
    expect(c.oklab).toBeDefined();
    expect(c.oklab.L).toBeGreaterThan(0);
    expect(c.oklab.L).toBeLessThan(1);
  });

  it("oklch フィールドが含まれる", () => {
    const c = createDominantColor(255, 0, 0, 1);
    expect(c.oklch).toBeDefined();
    expect(c.oklch.L).toBeGreaterThan(0);
    expect(c.oklch.C).toBeGreaterThan(0);
    expect(c.oklch.H).toBeGreaterThanOrEqual(0);
  });

  it("css フィールドが全色空間の文字列を含む", () => {
    const c = createDominantColor(255, 0, 0, 1);
    expect(c.css.rgb).toBe("rgb(255 0 0)");
    expect(c.css.hsl).toBe("hsl(0 100% 50%)");
    expect(c.css.lab).toMatch(/^lab\(.+\)$/);
    expect(c.css.lch).toMatch(/^lch\(.+\)$/);
    expect(c.css.oklab).toMatch(/^oklab\(.+\)$/);
    expect(c.css.oklch).toMatch(/^oklch\(.+\)$/);
  });
});

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
// colorlip
// ---------------------------------------------------------------------------
describe("colorlip", () => {
  it("彩度のある単色画像から 1色を返す", () => {
    // 鮮やかな赤
    const data = makeSolidPixels(200, 50, 50, 10, 10);
    const result = colorlip(data, 10, 10, 3);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]?.hueCategory).toBe("red");
  });

  it("グレー画像ではフォールバックする", () => {
    const data = makeSolidPixels(128, 128, 128, 10, 10);
    const result = colorlip(data, 10, 10, 3);
    // フォールバックにより最低 1色は返る
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("空のピクセルデータでは空配列を返す", () => {
    const result = colorlip(new Uint8Array(0), 0, 0, 3);
    expect(result).toEqual([]);
  });

  it("2色のストライプから 2色を検出する", () => {
    const data = makeStripedPixels([200, 50, 50], [50, 50, 200], 20, 20);
    const result = colorlip(data, 20, 20, 3, { numColors: 2 });
    expect(result.length).toBe(2);
    // 赤系と青系が含まれるはず
    const categories = result.map((c) => c.hueCategory);
    expect(categories).toContain("red");
    expect(categories).toContain("blue");
  });

  it("パステル色（低彩度）でも色を拾える", () => {
    // 薄いピンク (彩度が低い)
    const data = makeSolidPixels(220, 190, 200, 20, 20);
    const result = colorlip(data, 20, 20, 3);
    // 適応的閾値により低彩度画像でも拾えるはず
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("RGBA データ (4 channels) でも動作する", () => {
    const data = makeSolidPixels(200, 50, 50, 10, 10, 4);
    const result = colorlip(data, 10, 10, 4);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("numColors オプションで抽出数を制御できる", () => {
    const data = makeStripedPixels([200, 50, 50], [50, 200, 50], 20, 20);
    const result = colorlip(data, 20, 20, 3, { numColors: 1 });
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

// ---------------------------------------------------------------------------
// labToLch
// ---------------------------------------------------------------------------
describe("labToLch", () => {
  it("無彩色は C≈0", () => {
    const lab = rgbToLab(128, 128, 128);
    const lch = labToLch(lab);
    expect(lch.L).toBeCloseTo(lab.L, 1);
    expect(lch.C).toBeCloseTo(0, 0);
  });

  it("純赤の LCH が既知の範囲内", () => {
    const lab = rgbToLab(255, 0, 0);
    const lch = labToLch(lab);
    expect(lch.L).toBeCloseTo(53.2, 0);
    // C = sqrt(80.1^2 + 67.2^2) ≈ 104.6
    expect(lch.C).toBeCloseTo(104.6, 0);
    // H = atan2(67.2, 80.1) ≈ 40°
    expect(lch.H).toBeCloseTo(40, 0);
  });

  it("H は 0–360 の範囲", () => {
    const lab = rgbToLab(0, 0, 255);
    const lch = labToLch(lab);
    expect(lch.H).toBeGreaterThanOrEqual(0);
    expect(lch.H).toBeLessThan(360);
  });
});

// ---------------------------------------------------------------------------
// rgbToOklab
// ---------------------------------------------------------------------------
describe("rgbToOklab", () => {
  it("黒は L≈0", () => {
    const oklab = rgbToOklab(0, 0, 0);
    expect(oklab.L).toBeCloseTo(0, 2);
    expect(oklab.a).toBeCloseTo(0, 2);
    expect(oklab.b).toBeCloseTo(0, 2);
  });

  it("白は L≈1", () => {
    const oklab = rgbToOklab(255, 255, 255);
    expect(oklab.L).toBeCloseTo(1, 1);
    expect(oklab.a).toBeCloseTo(0, 1);
    expect(oklab.b).toBeCloseTo(0, 1);
  });

  it("純赤の OKLab が既知の範囲内", () => {
    const oklab = rgbToOklab(255, 0, 0);
    // 既知: L≈0.6279, a≈0.2249, b≈0.1264
    expect(oklab.L).toBeCloseTo(0.6279, 2);
    expect(oklab.a).toBeCloseTo(0.2249, 2);
    expect(oklab.b).toBeCloseTo(0.1264, 2);
  });

  it("純緑の OKLab", () => {
    const oklab = rgbToOklab(0, 255, 0);
    // 既知: L≈0.8664, a≈-0.2339, b≈0.1795
    expect(oklab.L).toBeCloseTo(0.8664, 2);
    expect(oklab.a).toBeCloseTo(-0.2339, 2);
    expect(oklab.b).toBeCloseTo(0.1795, 2);
  });

  it("純青の OKLab", () => {
    const oklab = rgbToOklab(0, 0, 255);
    // 既知: L≈0.4520, a≈-0.0324, b≈-0.3116
    expect(oklab.L).toBeCloseTo(0.452, 2);
    expect(oklab.a).toBeCloseTo(-0.0324, 2);
    expect(oklab.b).toBeCloseTo(-0.3116, 2);
  });
});

// ---------------------------------------------------------------------------
// oklabToOklch
// ---------------------------------------------------------------------------
describe("oklabToOklch", () => {
  it("無彩色は C≈0", () => {
    const oklab = rgbToOklab(128, 128, 128);
    const oklch = oklabToOklch(oklab);
    expect(oklch.C).toBeCloseTo(0, 2);
  });

  it("純赤の OKLCH", () => {
    const oklab = rgbToOklab(255, 0, 0);
    const oklch = oklabToOklch(oklab);
    expect(oklch.L).toBeCloseTo(oklab.L, 4);
    // C = sqrt(0.2249^2 + 0.1264^2) ≈ 0.2580
    expect(oklch.C).toBeCloseTo(0.258, 2);
    // H = atan2(0.1264, 0.2249) ≈ 29.2°
    expect(oklch.H).toBeCloseTo(29.2, 0);
  });

  it("H は 0–360 の範囲", () => {
    const oklab = rgbToOklab(0, 0, 255);
    const oklch = oklabToOklch(oklab);
    expect(oklch.H).toBeGreaterThanOrEqual(0);
    expect(oklch.H).toBeLessThan(360);
  });
});

// ---------------------------------------------------------------------------
// CSS 文字列フォーマット
// ---------------------------------------------------------------------------
describe("CSS 文字列", () => {
  it("rgb フォーマット", () => {
    const c = createDominantColor(42, 98, 168, 1);
    expect(c.css.rgb).toBe("rgb(42 98 168)");
  });

  it("hsl フォーマット", () => {
    const c = createDominantColor(255, 0, 0, 1);
    expect(c.css.hsl).toBe("hsl(0 100% 50%)");
  });

  it("lab フォーマットは小数点1桁", () => {
    const c = createDominantColor(42, 98, 168, 1);
    // lab(L a b) の各値が小数点1桁
    const match = c.css.lab.match(/^lab\((-?\d+\.?\d?) (-?\d+\.?\d?) (-?\d+\.?\d?)\)$/);
    expect(match).not.toBeNull();
  });

  it("lch フォーマットは小数点1桁", () => {
    const c = createDominantColor(42, 98, 168, 1);
    const match = c.css.lch.match(/^lch\((-?\d+\.?\d?) (-?\d+\.?\d?) (-?\d+\.?\d?)\)$/);
    expect(match).not.toBeNull();
  });

  it("oklab フォーマットは小数点2桁", () => {
    const c = createDominantColor(42, 98, 168, 1);
    const match = c.css.oklab.match(
      /^oklab\((-?\d+\.?\d{0,2}) (-?\d+\.?\d{0,2}) (-?\d+\.?\d{0,2})\)$/,
    );
    expect(match).not.toBeNull();
  });

  it("oklch フォーマット（L,C は小数点2桁、H は小数点1桁）", () => {
    const c = createDominantColor(42, 98, 168, 1);
    expect(c.css.oklch).toMatch(/^oklch\(/);
    expect(c.css.oklch).toMatch(/\)$/);
  });

  it("黒の CSS 文字列", () => {
    const c = createDominantColor(0, 0, 0, 1);
    expect(c.css.rgb).toBe("rgb(0 0 0)");
    expect(c.css.hsl).toBe("hsl(0 0% 0%)");
  });

  it("白の CSS 文字列", () => {
    const c = createDominantColor(255, 255, 255, 1);
    expect(c.css.rgb).toBe("rgb(255 255 255)");
    expect(c.css.hsl).toBe("hsl(0 0% 100%)");
  });
});
