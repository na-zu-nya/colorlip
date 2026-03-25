import { DEFAULT_OPTIONS } from "./constants";
import { getHueCategory, rgbToHex, rgbToHsl, rgbToLab, labToLch, rgbToOklab, oklabToOklch, deltaE76 } from "./color-spaces";
import { aggregateColors, createDominantColor } from "./colorlip-color";
import { analyzeAdvancedColors } from "./advanced";
import { extractFallbackPalette } from "./fallback";
import { analyzeImageStats } from "./image-stats";
import { buildPaletteFromCandidates, buildPaletteFromSwatches, buildSwatches } from "./palette";
import type { ColorlipColor, ColorlipPalette, ExtractOptions, PixelData } from "./types";

export { getHueCategory, rgbToHex, rgbToHsl } from "./color-spaces";
export { aggregateColors, createDominantColor } from "./colorlip-color";
export { extractFallbackPalette } from "./fallback";

function resolveOptions(options?: ExtractOptions): Required<ExtractOptions> {
  return { ...DEFAULT_OPTIONS, ...options };
}

/**
 * ピクセルデータから代表色を抽出する（メインエントリ）。
 *
 * 内部で高度なアルゴリズム → フォールバックの順に処理する。
 */
export function colorlip(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
  options?: ExtractOptions,
): ColorlipColor[] {
  const opts = resolveOptions(options);
  const analysis = analyzeAdvancedColors(data, width, height, channels, opts);

  if (analysis.candidates.length > 0) {
    return buildSwatches(
      analysis.candidates,
      analysis.pixelCount,
      opts.numColors,
      analysis.finalMergeDeltaE,
    );
  }

  return extractFallbackPalette(data, width, height, channels, opts);
}

/** `colorlip()` の別名。v1 以降の公開API向け。 */
export function getColors(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
  options?: ExtractOptions,
): ColorlipColor[] {
  return colorlip(data, width, height, channels, options);
}

/** `getColors()` の詳細版。dominant / accent / swatches を返す。 */
export function getPalette(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
  options?: ExtractOptions,
): ColorlipPalette {
  const opts = resolveOptions(options);
  const analysis = analyzeAdvancedColors(data, width, height, channels, opts);

  if (analysis.candidates.length > 0) {
    return buildPaletteFromCandidates(
      analysis.candidates,
      analysis.pixelCount,
      opts.numColors,
      analysis.finalMergeDeltaE,
    );
  }

  return buildPaletteFromSwatches(extractFallbackPalette(data, width, height, channels, opts));
}

// ---------------------------------------------------------------------------
// Test exports (internal functions exposed for testing)
// ---------------------------------------------------------------------------

export const _internals = {
  rgbToLab,
  deltaE76,
  analyzeImageStats,
  labToLch,
  rgbToOklab,
  oklabToOklch,
};
