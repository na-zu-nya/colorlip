import {
  ALPHA_THRESHOLD,
  BORDER_EDGE_WEIGHT,
  DEFAULT_OPTIONS,
  EDGE_STRENGTH_DIVISOR,
  FALLBACK_QUANTIZATION_STEP,
} from "./constants";
import type {
  CSSColors,
  DominantColor,
  ExtractOptions,
  HSL,
  HueCategory,
  LCH,
  Lab,
  OKLCH,
  OKLab,
  PixelData,
} from "./types";

// ---------------------------------------------------------------------------
// CIELAB color space
// ---------------------------------------------------------------------------

/** RGB (0-255) → CIELAB。D65 白色点使用。 */
function rgbToLab(r: number, g: number, b: number): Lab {
  // sRGB → linear RGB
  let rl = r / 255;
  let gl = g / 255;
  let bl = b / 255;

  rl = rl > 0.04045 ? ((rl + 0.055) / 1.055) ** 2.4 : rl / 12.92;
  gl = gl > 0.04045 ? ((gl + 0.055) / 1.055) ** 2.4 : gl / 12.92;
  bl = bl > 0.04045 ? ((bl + 0.055) / 1.055) ** 2.4 : bl / 12.92;

  // linear RGB → XYZ (D65)
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  let z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;

  // XYZ → Lab
  const epsilon = 0.008856;
  const kappa = 903.3;

  x = x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116;
  y = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116;
  z = z > epsilon ? Math.cbrt(z) : (kappa * z + 16) / 116;

  return {
    L: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

/** CIE76 Delta E（Lab 空間でのユークリッド距離） */
function deltaE76(lab1: Lab, lab2: Lab): number {
  return Math.sqrt((lab1.L - lab2.L) ** 2 + (lab1.a - lab2.a) ** 2 + (lab1.b - lab2.b) ** 2);
}

// ---------------------------------------------------------------------------
// LCH color space (polar Lab)
// ---------------------------------------------------------------------------

/** Lab → LCH（Lab の極座標変換） */
function labToLch(lab: Lab): LCH {
  const C = Math.sqrt(lab.a ** 2 + lab.b ** 2);
  let H = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: lab.L, C, H };
}

// ---------------------------------------------------------------------------
// OKLab color space
// ---------------------------------------------------------------------------

/** RGB (0-255) → OKLab */
function rgbToOklab(r: number, g: number, b: number): OKLab {
  // sRGB → linear RGB
  let rl = r / 255;
  let gl = g / 255;
  let bl = b / 255;

  rl = rl > 0.04045 ? ((rl + 0.055) / 1.055) ** 2.4 : rl / 12.92;
  gl = gl > 0.04045 ? ((gl + 0.055) / 1.055) ** 2.4 : gl / 12.92;
  bl = bl > 0.04045 ? ((bl + 0.055) / 1.055) ** 2.4 : bl / 12.92;

  // linear RGB → LMS (using M1 matrix)
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

  // LMS → LMS' (cube root)
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // LMS' → OKLab (using M2 matrix)
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

// ---------------------------------------------------------------------------
// OKLCH color space (polar OKLab)
// ---------------------------------------------------------------------------

/** OKLab → OKLCH（OKLab の極座標変換） */
function oklabToOklch(oklab: OKLab): OKLCH {
  const C = Math.sqrt(oklab.a ** 2 + oklab.b ** 2);
  let H = (Math.atan2(oklab.b, oklab.a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: oklab.L, C, H };
}

// ---------------------------------------------------------------------------
// CSS color string helpers
// ---------------------------------------------------------------------------

/** 小数点以下を指定桁数に丸める */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** 全色空間から CSS 文字列を生成 */
function createCSSColors(
  r: number,
  g: number,
  b: number,
  hsl: HSL,
  lab: Lab,
  lch: LCH,
  oklab: OKLab,
  oklch: OKLCH,
): CSSColors {
  return {
    rgb: `rgb(${r} ${g} ${b})`,
    hsl: `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`,
    lab: `lab(${round(lab.L, 1)} ${round(lab.a, 1)} ${round(lab.b, 1)})`,
    lch: `lch(${round(lch.L, 1)} ${round(lch.C, 1)} ${round(lch.H, 1)})`,
    oklab: `oklab(${round(oklab.L, 2)} ${round(oklab.a, 2)} ${round(oklab.b, 2)})`,
    oklch: `oklch(${round(oklch.L, 2)} ${round(oklch.C, 2)} ${round(oklch.H, 1)})`,
  };
}

// ---------------------------------------------------------------------------
// Image analysis (sampling pass)
// ---------------------------------------------------------------------------

interface ImageStats {
  /** 彩度の中央値 (0-1) */
  medianSaturation: number;
  /** エッジの中央集中度 (0-1, 1=完全に中央集中) */
  edgeCentrality: number;
}

/** ストライドサンプリングで画像統計を計算 */
function analyzeImageStats(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
): ImageStats {
  const pixelCount = width * height;
  if (pixelCount === 0) return { medianSaturation: 0, edgeCentrality: 0.5 };

  // ~10% サンプリング（最低100、最大2000ピクセル）
  const sampleCount = Math.min(Math.max(Math.floor(pixelCount * 0.1), 100), 2000);
  const stride = Math.max(1, Math.floor(pixelCount / sampleCount));

  const saturations: number[] = [];

  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);

  let edgeWeightedCenterDist = 0;
  let totalEdgeStrength = 0;

  for (let idx = 0; idx < pixelCount; idx += stride) {
    const x = idx % width;
    const y = Math.floor(idx / width);
    const i = idx * channels;

    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;

    // 彩度を収集
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    saturations.push(max === 0 ? 0 : (max - min) / max);

    // エッジ強度を計算（境界でなければ）
    if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
      const getGray = (px: number, py: number): number => {
        const j = (py * width + px) * channels;
        return ((data[j] ?? 0) + (data[j + 1] ?? 0) + (data[j + 2] ?? 0)) / 3;
      };
      const center = getGray(x, y);
      const strength =
        Math.abs(center - getGray(x - 1, y)) +
        Math.abs(center - getGray(x + 1, y)) +
        Math.abs(center - getGray(x, y - 1)) +
        Math.abs(center - getGray(x, y + 1));

      if (strength > 10) {
        const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const normalizedDist = maxDist > 0 ? distFromCenter / maxDist : 0;
        edgeWeightedCenterDist += normalizedDist * strength;
        totalEdgeStrength += strength;
      }
    }
  }

  // 彩度の中央値
  saturations.sort((a, b) => a - b);
  const medianSaturation = saturations[Math.floor(saturations.length / 2)] ?? 0;

  // エッジ集中度: 平均重み付き距離が小さいほど中央集中
  // 0 = 全エッジが中央、1 = 全エッジが辺縁
  const avgEdgeDist = totalEdgeStrength > 0 ? edgeWeightedCenterDist / totalEdgeStrength : 0.5;
  const edgeCentrality = 1 - avgEdgeDist;

  return { medianSaturation, edgeCentrality };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * ピクセルデータから代表色を抽出する（メインエントリ）。
 *
 * 内部で高度なアルゴリズム → フォールバック → 平均色 の順にフォールバックする。
 */
export function colorlip(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
  options?: ExtractOptions,
): DominantColor[] {
  const opts = resolveOptions(options);

  const result = extractAdvanced(data, width, height, channels, opts);
  if (result.length > 0) return result;

  return extractFallbackPalette(data, width, height, channels, opts);
}

/**
 * フォールバック用パレット抽出。
 * グレースケール画像など、メインアルゴリズムで色が取れない場合に使用。
 */
export function extractFallbackPalette(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
  options?: ExtractOptions,
): DominantColor[] {
  const opts = resolveOptions(options);
  const pixelCount = width * height;
  if (pixelCount === 0) return [];

  const colorCounts = new Map<number, number>();
  let validPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * channels;
      const alpha = channels >= 4 ? (data[index + 3] ?? 255) : 255;
      if (alpha < ALPHA_THRESHOLD) continue;

      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;

      const qr = Math.round(r / FALLBACK_QUANTIZATION_STEP) * FALLBACK_QUANTIZATION_STEP;
      const qg = Math.round(g / FALLBACK_QUANTIZATION_STEP) * FALLBACK_QUANTIZATION_STEP;
      const qb = Math.round(b / FALLBACK_QUANTIZATION_STEP) * FALLBACK_QUANTIZATION_STEP;
      const key = (qr << 16) | (qg << 8) | qb;

      colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
      validPixels++;
    }
  }

  if (validPixels === 0) return [];

  if (colorCounts.size === 0) {
    const avg = calculateAverageColor(data, width, height, channels);
    return avg ? [avg] : [];
  }

  const sorted = Array.from(colorCounts.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, opts.numColors).map(([key, count]) => {
    const r = (key >> 16) & 0xff;
    const g = (key >> 8) & 0xff;
    const b = key & 0xff;
    return createDominantColor(r, g, b, count / validPixels);
  });
}

