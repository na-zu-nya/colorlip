import type { ExtractOptions } from "./types";

export const DEFAULT_OPTIONS: Required<ExtractOptions> = {
  numColors: 3,
  saturationThreshold: 0.15,
  brightnessMin: 20,
  brightnessMax: 235,
  quantizationStep: 12,
} as const;

/** フォールバック時の量子化ステップ */
export const FALLBACK_QUANTIZATION_STEP = 16;

/** アルファ値の最小閾値（0.5 未満は透明扱い） */
export const ALPHA_THRESHOLD = 128;

/** エッジ重みの正規化係数 */
export const EDGE_STRENGTH_DIVISOR = 100;

/** 境界ピクセルのエッジ重み */
export const BORDER_EDGE_WEIGHT = 1.5;

/** 外周リングとみなすマージン比率 */
export const BORDER_REGION_RATIO = 0.12;

/** 中央領域とみなす半径比率 */
export const CENTER_REGION_RATIO = 0.38;

/** アクセント色として好ましい OKLCH の目標明度 */
export const ACCENT_OKLCH_LIGHTNESS_TARGET = 0.72;

/** アクセント色として好ましい OKLCH の目標彩度 */
export const ACCENT_OKLCH_CHROMA_TARGET = 0.24;

/** OKLCH 明度スコアの広がり */
export const ACCENT_OKLCH_LIGHTNESS_SIGMA = 0.18;

/** OKLCH 彩度スコアの広がり */
export const ACCENT_OKLCH_CHROMA_SIGMA = 0.1;

/** sharp アダプター用リサイズ上限 */
export const MAX_RESIZE = 150;
