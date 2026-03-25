import {
  ALPHA_THRESHOLD,
  BORDER_EDGE_WEIGHT,
  BORDER_REGION_RATIO,
  CENTER_REGION_RATIO,
  EDGE_STRENGTH_DIVISOR,
} from "./constants";
import { rgbToLab, rgbToOklab, oklabToOklch } from "./color-spaces";
import { quantizeColorKey } from "./merge";
import { calculateAccentPreference } from "./palette";
import type { ClusteredColorBin, QuantizedColorBin, ScoredColorEntry } from "./analysis-types";
import type { ImageStats } from "./image-stats";
import type { ExtractOptions, PixelData } from "./types";

export interface ExtractionContext {
  saturationSpread: number;
  saturationFloor: number;
  centerWeightScale: number;
  centerX: number;
  centerY: number;
  maxDistance: number;
  borderMarginX: number;
  borderMarginY: number;
  centerRadius: number;
}

/** HSV 彩度を計算 */
export function calculateSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** エッジ重みを計算（簡易ソーベルフィルタ） */
export function calculateEdgeWeight(
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
    const alpha = channels >= 4 ? (data[i + 3] ?? 255) : 255;
    if (alpha < ALPHA_THRESHOLD) return 0;

    const alphaWeight = (alpha / 255) ** 2;
    return (((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / 3) * alphaWeight;
  };

  const center = getGray(x, y);
  const edgeStrength =
    Math.abs(center - getGray(x - 1, y)) +
    Math.abs(center - getGray(x + 1, y)) +
    Math.abs(center - getGray(x, y - 1)) +
    Math.abs(center - getGray(x, y + 1));

  return 1 + Math.min(edgeStrength / EDGE_STRENGTH_DIVISOR, 1);
}

export function createExtractionContext(
  width: number,
  height: number,
  opts: Required<ExtractOptions>,
  stats: ImageStats,
  saturationSpreadArg?: number,
): ExtractionContext {
  const saturationSpread = saturationSpreadArg ?? Math.max(stats.saturationP75 - stats.saturationP25, 0.04);
  const saturationFloor = Math.max(
    0.01,
    Math.min(
      opts.saturationThreshold * 0.2,
      stats.saturationP25 * 0.5,
      stats.medianSaturation * 0.35,
    ),
  );

  const centerWeightScale = 0.3 + 0.7 * stats.edgeCentrality;
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

  return {
    saturationSpread,
    saturationFloor,
    centerWeightScale,
    centerX,
    centerY,
    maxDistance,
    borderMarginX: width * BORDER_REGION_RATIO,
    borderMarginY: height * BORDER_REGION_RATIO,
    centerRadius: maxDistance * CENTER_REGION_RATIO,
  };
}

export function collectQuantizedBins(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
  opts: Required<ExtractOptions>,
  stats: ImageStats,
  context: ExtractionContext,
): Map<string, QuantizedColorBin> {
  const colorMap = new Map<string, QuantizedColorBin>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const alpha = channels >= 4 ? (data[i + 3] ?? 255) : 255;
      if (alpha < ALPHA_THRESHOLD) continue;

      const alphaWeight = (alpha / 255) ** 2;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;

      const saturation = calculateSaturation(r, g, b);
      if (saturation < context.saturationFloor) continue;

      const saturationRelative = (saturation - stats.medianSaturation) / context.saturationSpread;
      const saturationBalance = Math.max(0.35, Math.min(1.75, 1 + saturationRelative * 0.35));

      const brightness = (r + g + b) / 3;
      if (brightness < opts.brightnessMin || brightness > opts.brightnessMax) continue;

      const distanceFromCenter = Math.sqrt((x - context.centerX) ** 2 + (y - context.centerY) ** 2);
      const rawCenterWeight = context.maxDistance > 0 ? 1 - distanceFromCenter / context.maxDistance : 0;
      const centerWeight = 1 + rawCenterWeight * context.centerWeightScale;
      const edgeWeight = calculateEdgeWeight(data, x, y, width, height, channels);
      const key = quantizeColorKey(r, g, b, opts.quantizationStep);
      const totalWeight = centerWeight * edgeWeight * (1 + saturation) * saturationBalance * alphaWeight;

      const isBorder =
        x < context.borderMarginX ||
        x >= width - context.borderMarginX ||
        y < context.borderMarginY ||
        y >= height - context.borderMarginY;
      const isCenter =
        context.centerRadius > 0 &&
        Math.sqrt((x - context.centerX) ** 2 + (y - context.centerY) ** 2) <= context.centerRadius;

      const existing = colorMap.get(key);
      if (existing) {
        existing.weight += totalWeight;
        existing.sumR += r * alphaWeight;
        existing.sumG += g * alphaWeight;
        existing.sumB += b * alphaWeight;
        existing.sumX += x * alphaWeight;
        existing.sumY += y * alphaWeight;
        existing.sumX2 += x * x * alphaWeight;
        existing.sumY2 += y * y * alphaWeight;
        existing.borderCount += isBorder ? alphaWeight : 0;
        existing.centerCount += isCenter ? alphaWeight : 0;
        existing.count += alphaWeight;
      } else {
        colorMap.set(key, {
          weight: totalWeight,
          sumR: r * alphaWeight,
          sumG: g * alphaWeight,
          sumB: b * alphaWeight,
          sumX: x * alphaWeight,
          sumY: y * alphaWeight,
          sumX2: x * x * alphaWeight,
          sumY2: y * y * alphaWeight,
          borderCount: isBorder ? alphaWeight : 0,
          centerCount: isCenter ? alphaWeight : 0,
          count: alphaWeight,
        });
      }
    }
  }

  return colorMap;
}