/**
 * RGB → 16進数カラーコード（例: `#FF00AA`）。
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => {
      const hex = x.toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    })
    .join("")
    .toUpperCase()}`;
}

/**
 * RGB → HSL 変換。
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * 色相値から色相カテゴリを判定。
 */
export function getHueCategory(hue: number): HueCategory {
  let h = hue % 360;
  if (h < 0) h += 360;

  if (h >= 345 || h < 15) return "red";
  if (h < 45) return "orange";
  if (h < 75) return "yellow";
  if (h < 135) return "green";
  if (h < 195) return "cyan";
  if (h < 255) return "blue";
  if (h < 345) return "violet";

  return "gray";
}

/**
 * RGB + percentage から DominantColor オブジェクトを生成。
 */
export function createDominantColor(
  r: number,
  g: number,
  b: number,
  percentage: number,
): DominantColor {
  const hsl = rgbToHsl(r, g, b);
  const hueCategory: HueCategory = hsl.s <= 5 ? "gray" : getHueCategory(hsl.h);
  const lab = rgbToLab(r, g, b);
  const lch = labToLch(lab);
  const oklab = rgbToOklab(r, g, b);
  const oklch = oklabToOklch(oklab);
  const css = createCSSColors(r, g, b, hsl, lab, lch, oklab, oklch);
  return {
    r,
    g,
    b,
    hex: rgbToHex(r, g, b),
    percentage,
    hue: hsl.h,
    saturation: hsl.s,
    lightness: hsl.l,
    hueCategory,
    lab,
    lch,
    oklab,
    oklch,
    css,
  };
}

