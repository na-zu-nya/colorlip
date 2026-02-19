import sharp from "sharp";
import { MAX_RESIZE } from "../constants";
import { extractFromPixels } from "../core";
import type { DominantColor, ExtractOptions } from "../types";

/**
 * 画像ファイルから代表色を抽出する（Node.js / sharp 使用）。
 */
export async function extractFromFile(
  filePath: string,
  options?: ExtractOptions,
): Promise<DominantColor[]> {
  const image = sharp(filePath);
  return extractFromSharpInstance(image, options);
}

/**
 * 画像バッファから代表色を抽出する（Node.js / sharp 使用）。
 */
export async function extractFromBuffer(
  buffer: Buffer | Uint8Array,
  options?: ExtractOptions,
): Promise<DominantColor[]> {
  const image = sharp(buffer);
  return extractFromSharpInstance(image, options);
}

async function extractFromSharpInstance(
  image: sharp.Sharp,
  options?: ExtractOptions,
): Promise<DominantColor[]> {
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) return [];

  const scale = Math.min(MAX_RESIZE / metadata.width, MAX_RESIZE / metadata.height, 1);
  const newWidth = Math.max(1, Math.round(metadata.width * scale));
  const newHeight = Math.max(1, Math.round(metadata.height * scale));

  const { data, info } = await image
    .resize(newWidth, newHeight, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return extractFromPixels(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    info.width,
    info.height,
    info.channels,
    options,
  );
}
