// Types
export type {
  CSSColors,
  ColorlipColor,
  ColorlipPalette,
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
  getColors,
  getPalette,
  colorlip,
  getHueCategory,
  rgbToHex,
  rgbToHsl,
} from "./core";