/**
 * 複数画像の色セットを集約し、上位 numColors 色を返す。
 */
export function aggregateColors(colorSets: DominantColor[][], numColors = 3): DominantColor[] {
  const colorMap = new Map<string, { color: DominantColor; weight: number }>();

  for (const colors of colorSets) {
    for (const color of colors) {
      const key = color.hex;
      const existing = colorMap.get(key);

      if (existing) {
        existing.weight += color.percentage;
      } else {
        colorMap.set(key, { color: { ...color }, weight: color.percentage });
      }
    }
  }

  return Array.from(colorMap.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, numColors)
    .map((item) =>
      createDominantColor(item.color.r, item.color.g, item.color.b, item.weight / colorSets.length),
    );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveOptions(options?: ExtractOptions): Required<ExtractOptions> {
  return { ...DEFAULT_OPTIONS, ...options };
}

/** HSV 彩度を計算 */
function calculateSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/** エッジ重みを計算（簡易ソーベルフィルタ） */
function calculateEdgeWeight(
  data: PixelData,
  x: number,
  y: number,
  width: number,
  height: number,
  channels: number,
): number {
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
    return BORDER_EDGE_WEIGHT;
  }

  const getGray = (px: number, py: number): number => {
    const i = (py * width + px) * channels;
    return ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / 3;
  };

  const center = getGray(x, y);
  const edgeStrength =
    Math.abs(center - getGray(x - 1, y)) +
    Math.abs(center - getGray(x + 1, y)) +
    Math.abs(center - getGray(x, y - 1)) +
    Math.abs(center - getGray(x, y + 1));

  return 1 + Math.min(edgeStrength / EDGE_STRENGTH_DIVISOR, 1);
}

/** 画像全体の平均色を計算 */
function calculateAverageColor(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
): DominantColor | null {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let counted = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * channels;
      const alpha = channels >= 4 ? (data[index + 3] ?? 255) : 255;
      if (alpha < ALPHA_THRESHOLD) continue;

      sumR += data[index] ?? 0;
      sumG += data[index + 1] ?? 0;
      sumB += data[index + 2] ?? 0;
      counted++;
    }
  }

  if (counted === 0) return null;

  return createDominantColor(
    Math.round(sumR / counted),
    Math.round(sumG / counted),
    Math.round(sumB / counted),
    1,
  );
}

// ---------------------------------------------------------------------------
// Main algorithm (CIELAB Delta E + adaptive thresholds)
// ---------------------------------------------------------------------------

/** Delta E のデフォルトマージ閾値 */
const DEFAULT_MERGE_DELTA_E = 15;

