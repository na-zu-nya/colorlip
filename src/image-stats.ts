import { ALPHA_THRESHOLD } from "./constants";
import type { PixelData } from "./types";

export interface ImageStats {
  /** 彩度の中央値 (0-1) */
  medianSaturation: number;
  /** 彩度の第1四分位数 (0-1) */
  saturationP25: number;
  /** 彩度の第3四分位数 (0-1) */
  saturationP75: number;
  /** エッジの中央集中度 (0-1, 1=完全に中央集中) */
  edgeCentrality: number;
}

function percentileFromSorted(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const index = (values.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const lowerValue = values[lower] ?? 0;
  const upperValue = values[upper] ?? lowerValue;
  if (lower === upper) return lowerValue;
  return lowerValue + (upperValue - lowerValue) * (index - lower);
}

function percentileFromWeightedSorted(
  values: Array<{ value: number; weight: number }>,
  percentile: number,
): number {
  if (values.length === 0) return 0;

  const totalWeight = values.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return 0;

  const target = totalWeight * percentile;
  let cumulativeWeight = 0;

  for (const entry of values) {
    cumulativeWeight += entry.weight;
    if (cumulativeWeight >= target) return entry.value;
  }

  return values[values.length - 1]?.value ?? 0;
}

/** ストライドサンプリングで画像統計を計算 */
export function analyzeImageStats(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
): ImageStats {
  const pixelCount = width * height;
  if (pixelCount === 0) {
    return { medianSaturation: 0, saturationP25: 0, saturationP75: 0, edgeCentrality: 0.5 };
  }

  const sampleCount = Math.min(Math.max(Math.floor(pixelCount * 0.1), 100), 2000);
  const stride = Math.max(1, Math.floor(pixelCount / sampleCount));

  const saturations: Array<{ value: number; weight: number }> = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);

  let edgeWeightedCenterDist = 0;
  let totalEdgeStrength = 0;

  for (let idx = 0; idx < pixelCount; idx += stride) {
    const x = idx % width;
    const y = Math.floor(idx / width);
    const i = idx * channels;
    const alpha = channels >= 4 ? (data[i + 3] ?? 255) : 255;
    if (alpha < ALPHA_THRESHOLD) continue;

    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const alphaWeight = (alpha / 255) ** 2;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    saturations.push({ value: max === 0 ? 0 : (max - min) / max, weight: alphaWeight });

    if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
      const getGray = (px: number, py: number): number => {
        const j = (py * width + px) * channels;
        const neighborAlpha = channels >= 4 ? (data[j + 3] ?? 255) : 255;
        if (neighborAlpha < ALPHA_THRESHOLD) return 0;

        const alphaScale = (neighborAlpha / 255) ** 2;
        return (((data[j] ?? 0) + (data[j + 1] ?? 0) + (data[j + 2] ?? 0)) / 3) * alphaScale;
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
        edgeWeightedCenterDist += normalizedDist * strength * alphaWeight;
        totalEdgeStrength += strength * alphaWeight;
      }
    }
  }

  saturations.sort((a, b) => a.value - b.value);
  const medianSaturation = percentileFromWeightedSorted(saturations, 0.5);
  const saturationP25 = percentileFromWeightedSorted(saturations, 0.25);
  const saturationP75 = percentileFromWeightedSorted(saturations, 0.75);

  const avgEdgeDist = totalEdgeStrength > 0 ? edgeWeightedCenterDist / totalEdgeStrength : 0.5;
  const edgeCentrality = 1 - avgEdgeDist;

  return { medianSaturation, saturationP25, saturationP75, edgeCentrality };
}

export const _internals = {
  percentileFromSorted,
  percentileFromWeightedSorted,
};
