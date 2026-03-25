import { describe, expect, it } from "vitest";
import { extractFallbackPalette } from "../fallback";

function makeSolidPixels(
  r: number,
  g: number,
  b: number,
  w: number,
  h: number,
  channels = 3,
): Uint8Array {
  const data = new Uint8Array(w * h * channels);
  for (let i = 0; i < w * h; i++) {
    data[i * channels] = r;
    data[i * channels + 1] = g;
    data[i * channels + 2] = b;
    if (channels === 4) data[i * channels + 3] = 255;
  }
  return data;
}

describe("fallback palette", () => {
  it("extracts quantized colors from a solid image", () => {
    const colors = extractFallbackPalette(makeSolidPixels(255, 12, 8, 4, 4), 4, 4, 3);

    expect(colors).toHaveLength(1);
    expect(colors[0]?.percentage).toBe(1);
  });

  it("returns an empty list for fully transparent pixels", () => {
    const data = makeSolidPixels(255, 0, 0, 4, 4, 4);
    for (let i = 0; i < data.length / 4; i++) data[i * 4 + 3] = 0;

    expect(extractFallbackPalette(data, 4, 4, 4)).toEqual([]);
  });

  it("ignores pixels below the 0.5 alpha cutoff", () => {
    const data = makeSolidPixels(255, 0, 0, 2, 1, 4);
    data[3] = 127;
    data[7] = 255;

    const colors = extractFallbackPalette(data, 2, 1, 4);

    expect(colors).toHaveLength(1);
    expect(colors[0]?.percentage).toBe(1);
  });
});
