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
  colorlip,
  getHueCategory,
  rgbToHex,
  rgbToHsl,
} from "./core";
