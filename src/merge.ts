import { deltaE76, rgbToLab } from "./color-spaces";
import type { ClusteredColorBin, MergeThresholds, QuantizedColorBin } from "./analysis-types";
import type { ImageStats } from "./image-stats";

/** Delta E のデフォルトマージ閾値 */
export const DEFAULT_MERGE_DELTA_E = 15;

/** スコアリング前に近傍ビンを束ねる Delta E 閾値 */
export const PRE_MERGE_DELTA_E = 14;

export function quantizeColorKey(r: number, g: number, b: number, step: number): string {
  const qr = Math.round(r / step) * step;
  const qg = Math.round(g / step) * step;
  const qb = Math.round(b / step) * step;
  return `rgb:${qr}:${qg}:${qb}`;
}

export function calculateAdaptiveMergeThresholds(
  stats: ImageStats,
  saturationSpread: number,
): MergeThresholds {
  // 彩度分布の中心と幅が小さい画像ほど、近接色を安易にまとめない。
  const mergeScale = Math.max(
    0.45,
    Math.min(1, (stats.medianSaturation + saturationSpread * 0.5) / 0.16),
  );

  return {
    preMergeDeltaE: PRE_MERGE_DELTA_E * mergeScale,
    finalMergeDeltaE: DEFAULT_MERGE_DELTA_E * mergeScale,
  };
}

function calculateSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

export function clusterNearbyBins(
  colorMap: Map<string, QuantizedColorBin>,
  preMergeDeltaE = PRE_MERGE_DELTA_E,
): ClusteredColorBin[] {
  const rawEntries = Array.from(colorMap.values())
    .map((entry) => {
      const r = Math.round(entry.sumR / entry.count);
      const g = Math.round(entry.sumG / entry.count);
      const b = Math.round(entry.sumB / entry.count);
      return { r, g, b, lab: rgbToLab(r, g, b), ...entry };
    })
    .sort((a, b) => b.weight - a.weight);

  const consumed = new Array(rawEntries.length).fill(false);
  const clusters: ClusteredColorBin[] = [];

  for (let i = 0; i < rawEntries.length; i++) {
    if (consumed[i]) continue;
    const anchor = rawEntries[i];
    if (!anchor) continue;
    consumed[i] = true;

    let weightedR = anchor.r * anchor.weight;
    let weightedG = anchor.g * anchor.weight;
    let weightedB = anchor.b * anchor.weight;
    let totalWeight = anchor.weight;
    let sumX = anchor.sumX;
    let sumY = anchor.sumY;
    let sumX2 = anchor.sumX2;
    let sumY2 = anchor.sumY2;
    let borderCount = anchor.borderCount;
    let centerCount = anchor.centerCount;
    let count = anchor.count;

    for (let j = i + 1; j < rawEntries.length; j++) {
      if (consumed[j]) continue;
      const candidate = rawEntries[j];
      if (!candidate) continue;
      if (deltaE76(anchor.lab, candidate.lab) >= preMergeDeltaE) continue;

      consumed[j] = true;
      weightedR += candidate.r * candidate.weight;
      weightedG += candidate.g * candidate.weight;
      weightedB += candidate.b * candidate.weight;
      totalWeight += candidate.weight;
      sumX += candidate.sumX;
      sumY += candidate.sumY;
      sumX2 += candidate.sumX2;
      sumY2 += candidate.sumY2;
      borderCount += candidate.borderCount;
      centerCount += candidate.centerCount;
      count += candidate.count;
    }

    const r = Math.round(weightedR / totalWeight);
    const g = Math.round(weightedG / totalWeight);
    const b = Math.round(weightedB / totalWeight);

    clusters.push({
      r,
      g,
      b,
      lab: rgbToLab(r, g, b),
      weight: totalWeight,
      saturation: calculateSaturation(r, g, b),
      sumR: weightedR,
      sumG: weightedG,
      sumB: weightedB,
      sumX,
      sumY,
      sumX2,
      sumY2,
      borderCount,
      centerCount,
      count,
    });
  }

  return clusters;
}
