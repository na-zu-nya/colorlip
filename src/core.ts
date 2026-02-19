import {
  ALPHA_THRESHOLD,
  BORDER_EDGE_WEIGHT,
  DEFAULT_OPTIONS,
  EDGE_STRENGTH_DIVISOR,
  FALLBACK_QUANTIZATION_STEP,
} from "./constants";
import type { DominantColor, ExtractOptions, HSL, HueCategory, PixelData } from "./types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * ピクセルデータから代表色を抽出する（メインエントリ）。
 *
 * 内部で高度なアルゴリズム → フォールバック → 平均色 の順にフォールバックする。
 */
export function extractFromPixels(
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

  const colorCounts = new Map<string, number>();
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
      const key = `${qr},${qg},${qb}`;

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
    const [r, g, b] = key.split(",").map(Number) as [number, number, number];
    return createDominantColor(r, g, b, count / validPixels);
  });
}

/**
 * 2色間の知覚的距離を計算（重み付きユークリッド距離、CIE Delta E 近似）。
 */
export function calculateColorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const rmean = (r1 + r2) / 2;
  const deltaR = r1 - r2;
  const deltaG = g1 - g2;
  const deltaB = b1 - b2;

  const weightR = 2 + rmean / 256;
  const weightG = 4.0;
  const weightB = 2 + (255 - rmean) / 256;

  return Math.sqrt(
    weightR * deltaR * deltaR + weightG * deltaG * deltaG + weightB * deltaB * deltaB,
  );
}

/**
 * 2つの DominantColor の類似度を返す（0–1、1 が完全一致）。
 */
export function calculateColorSimilarity(c1: DominantColor, c2: DominantColor): number {
  const distance = Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2);
  const maxDistance = Math.sqrt(255 * 255 * 3);
  return 1 - distance / maxDistance;
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

/** 位置の分散度を計算 */
function calculatePositionVariance(positions: Array<{ x: number; y: number }>): number {
  if (positions.length < 2) return 0;

  const meanX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
  const meanY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;

  return (
    positions.reduce((sum, p) => sum + (p.x - meanX) ** 2 + (p.y - meanY) ** 2, 0) /
    positions.length
  );
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

  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

  const colorMap = new Map<
    string,
    { weight: number; saturation: number; positions: Array<{ x: number; y: number }> }
  >();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;

      // 彩度フィルタリング
      const saturation = calculateSaturation(r, g, b);
      if (saturation < opts.saturationThreshold) continue;

      // 明度フィルタリング
      const brightness = (r + g + b) / 3;
      if (brightness < opts.brightnessMin || brightness > opts.brightnessMax) continue;

      // 中央重み付け
      const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const centerWeight = 1 + (maxDistance > 0 ? 1 - distanceFromCenter / maxDistance : 0);

      // エッジ重み付け
      const edgeWeight = calculateEdgeWeight(data, x, y, width, height, channels);

      // 量子化
      const step = opts.quantizationStep;
      const qr = Math.round(r / step) * step;
      const qg = Math.round(g / step) * step;
      const qb = Math.round(b / step) * step;
      const key = `${qr},${qg},${qb}`;

      const totalWeight = centerWeight * edgeWeight * (1 + saturation);

      const existing = colorMap.get(key);
      if (existing) {
        existing.weight += totalWeight;
        existing.positions.push({ x, y });
      } else {
        colorMap.set(key, { weight: totalWeight, saturation, positions: [{ x, y }] });
      }
    }
  }

  // スコアリング
  const colorEntries = Array.from(colorMap.entries()).map(([key, entry]) => {
    const [r, g, b] = key.split(",").map(Number) as [number, number, number];

    const variance = calculatePositionVariance(entry.positions);
    const normalizedVariance = Math.min(variance / (width * height), 1);
    const score = entry.weight * (1 + entry.saturation) * (1 + normalizedVariance * 0.5);

    return { r, g, b, score, weight: entry.weight, key };
  });

  // スコア順ソート → 類似色マージ
  const sortedColors = colorEntries.sort((a, b) => b.score - a.score);
  const dominantColors: DominantColor[] = [];
  const usedColors = new Set<string>();

  for (const color of sortedColors) {
    if (dominantColors.length >= opts.numColors) break;
    if (usedColors.has(color.key)) continue;

    let merged = false;
    for (const used of usedColors) {
      const [ur, ug, ub] = used.split(",").map(Number) as [number, number, number];
      if (calculateColorDistance(color.r, color.g, color.b, ur, ug, ub) < opts.mergeDistance) {
        merged = true;
        break;
      }
    }

    if (!merged) {
      usedColors.add(color.key);
      dominantColors.push(
        createDominantColor(color.r, color.g, color.b, color.weight / pixelCount),
      );
    }
  }

  return dominantColors;
}
