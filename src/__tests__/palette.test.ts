import { describe, expect, it } from "vitest";
import { rgbToLab, rgbToOklab, oklabToOklch } from "../color-spaces";
import { createDominantColor } from "../colorlip-color";
import {
  buildPaletteFromCandidates,
  calculateAccentPreference,
  calculateDominantPreference,
  pickAccentFromSwatches,
} from "../palette";

describe("palette helpers", () => {
  it("prefers the oklch target zone for accent preference", () => {
    const target = calculateAccentPreference({ L: 0.72, C: 0.24, H: 120 });
    const darkMuted = calculateAccentPreference({ L: 0.35, C: 0.04, H: 120 });

    expect(target).toBeGreaterThan(darkMuted);
  });

  it("picks a distant vivid swatch as accent", () => {
    const dominant = createDominantColor(220, 192, 127, 0.4);
    const muted = createDominantColor(180, 170, 170, 0.12);
    const vivid = createDominantColor(199, 81, 97, 0.08);

    const accent = pickAccentFromSwatches([dominant, muted, vivid], dominant);

    expect(accent?.hex).toBe(vivid.hex);
  });

  it("prefers a more perceptually representative swatch as dominant when scores are close", () => {
    const candidates = [
      {
        r: 36,
        g: 41,
        b: 53,
        lab: rgbToLab(36, 41, 53),
        score: 120,
        weight: 120,
        accentPreference: calculateAccentPreference(oklabToOklch(rgbToOklab(36, 41, 53))),
      },
      {
        r: 216,
        g: 156,
        b: 116,
        lab: rgbToLab(216, 156, 116),
        score: 108,
        weight: 78,
        accentPreference: calculateAccentPreference(oklabToOklch(rgbToOklab(216, 156, 116))),
      },
      {
        r: 164,
        g: 171,
        b: 182,
        lab: rgbToLab(164, 171, 182),
        score: 72,
        weight: 72,
        accentPreference: calculateAccentPreference(oklabToOklch(rgbToOklab(164, 171, 182))),
      },
    ];

    const palette = buildPaletteFromCandidates(candidates, 400, 3, 15);

    expect(palette.dominant?.hex).toBe("#D89C74");
    expect(palette.swatches[0]?.hex).toBe("#D89C74");
  });

  it("keeps the top swatch as dominant when it clearly leads", () => {
    const candidates = [
      {
        r: 48,
        g: 56,
        b: 64,
        lab: rgbToLab(48, 56, 64),
        score: 180,
        weight: 180,
        accentPreference: calculateAccentPreference(oklabToOklch(rgbToOklab(48, 56, 64))),
      },
      {
        r: 214,
        g: 164,
        b: 126,
        lab: rgbToLab(214, 164, 126),
        score: 90,
        weight: 64,
        accentPreference: calculateAccentPreference(oklabToOklch(rgbToOklab(214, 164, 126))),
      },
    ];

    const palette = buildPaletteFromCandidates(candidates, 320, 2, 15);

    expect(palette.dominant?.hex).toBe("#303840");
    expect(palette.swatches[0]?.hex).toBe("#303840");
  });

  it("scores a balanced warm midtone higher than a dark muted tone for dominant preference", () => {
    const warmMidtone = calculateDominantPreference(oklabToOklch(rgbToOklab(216, 156, 116)));
    const darkMuted = calculateDominantPreference(oklabToOklch(rgbToOklab(36, 41, 53)));

    expect(warmMidtone).toBeGreaterThan(darkMuted);
  });

  it("can recover an accent from candidates outside top swatches", () => {
    const dominant = createDominantColor(222, 192, 127, 0.3);
    const candidates = [
      {
        r: 222,
        g: 192,
        b: 127,
        lab: rgbToLab(222, 192, 127),
        score: 120,
        weight: 120,
        accentPreference: calculateAccentPreference(oklabToOklch(rgbToOklab(222, 192, 127))),
      },
      {
        r: 191,
        g: 142,
        b: 251,
        lab: rgbToLab(191, 142, 251),
        score: 45,
        weight: 12,
        accentPreference: calculateAccentPreference(oklabToOklch(rgbToOklab(191, 142, 251))),
      },
      {
        r: 113,
        g: 85,
        b: 81,
        lab: rgbToLab(113, 85, 81),
        score: 78,
        weight: 78,
        accentPreference: calculateAccentPreference(oklabToOklch(rgbToOklab(113, 85, 81))),
      },
    ];

    const palette = buildPaletteFromCandidates(candidates, 400, 2, 15);

    expect(palette.dominant?.hex).toBe(dominant.hex);
    expect(palette.accent?.hex).toBe("#BF8EFB");
  });
});
