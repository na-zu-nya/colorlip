import sharp from "sharp";
import { MAX_RESIZE } from "../constants";
import { colorlip, getColors as getCoreColors, getPalette as getCorePalette } from "../core";
import type { ColorlipColor, ColorlipPalette, ExtractOptions } from "../types";

/**
 * 画像ソースから代表色を抽出する（Node.js / sharp 使用）。
 */
export { colorlip, getCoreColors as getColorsFromPixels, getCorePalette as getPaletteFromPixels };

export async function getColors(
  source: string | Buffer | Uint8Array,
  options?: ExtractOptions,
): Promise<ColorlipColor[]> {
  const pixels = await loadSharpPixels(source);
  if (!pixels) return [];
  return colorlip(pixels.data, pixels.width, pixels.height, pixels.channels, options);
}

export async function getPalette(
  source: string | Buffer | Uint8Array,
  options?: ExtractOptions,
): Promise<ColorlipPalette> {
  const pixels = await loadSharpPixels(source);
  if (!pixels) return { dominant: null, accent: null, swatches: [] };
  return getCorePalette(pixels.data, pixels.width, pixels.height, pixels.channels, options);
}

/**
 * 互換エイリアス: ファイルパスから代表色を抽出する。
 */
export async function colorlipFromFile(
  filePath: string,
  options?: ExtractOptions,
): Promise<ColorlipColor[]> {
  return getColors(filePath, options);
}

/**
 * 互換エイリアス: バッファから代表色を抽出する。
 */
export async function colorlipFromBuffer(
  buffer: Buffer | Uint8Array,
  options?: ExtractOptions,
): Promise<ColorlipColor[]> {
  return getColors(buffer, options);
}

async function loadSharpPixels(source: string | Buffer | Uint8Array): Promise<{
  data: Uint8Array;
  width: number;
  height: number;
  channels: number;
} | null> {
  const image = sharp(source);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) return null;

  const scale = Math.min(MAX_RESIZE / metadata.width, MAX_RESIZE / metadata.height, 1);
  const newWidth = Math.max(1, Math.round(metadata.width * scale));
  const newHeight = Math.max(1, Math.round(metadata.height * scale));

  const { data, info } = await image
    .resize(newWidth, newHeight, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}
