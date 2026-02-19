// Types
export type {
  DominantColor,
  ExtractOptions,
  HSL,
  HueCategory,
  ImageInfo,
  PixelData,
} from "./types";

// Constants
export { DEFAULT_OPTIONS } from "./constants";

// Core functions
export {
  aggregateColors,
  calculateColorDistance,
  calculateColorSimilarity,
  createDominantColor,
  extractFallbackPalette,
  extractFromPixels,
  getHueCategory,
  rgbToHex,
  rgbToHsl,
} from "./core";

// Core V2 (perceptual improvements)
export { extractFromPixelsV2 } from "./core-v2";
