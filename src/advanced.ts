import { analyzeImageStats } from "./image-stats";
import { collectQuantizedBins, createExtractionContext, scoreClusteredEntries } from "./extraction";
import { calculateAdaptiveMergeThresholds, clusterNearbyBins, DEFAULT_MERGE_DELTA_E } from "./merge";
import type { ScoredColorEntry } from "./analysis-types";
import type { ExtractOptions, PixelData } from "./types";

export interface AdvancedColorAnalysis {
  pixelCount: number;
  candidates: ScoredColorEntry[];
  finalMergeDeltaE: number;
}

export function analyzeAdvancedColors(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
  opts: Required<ExtractOptions>,
): AdvancedColorAnalysis {
  const pixelCount = width * height;
  if (pixelCount === 0) {
    return {
      pixelCount: 0,
      candidates: [],
      finalMergeDeltaE: DEFAULT_MERGE_DELTA_E,
    };
  }

  const stats = analyzeImageStats(data, width, height, channels);
  const context = createExtractionContext(width, height, opts, stats);
  const mergeThresholds = calculateAdaptiveMergeThresholds(stats, context.saturationSpread);
  const colorMap = collectQuantizedBins(data, width, height, channels, opts, stats, context);
  const clusteredEntries = clusterNearbyBins(colorMap, mergeThresholds.preMergeDeltaE);

  return {
    pixelCount,
    candidates: scoreClusteredEntries(clusteredEntries, width, height, context),
    finalMergeDeltaE: mergeThresholds.finalMergeDeltaE,
  };
}
