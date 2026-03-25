import { describe, expect, it } from "vitest";
import { rgbToLab, rgbToOklab, oklabToOklch } from "../color-spaces";
import { createDominantColor } from "../colorlip-color";
import { buildPaletteFromCandidates, calculateAccentPreference, pickAccentFromSwatches } from "../palette";

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
