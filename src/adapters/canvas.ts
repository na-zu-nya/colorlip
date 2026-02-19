import { extractFromPixels } from "../core";
import type { DominantColor, ExtractOptions } from "../types";

/** Canvas API 経由で受け付ける画像ソース */
export type ImageSource = HTMLImageElement | ImageBitmap | Blob | string;

const MAX_CANVAS_SIZE = 150;

/**
 * 画像ソースから代表色を抽出する（ブラウザ / Canvas API 使用）。
 *
 * @param source HTMLImageElement, ImageBitmap, Blob, または画像 URL
 */
export async function extractFromImage(
  source: ImageSource,
  options?: ExtractOptions,
): Promise<DominantColor[]> {
  const bitmap = await toBitmap(source);
  try {
    const scale = Math.min(MAX_CANVAS_SIZE / bitmap.width, MAX_CANVAS_SIZE / bitmap.height, 1);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2d context from OffscreenCanvas");

    ctx.drawImage(bitmap, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    return extractFromImageData(imageData, options);
  } finally {
    if ("close" in bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
  }
}

/**
 * ImageData から代表色を抽出する（Canvas API 使用）。
 */
export function extractFromImageData(
  imageData: ImageData,
  options?: ExtractOptions,
): DominantColor[] {
  return extractFromPixels(imageData.data, imageData.width, imageData.height, 4, options);
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
