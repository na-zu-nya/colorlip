/**
 * extractFromPixelsV2 — 知覚改善版
 *
 * V1 からの改善点:
 *   1. CIELAB Delta E (CIE76) による類似色マージ
 *   2. 適応的フィルタ閾値（画像の彩度分布に応じて自動調整）
 *   3. 適応的空間重み（エッジ分布からイラスト/写真を判定）
 */

import {
  ALPHA_THRESHOLD,
  BORDER_EDGE_WEIGHT,
  DEFAULT_OPTIONS,
  EDGE_STRENGTH_DIVISOR,
} from "./constants";
import { createDominantColor, extractFallbackPalette } from "./core";
import type { DominantColor, ExtractOptions, PixelData } from "./types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * ピクセルデータから代表色を抽出する（V2: 知覚改善版）。
 *
 * V1 と同じシグネチャ。内部アルゴリズムが改善されている。
 */
export function extractFromPixelsV2(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
  options?: ExtractOptions,
): DominantColor[] {
  const opts = resolveOptions(options);

  const result = extractAdvancedV2(data, width, height, channels, opts);
  if (result.length > 0) return result;

  return extractFallbackPalette(data, width, height, channels, opts);
}

// ---------------------------------------------------------------------------
// CIELAB color space
// ---------------------------------------------------------------------------

interface Lab {
  L: number;
  a: number;
  b: number;
}

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
// Internal helpers (shared with V1 structure)
// ---------------------------------------------------------------------------

function resolveOptions(options?: ExtractOptions): Required<ExtractOptions> {
  return { ...DEFAULT_OPTIONS, ...options };
}

function calculateSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

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

function calculatePositionVariance(positions: Array<{ x: number; y: number }>): number {
  if (positions.length < 2) return 0;

  const meanX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
  const meanY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;

  return (
    positions.reduce((sum, p) => sum + (p.x - meanX) ** 2 + (p.y - meanY) ** 2, 0) /
    positions.length
  );
}

// ---------------------------------------------------------------------------
// V2 Main algorithm
// ---------------------------------------------------------------------------

/** Delta E のデフォルトマージ閾値 */
const DEFAULT_MERGE_DELTA_E = 15;

function extractAdvancedV2(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
  opts: Required<ExtractOptions>,
): DominantColor[] {
  const pixelCount = width * height;
  if (pixelCount === 0) return [];

  // ── 改善2 & 3: サンプリングパスで画像特性を分析 ──
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
    string,
    { weight: number; saturation: number; positions: Array<{ x: number; y: number }> }
  >();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;

      // ── 改善2: 適応的彩度フィルタ ──
      const saturation = calculateSaturation(r, g, b);
      if (saturation < adaptedSatThreshold) continue;

      const brightness = (r + g + b) / 3;
      if (brightness < opts.brightnessMin || brightness > opts.brightnessMax) continue;

      // ── 改善3: 適応的中央重み ──
      const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const rawCenterWeight = maxDistance > 0 ? 1 - distanceFromCenter / maxDistance : 0;
      const centerWeight = 1 + rawCenterWeight * centerWeightScale;

      const edgeWeight = calculateEdgeWeight(data, x, y, width, height, channels);

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

    // ── 改善1: Lab を事前計算してマージで使う ──
    const lab = rgbToLab(r, g, b);

    return { r, g, b, score, weight: entry.weight, key, lab };
  });

  // スコア順ソート → Lab ベースの類似色マージ
  const sortedColors = colorEntries.sort((a, b) => b.score - a.score);
  const dominantColors: DominantColor[] = [];
  const usedEntries: Array<{ key: string; lab: Lab }> = [];

  for (const color of sortedColors) {
    if (dominantColors.length >= opts.numColors) break;
    if (usedEntries.some((u) => u.key === color.key)) continue;

    // ── 改善1: Delta E によるマージ判定 ──
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
};
