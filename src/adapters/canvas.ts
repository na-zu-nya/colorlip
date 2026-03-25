import { colorlip, getColors as getCoreColors, getPalette as getCorePalette } from "../core";
import type { ColorlipColor, ColorlipPalette, ExtractOptions } from "../types";

/** Canvas API 経由で受け付ける画像ソース */
export type ImageSource = HTMLImageElement | ImageBitmap | Blob | string;

const MAX_CANVAS_SIZE = 150;

/**
 * 画像ソースから代表色を抽出する（ブラウザ / Canvas API 使用）。
 *
 * @param source HTMLImageElement, ImageBitmap, Blob, または画像 URL
 */
export { colorlip, getCoreColors as getColorsFromPixels, getCorePalette as getPaletteFromPixels };

export async function getColors(
  source: ImageSource,
  options?: ExtractOptions,
): Promise<ColorlipColor[]> {
  const imageData = await toImageData(source);
  return colorlipFromImageData(imageData, options);
}

export async function getPalette(
  source: ImageSource,
  options?: ExtractOptions,
): Promise<ColorlipPalette> {
  const imageData = await toImageData(source);
  return getPaletteFromImageData(imageData, options);
}

async function toImageData(source: ImageSource): Promise<ImageData> {
  const bitmap = await toBitmap(source);
  try {
    const scale = Math.min(MAX_CANVAS_SIZE / bitmap.width, MAX_CANVAS_SIZE / bitmap.height, 1);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2d context from OffscreenCanvas");

    ctx.drawImage(bitmap, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  } finally {
    if ("close" in bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
  }
}

/**
 * 互換エイリアス: 画像ソースから代表色を抽出する。
 */
export async function colorlipFromImage(
  source: ImageSource,
  options?: ExtractOptions,
): Promise<ColorlipColor[]> {
  return getColors(source, options);
}

/**
 * ImageData から代表色を抽出する（Canvas API 使用）。
 */
export function getColorsFromImageData(
  imageData: ImageData,
  options?: ExtractOptions,
): ColorlipColor[] {
  return colorlip(imageData.data, imageData.width, imageData.height, 4, options);
}

export function getPaletteFromImageData(
  imageData: ImageData,
  options?: ExtractOptions,
): ColorlipPalette {
  return getCorePalette(imageData.data, imageData.width, imageData.height, 4, options);
}

/**
 * 互換エイリアス: ImageData から代表色を抽出する。
 */
export function colorlipFromImageData(
  imageData: ImageData,
  options?: ExtractOptions,
): ColorlipColor[] {
  return getColorsFromImageData(imageData, options);
}

async function toBitmap(source: ImageSource): Promise<ImageBitmap> {
  if (source instanceof ImageBitmap) return source;
  if (source instanceof Blob) return createImageBitmap(source);
  if (typeof source === "string") {
    const res = await fetch(source);
    const blob = await res.blob();
    return createImageBitmap(blob);
  }
  // HTMLImageElement
  return createImageBitmap(source);
}
