import {
  ACCENT_OKLCH_CHROMA_SIGMA,
  ACCENT_OKLCH_CHROMA_TARGET,
  ACCENT_OKLCH_LIGHTNESS_SIGMA,
  ACCENT_OKLCH_LIGHTNESS_TARGET,
  DOMINANT_OKLCH_CHROMA_SIGMA,
  DOMINANT_OKLCH_CHROMA_TARGET,
  DOMINANT_OKLCH_LIGHTNESS_SIGMA,
  DOMINANT_OKLCH_LIGHTNESS_TARGET,
} from "./constants";
import { deltaE76 } from "./color-spaces";
import { createDominantColor } from "./colorlip-color";
import type { ScoredColorEntry } from "./analysis-types";
import type { ColorlipColor, ColorlipPalette, Lab, OKLCH } from "./types";

export function buildSwatches(
  sortedColors: ScoredColorEntry[],
  pixelCount: number,
  numColors: number,
  finalMergeDeltaE: number,
): ColorlipColor[] {
  const dominantColors: ColorlipColor[] = [];
  const usedEntries: Lab[] = [];

  for (const color of sortedColors) {
    if (dominantColors.length >= numColors) break;

    let merged = false;
    for (const used of usedEntries) {
      if (deltaE76(color.lab, used) < finalMergeDeltaE) {
        merged = true;
        break;
      }
    }

    if (!merged) {
      usedEntries.push(color.lab);
      dominantColors.push(createDominantColor(color.r, color.g, color.b, color.weight / pixelCount));
    }
  }

  return dominantColors;
}

export function buildPaletteFromCandidates(
  candidates: ScoredColorEntry[],
  pixelCount: number,
  numColors: number,
  finalMergeDeltaE: number,
): ColorlipPalette {
  const swatches = buildSwatches(candidates, pixelCount, numColors, finalMergeDeltaE);
  const dominant = selectDominantFromCandidates(candidates, swatches, pixelCount);
  const orderedSwatches = dominant ? promoteSwatchToFront(swatches, dominant) : swatches;
  const accent = selectAccent(candidates, dominant, orderedSwatches, pixelCount);
  return { dominant, accent, swatches: orderedSwatches };
}

export function buildPaletteFromSwatches(swatches: ColorlipColor[]): ColorlipPalette {
  const dominant = swatches[0] ?? null;
  const accent = dominant ? pickAccentFromSwatches(swatches, dominant) : null;
  return { dominant, accent, swatches };
}

export function calculateAccentPreference(oklch: OKLCH): number {
  const lightnessDelta = oklch.L - ACCENT_OKLCH_LIGHTNESS_TARGET;
  const chromaDelta = oklch.C - ACCENT_OKLCH_CHROMA_TARGET;
  const accentLightnessScore = Math.exp(
    -(lightnessDelta * lightnessDelta) /
      (2 * ACCENT_OKLCH_LIGHTNESS_SIGMA * ACCENT_OKLCH_LIGHTNESS_SIGMA),
  );
  const accentChromaScore = Math.exp(
    -(chromaDelta * chromaDelta) /
      (2 * ACCENT_OKLCH_CHROMA_SIGMA * ACCENT_OKLCH_CHROMA_SIGMA),
  );
  return accentLightnessScore * accentChromaScore;
}

export function calculateDominantPreference(oklch: OKLCH): number {
  const lightnessDelta = oklch.L - DOMINANT_OKLCH_LIGHTNESS_TARGET;
  const chromaDelta = oklch.C - DOMINANT_OKLCH_CHROMA_TARGET;
  const dominantLightnessScore = Math.exp(
    -(lightnessDelta * lightnessDelta) /
      (2 * DOMINANT_OKLCH_LIGHTNESS_SIGMA * DOMINANT_OKLCH_LIGHTNESS_SIGMA),
  );
  const dominantChromaScore = Math.exp(
    -(chromaDelta * chromaDelta) / (2 * DOMINANT_OKLCH_CHROMA_SIGMA * DOMINANT_OKLCH_CHROMA_SIGMA),
  );
  return dominantLightnessScore * dominantChromaScore;
}

function selectAccent(
  candidates: ScoredColorEntry[],
  dominant: ColorlipColor | null,
  swatches: ColorlipColor[],
  pixelCount: number,
): ColorlipColor | null {
  if (!dominant || pixelCount === 0) return null;

  const candidateAccent = pickAccentFromCandidates(candidates, dominant, swatches, pixelCount);
  if (candidateAccent) return candidateAccent;

  return pickAccentFromSwatches(swatches, dominant);
}

