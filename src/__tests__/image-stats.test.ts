import { describe, expect, it } from "vitest";
import { analyzeImageStats } from "../image-stats";

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

describe("image-stats", () => {
  it("高彩度画像では分位点が高い", () => {
    const stats = analyzeImageStats(makeSolidPixels(255, 0, 0, 20, 20), 20, 20, 3);
    expect(stats.medianSaturation).toBeGreaterThan(0.5);
    expect(stats.saturationP25).toBeGreaterThan(0.5);
    expect(stats.saturationP75).toBeGreaterThan(0.5);
  });

  it("グレー画像では彩度分位点が 0 になる", () => {
    const stats = analyzeImageStats(makeSolidPixels(128, 128, 128, 20, 20), 20, 20, 3);
    expect(stats.medianSaturation).toBe(0);
    expect(stats.saturationP25).toBe(0);
    expect(stats.saturationP75).toBe(0);
  });

  it("空画像でもクラッシュしない", () => {
    const stats = analyzeImageStats(new Uint8Array(0), 0, 0, 3);
    expect(stats).toEqual({
      medianSaturation: 0,
      saturationP25: 0,
      saturationP75: 0,
      edgeCentrality: 0.5,
    });
  });

  it("ignores pixels below the alpha cutoff when computing stats", () => {
    const data = new Uint8Array([
      255, 0, 0, 255,
      128, 128, 128, 127,
    ]);

    const stats = analyzeImageStats(data, 2, 1, 4);

    expect(stats.medianSaturation).toBeGreaterThan(0.9);
    expect(stats.saturationP25).toBeGreaterThan(0.9);
    expect(stats.saturationP75).toBeGreaterThan(0.9);
  });
});
