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
  createDominantColor,
  extractFallbackPalette,
  extractFromPixels,
  getHueCategory,
  rgbToHex,
  rgbToHsl,
} from "./core";
