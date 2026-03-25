import { ALPHA_THRESHOLD, DEFAULT_OPTIONS, FALLBACK_QUANTIZATION_STEP } from "./constants";
import { createDominantColor } from "./colorlip-color";
import type { ColorlipColor, ExtractOptions, PixelData } from "./types";

function resolveOptions(options?: ExtractOptions): Required<ExtractOptions> {
  return { ...DEFAULT_OPTIONS, ...options };
}

/**
 * フォールバック用パレット抽出。
 * グレースケール画像など、メインアルゴリズムで色が取れない場合に使用。
 */
export function extractFallbackPalette(
  data: PixelData,
  width: number,
  height: number,
  channels: number,
  options?: ExtractOptions,
): ColorlipColor[] {
  const opts = resolveOptions(options);
  const pixelCount = width * height;
  if (pixelCount === 0) return [];

  const colorCounts = new Map<number, number>();
  let validPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * channels;
      const alpha = channels >= 4 ? (data[index + 3] ?? 255) : 255;
      if (alpha < ALPHA_THRESHOLD) continue;

      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;

      const qr = Math.round(r / FALLBACK_QUANTIZATION_STEP) * FALLBACK_QUANTIZATION_STEP;
      const qg = Math.round(g / FALLBACK_QUANTIZATION_STEP) * FALLBACK_QUANTIZATION_STEP;
      const qb = Math.round(b / FALLBACK_QUANTIZATION_STEP) * FALLBACK_QUANTIZATION_STEP;
      const key = (qr << 16) | (qg << 8) | qb;

      colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
      validPixels++;
    }
  }

  if (validPixels === 0) return [];

  return Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, opts.numColors)
    .map(([key, count]) => {
      const r = (key >> 16) & 0xff;
      const g = (key >> 8) & 0xff;
      const b = key & 0xff;
      return createDominantColor(r, g, b, count / validPixels);
    });
}
