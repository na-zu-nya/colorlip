import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS } from "../constants";
import { createExtractionContext, collectQuantizedBins, scoreClusteredEntries } from "../extraction";

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

describe("extraction helpers", () => {
  it("builds a lower saturation floor for muted images", () => {
    const vivid = createExtractionContext(20, 20, DEFAULT_OPTIONS, {
      medianSaturation: 0.28,
      saturationP25: 0.18,
      saturationP75: 0.4,
      edgeCentrality: 0.5,
    });
    const muted = createExtractionContext(20, 20, DEFAULT_OPTIONS, {
      medianSaturation: 0.06,
      saturationP25: 0.03,
      saturationP75: 0.08,
      edgeCentrality: 0.5,
    });

    expect(muted.saturationFloor).toBeLessThan(vivid.saturationFloor);
  });

  it("filters out only extremely desaturated bins during collection", () => {
    const data = makeSolidPixels(176, 185, 178, 4, 4);
    const opts = { ...DEFAULT_OPTIONS, saturationThreshold: 0.15 };
    const stats = {
      medianSaturation: 0.1,
      saturationP25: 0.06,
      saturationP75: 0.14,
      edgeCentrality: 0.5,
    };
    const context = createExtractionContext(4, 4, opts, stats);

    const bins = collectQuantizedBins(data, 4, 4, 3, opts, stats, context);

    expect(bins.size).toBe(1);
  });

  it("scores a centered vivid cluster above a peripheral muted cluster", () => {
    const context = createExtractionContext(20, 20, DEFAULT_OPTIONS, {
      medianSaturation: 0.18,
      saturationP25: 0.12,
      saturationP75: 0.24,
      edgeCentrality: 0.7,
    });

    const scored = scoreClusteredEntries(
      [
        {
          r: 200,
          g: 80,
          b: 100,
          lab: { L: 0, a: 0, b: 0 },
          weight: 20,
          saturation: 0.6,
          sumX: 100,
          sumY: 100,
          sumX2: 500,
          sumY2: 500,
          borderCount: 0,
          centerCount: 8,
          count: 8,
          sumR: 0,
          sumG: 0,
          sumB: 0,
        },
        {
          r: 170,
          g: 165,
          b: 160,
          lab: { L: 0, a: 0, b: 0 },
          weight: 20,
          saturation: 0.08,
          sumX: 12,
          sumY: 12,
          sumX2: 36,
          sumY2: 36,
          borderCount: 8,
          centerCount: 0,
          count: 8,
          sumR: 0,
          sumG: 0,
          sumB: 0,
        },
      ],
      20,
      20,
      context,
    );

    expect(scored[0]?.r).toBe(200);
    expect(scored[1]?.r).toBe(170);
  });

  it("drops pixels below the alpha cutoff and downweights semi-transparent pixels", () => {
    const data = new Uint8Array([
      220, 40, 60, 255,
      220, 40, 60, 128,
      220, 40, 60, 127,
    ]);
    const opts = DEFAULT_OPTIONS;
    const stats = {
      medianSaturation: 0.5,
      saturationP25: 0.4,
      saturationP75: 0.6,
      edgeCentrality: 0.5,
    };
    const context = createExtractionContext(3, 1, opts, stats);

    const bins = collectQuantizedBins(data, 3, 1, 4, opts, stats, context);
    const key = [...bins.keys()][0];
    const entry = key ? bins.get(key) : undefined;

    expect(bins.size).toBe(1);
    expect(entry?.count).toBeCloseTo(1 + (128 / 255) ** 2, 4);
  });
});
