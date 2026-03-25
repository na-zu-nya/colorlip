import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS } from "../constants";
import { analyzeAdvancedColors } from "../advanced";

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

describe("advanced analysis", () => {
  it("returns no candidates for empty pixels", () => {
    const result = analyzeAdvancedColors(new Uint8Array(), 0, 0, 3, DEFAULT_OPTIONS);

    expect(result.pixelCount).toBe(0);
    expect(result.candidates).toEqual([]);
  });

  it("produces ranked candidates for a colorful image", () => {
    const result = analyzeAdvancedColors(makeSolidPixels(240, 200, 72, 8, 8), 8, 8, 3, DEFAULT_OPTIONS);

    expect(result.pixelCount).toBe(64);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.finalMergeDeltaE).toBeGreaterThan(0);
  });
});
