import type { ExtractOptions } from "./types";

export const DEFAULT_OPTIONS: Required<ExtractOptions> = {
  numColors: 3,
  saturationThreshold: 0.15,
  brightnessMin: 20,
  brightnessMax: 235,
  quantizationStep: 12,
  mergeDistance: 35,
} as const;

/** フォールバック時の量子化ステップ */
export const FALLBACK_QUANTIZATION_STEP = 16;

/** アルファ値の最小閾値（これ未満は透明扱い） */
export const ALPHA_THRESHOLD = 16;

/** エッジ重みの正規化係数 */
export const EDGE_STRENGTH_DIVISOR = 100;

/** 境界ピクセルのエッジ重み */
export const BORDER_EDGE_WEIGHT = 1.5;

/** sharp アダプター用リサイズ上限 */
export const MAX_RESIZE = 150;
