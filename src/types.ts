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

/** CIE L*a*b* 色空間 */
export interface Lab {
  /** 明度 (0–100) */
  L: number;
  /** 緑–赤軸 */
  a: number;
  /** 青–黄軸 */
  b: number;
}

/** CIE LCH 色空間（Lab の極座標表現） */
export interface LCH {
  /** 明度 (0–100) */
  L: number;
  /** 彩度 */
  C: number;
  /** 色相 (0–360) */
  H: number;
}

/** OKLab 色空間 */
export interface OKLab {
  /** 明度 (0–1) */
  L: number;
  /** 緑–赤軸 */
  a: number;
  /** 青–黄軸 */
  b: number;
}

/** OKLCH 色空間（OKLab の極座標表現） */
export interface OKLCH {
  /** 明度 (0–1) */
  L: number;
  /** 彩度 */
  C: number;
  /** 色相 (0–360) */
  H: number;
}

/** CSS カラー文字列 */
export interface CSSColors {
  rgb: string;
  hsl: string;
  lab: string;
  lch: string;
  oklab: string;
  oklch: string;
}

/** 画像のピクセルバッファ情報 */
export interface ImageInfo {
  width: number;
  height: number;
  channels: number;
}

/** 抽出された色 */
export interface ColorlipColor {
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
  /** CIE L*a*b* */
  lab: Lab;
  /** CIE LCH */
  lch: LCH;
  /** OKLab */
  oklab: OKLab;
  /** OKLCH */
  oklch: OKLCH;
  /** CSS カラー文字列 */
  css: CSSColors;
}

/** v0.x 互換エイリアス */
export type DominantColor = ColorlipColor;

/** パレット解析結果 */
export interface ColorlipPalette {
  dominant: ColorlipColor | null;
  accent: ColorlipColor | null;
  swatches: ColorlipColor[];
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