/** 高度な色抽出アルゴリズム（メインロジック） */
function extractAdvanced(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
  opts: Required<ExtractOptions>,
): DominantColor[] {
  const pixelCount = width * height;
  if (pixelCount === 0) return [];

  // サンプリングパスで画像特性を分析
  const stats = analyzeImageStats(data, width, height, channels);

  // 適応的彩度閾値
  const adaptedSatThreshold =
    stats.medianSaturation < 0.1
      ? Math.min(opts.saturationThreshold, 0.05)
      : opts.saturationThreshold;

  // 適応的中央重み係数 (0.3 〜 1.0)
  // edgeCentrality が高い → イラスト型 → 中央重み強め
  // edgeCentrality が低い → 写真型 → 中央重み弱め
  const centerWeightScale = 0.3 + 0.7 * stats.edgeCentrality;

  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

  const colorMap = new Map<
    number,
    {
      weight: number;
      saturation: number;
      sumX: number;
      sumY: number;
      sumX2: number;
      sumY2: number;
      count: number;
    }
  >();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;

      // 適応的彩度フィルタ
      const saturation = calculateSaturation(r, g, b);
      if (saturation < adaptedSatThreshold) continue;

      const brightness = (r + g + b) / 3;
      if (brightness < opts.brightnessMin || brightness > opts.brightnessMax) continue;

      // 適応的中央重み
      const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const rawCenterWeight = maxDistance > 0 ? 1 - distanceFromCenter / maxDistance : 0;
      const centerWeight = 1 + rawCenterWeight * centerWeightScale;

      const edgeWeight = calculateEdgeWeight(data, x, y, width, height, channels);

      const step = opts.quantizationStep;
      const qr = Math.round(r / step) * step;
      const qg = Math.round(g / step) * step;
      const qb = Math.round(b / step) * step;
      const key = (qr << 16) | (qg << 8) | qb;

      const totalWeight = centerWeight * edgeWeight * (1 + saturation);

      const existing = colorMap.get(key);
      if (existing) {
        existing.weight += totalWeight;
        existing.sumX += x;
        existing.sumY += y;
        existing.sumX2 += x * x;
        existing.sumY2 += y * y;
        existing.count++;
      } else {
        colorMap.set(key, {
          weight: totalWeight,
          saturation,
          sumX: x,
          sumY: y,
          sumX2: x * x,
          sumY2: y * y,
          count: 1,
        });
      }
    }
  }

  // スコアリング
  const colorEntries = Array.from(colorMap.entries()).map(([key, entry]) => {
    const r = (key >> 16) & 0xff;
    const g = (key >> 8) & 0xff;
    const b = key & 0xff;

    // オンライン分散: Var(X) + Var(Y) = (sumX2/n - (sumX/n)^2) + (sumY2/n - (sumY/n)^2)
    let variance = 0;
    if (entry.count >= 2) {
      const n = entry.count;
      variance =
        entry.sumX2 / n - (entry.sumX / n) ** 2 + (entry.sumY2 / n - (entry.sumY / n) ** 2);
    }
    const normalizedVariance = Math.min(variance / (width * height), 1);
    const score = entry.weight * (1 + entry.saturation) * (1 + normalizedVariance * 0.5);

    // Lab を事前計算してマージで使う
    const lab = rgbToLab(r, g, b);

    return { r, g, b, score, weight: entry.weight, key, lab };
  });

  // スコア順ソート → Lab ベースの類似色マージ
  const sortedColors = colorEntries.sort((a, b) => b.score - a.score);
  const dominantColors: DominantColor[] = [];
  const usedEntries: Array<{ key: number; lab: Lab }> = [];

  for (const color of sortedColors) {
    if (dominantColors.length >= opts.numColors) break;
    if (usedEntries.some((u) => u.key === color.key)) continue;

    // Delta E によるマージ判定
    let merged = false;
    for (const used of usedEntries) {
      if (deltaE76(color.lab, used.lab) < DEFAULT_MERGE_DELTA_E) {
        merged = true;
        break;
      }
    }

    if (!merged) {
      usedEntries.push({ key: color.key, lab: color.lab });
      dominantColors.push(
        createDominantColor(color.r, color.g, color.b, color.weight / pixelCount),
      );
    }
  }

  return dominantColors;
}

// ---------------------------------------------------------------------------
// Test exports (internal functions exposed for testing)
// ---------------------------------------------------------------------------

export const _internals = {
  rgbToLab,
  deltaE76,
  analyzeImageStats,
  labToLch,
  rgbToOklab,
  oklabToOklch,
};
