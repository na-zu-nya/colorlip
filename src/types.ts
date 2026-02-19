/** 色相カテゴリ（7色 + gray） */
export type HueCategory =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "violet"
  | "gray";

/** HSL 色空間 */
export interface HSL {
  /** 色相 (0–360) */
  h: number;
  /** 彩度 (0–100) */
  s: number;
  /** 明度 (0–100) */
  l: number;
}

/** 画像のピクセルバッファ情報 */
export interface ImageInfo {
  width: number;
  height: number;
  channels: number;
}

/** 抽出された代表色 */
export interface DominantColor {
  r: number;
  g: number;
  b: number;
  hex: string;
  percentage: number;
  /** 色相 (0–360) */
  hue: number;
  /** 彩度 (0–100) */
  saturation: number;
  /** 明度 (0–100) */
  lightness: number;
  /** 色相カテゴリ */
  hueCategory: HueCategory;
}

/** 抽出オプション */
export interface ExtractOptions {
  /** 抽出する色の数（デフォルト: 3） */
  numColors?: number;
  /** 彩度フィルタの閾値（デフォルト: 0.15） */
  saturationThreshold?: number;
  /** 明度の下限（デフォルト: 20） */
  brightnessMin?: number;
  /** 明度の上限（デフォルト: 235） */
  brightnessMax?: number;
  /** 量子化ステップ（デフォルト: 12） */
  quantizationStep?: number;
}

/** ピクセルデータの型（Node.js Buffer / ブラウザ Uint8ClampedArray 双方対応） */
export type PixelData = Uint8Array | Uint8ClampedArray;
