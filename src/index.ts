// Types
export type {
  CSSColors,
  DominantColor,
  ExtractOptions,
  HSL,
  HueCategory,
  ImageInfo,
  Lab,
  LCH,
  OKLab,
  OKLCH,
  PixelData,
} from "./types";

// Constants
export { DEFAULT_OPTIONS } from "./constants";

// Core functions
export {
  aggregateColors,
  createDominantColor,
  extractFallbackPalette,
  colorlip,
  getHueCategory,
  rgbToHex,
  rgbToHsl,
} from "./core";
