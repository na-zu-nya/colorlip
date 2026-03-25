import { describe, expect, it } from "vitest";
import { calculateAdaptiveMergeThresholds, clusterNearbyBins, quantizeColorKey } from "../merge";

describe("merge helpers", () => {
  it("reduces merge thresholds for muted narrow-range images", () => {
    const vivid = calculateAdaptiveMergeThresholds(
      { medianSaturation: 0.3, saturationP25: 0.2, saturationP75: 0.45, edgeCentrality: 0.5 },
      0.25,
    );
    const muted = calculateAdaptiveMergeThresholds(
      { medianSaturation: 0.05, saturationP25: 0.03, saturationP75: 0.07, edgeCentrality: 0.5 },
      0.04,
    );

    expect(muted.preMergeDeltaE).toBeLessThan(vivid.preMergeDeltaE);
    expect(muted.finalMergeDeltaE).toBeLessThan(vivid.finalMergeDeltaE);
  });

  it("clusters only nearby bins within the given delta", () => {
    const map = new Map([
      [
        quantizeColorKey(120, 180, 40, 12),
        {
          weight: 10,
          sumR: 1200,
          sumG: 1800,
          sumB: 400,
          sumX: 10,
          sumY: 10,
          sumX2: 20,
          sumY2: 20,
          borderCount: 1,
          centerCount: 4,
          count: 10,
        },
      ],
      [
        quantizeColorKey(126, 184, 46, 12),
        {
          weight: 8,
          sumR: 1008,
          sumG: 1472,
          sumB: 368,
          sumX: 8,
          sumY: 8,
          sumX2: 16,
          sumY2: 16,
          borderCount: 1,
          centerCount: 3,
          count: 8,
        },
      ],
      [
        quantizeColorKey(220, 220, 220, 12),
        {
          weight: 9,
          sumR: 1980,
          sumG: 1980,
          sumB: 1980,
          sumX: 6,
          sumY: 6,
          sumX2: 12,
          sumY2: 12,
          borderCount: 3,
          centerCount: 1,
          count: 9,
        },
      ],
    ]);

    const clusters = clusterNearbyBins(map, 18);

    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.count).toBe(18);
    expect(clusters[1]?.count).toBe(9);
  });
});