export function scoreClusteredEntries(
  clusteredEntries: ClusteredColorBin[],
  width: number,
  height: number,
  context: ExtractionContext,
): ScoredColorEntry[] {
  return clusteredEntries
    .map((entry) => {
      const { r, g, b } = entry;

      let variance = 0;
      if (entry.count > 0) {
        const n = entry.count;
        variance =
          entry.sumX2 / n - (entry.sumX / n) ** 2 + (entry.sumY2 / n - (entry.sumY / n) ** 2);
      }

      const borderRatio = entry.borderCount / entry.count;
      const centerRatio = entry.centerCount / entry.count;
      const centroidX = entry.sumX / entry.count;
      const centroidY = entry.sumY / entry.count;
      const centroidDistance =
        context.maxDistance > 0
          ? Math.sqrt((centroidX - context.centerX) ** 2 + (centroidY - context.centerY) ** 2) /
            context.maxDistance
          : 0;
      const normalizedVariance = Math.min(variance / (width * height), 1);
      const oklab = rgbToOklab(r, g, b);
      const oklch = oklabToOklch(oklab);
      const accentPreference = calculateAccentPreference(oklch);
      const accentFactor = 0.7 + accentPreference * 0.85;
      const centerBonus = 1 + centerRatio * 0.45;
      const borderPenalty = Math.max(0.3, 1 - borderRatio * 0.75);
      const centroidPenalty = Math.max(0.45, 1 - centroidDistance * 0.45);
      const peripheralPenalty =
        borderRatio > centerRatio ? Math.max(0.35, 1 - (borderRatio - centerRatio) * 0.9) : 1;
      const varianceFactor =
        1 + normalizedVariance * 0.35 * Math.max(0, centerRatio - borderRatio) * accentFactor;
      const score =
        entry.weight *
        (1 + entry.saturation) *
        centerBonus *
        borderPenalty *
        centroidPenalty *
        peripheralPenalty *
        varianceFactor *
        accentFactor;

      return { r, g, b, score, weight: entry.weight, lab: rgbToLab(r, g, b), accentPreference };
    })
    .sort((a, b) => b.score - a.score);
}