function promoteSwatchToFront(swatches: ColorlipColor[], dominant: ColorlipColor): ColorlipColor[] {
  const index = swatches.findIndex((swatch) => swatch.hex === dominant.hex);
  if (index <= 0) return swatches;

  const nextSwatches = [...swatches];
  const [selected] = nextSwatches.splice(index, 1);
  if (!selected) return swatches;

  return [selected, ...nextSwatches];
}

function selectDominantFromCandidates(
  candidates: ScoredColorEntry[],
  swatches: ColorlipColor[],
  pixelCount: number,
): ColorlipColor | null {
  const topSwatch = swatches[0] ?? null;
  if (!topSwatch || pixelCount <= 0) return topSwatch;

  const candidateByHex = new Map(
    candidates.map((candidate) => [
      createDominantColor(candidate.r, candidate.g, candidate.b, candidate.weight / pixelCount).hex,
      candidate,
    ]),
  );

  const topCandidate = candidateByHex.get(topSwatch.hex);
  if (!topCandidate) return topSwatch;

  const topScore = topCandidate.score;
  const topWeight = topCandidate.weight;
  const dominantPool = swatches
    .slice(0, Math.min(swatches.length, 4))
    .map((swatch) => {
      const candidate = candidateByHex.get(swatch.hex);
      if (!candidate) return null;

      const scoreRatio = topScore > 0 ? candidate.score / topScore : 0;
      const weightRatio = topWeight > 0 ? candidate.weight / topWeight : 0;
      const dominantPreference = calculateDominantPreference(swatch.oklch);
      const dominantRank = scoreRatio * 0.4 + weightRatio * 0.2 + dominantPreference * 0.4;

      return {
        swatch,
        candidate,
        scoreRatio,
        weightRatio,
        dominantPreference,
        dominantRank,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        swatch: ColorlipColor;
        candidate: ScoredColorEntry;
        scoreRatio: number;
        weightRatio: number;
        dominantPreference: number;
        dominantRank: number;
      } => Boolean(entry),
    );

  const topEntry = dominantPool.find((entry) => entry.swatch.hex === topSwatch.hex);
  if (!topEntry) return topSwatch;

  const bestEntry =
    dominantPool
      .filter((entry) => entry.scoreRatio >= 0.8 && entry.weightRatio >= 0.45)
      .sort((a, b) => b.dominantRank - a.dominantRank)[0] ?? topEntry;
  if (bestEntry.swatch.hex === topSwatch.hex) return topSwatch;

  const topDominantRank = topEntry.dominantRank;
  const promotionGain = bestEntry.dominantRank - topDominantRank;
  const preferenceGain = bestEntry.dominantPreference - topEntry.dominantPreference;

  if (promotionGain < 0.025 || preferenceGain < 0.12) return topSwatch;

  return bestEntry.swatch;
}

export function pickAccentFromSwatches(
  swatches: ColorlipColor[],
  dominant: ColorlipColor,
): ColorlipColor | null {
  return (
    swatches
      .filter((swatch) => swatch.hex !== dominant.hex && deltaE76(swatch.lab, dominant.lab) >= 28)
      .sort((a, b) => {
        const accentDelta = calculateAccentPreference(b.oklch) - calculateAccentPreference(a.oklch);
        if (accentDelta !== 0) return accentDelta;
        return b.percentage - a.percentage;
      })[0] ?? null
  );
}

export function pickAccentFromCandidates(
  candidates: ScoredColorEntry[],
  dominant: ColorlipColor,
  swatches: ColorlipColor[],
  pixelCount: number,
): ColorlipColor | null {
  const topScore = candidates[0]?.score ?? 0;
  return (
    [...candidates]
      .map((candidate) => {
        const weightRatio = candidate.weight / pixelCount;
        const distance = deltaE76(candidate.lab, dominant.lab);
        if (weightRatio < 0.0015 || distance < 28) return null;

        const color = createDominantColor(
          candidate.r,
          candidate.g,
          candidate.b,
          candidate.weight / pixelCount,
        );
        if (color.hex === dominant.hex) return null;

        const scoreRatio = topScore > 0 ? candidate.score / topScore : 0;
        const saturationFactor = Math.max(color.saturation / 100, 0.25);
        if (color.saturation < 18 && candidate.accentPreference < 0.12) return null;
        const accentRank =
          candidate.accentPreference *
          candidate.accentPreference *
          saturationFactor *
          Math.pow(weightRatio, 0.25) *
          Math.max(0.15, Math.min(1, scoreRatio)) *
          Math.min(distance / 32, 1.75);
        return { color, accentRank };
      })
      .filter((entry): entry is { color: ColorlipColor; accentRank: number } => Boolean(entry))
      .sort((a, b) => b.accentRank - a.accentRank)
      .map(({ color }) => swatches.find((swatch) => swatch.hex === color.hex) ?? color)
      .find((color): color is ColorlipColor => Boolean(color)) ?? null
  );
}
