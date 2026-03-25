import {
  createCSSColors,
  getHueCategory,
  labToLch,
  rgbToHex,
  rgbToHsl,
  rgbToLab,
  rgbToOklab,
  oklabToOklch,
} from "./color-spaces";
import type { ColorlipColor, HueCategory } from "./types";

/**
 * RGB + percentage から ColorlipColor オブジェクトを生成。
 */
export function createDominantColor(
  r: number,
  g: number,
  b: number,
  percentage: number,
): ColorlipColor {
  const hsl = rgbToHsl(r, g, b);
  const hueCategory: HueCategory = hsl.s <= 5 ? "gray" : getHueCategory(hsl.h);
  const lab = rgbToLab(r, g, b);
  const lch = labToLch(lab);
  const oklab = rgbToOklab(r, g, b);
  const oklch = oklabToOklch(oklab);
  const css = createCSSColors(r, g, b, hsl, lab, lch, oklab, oklch);

  return {
    r,
    g,
    b,
    hex: rgbToHex(r, g, b),
    percentage,
    hue: hsl.h,
    saturation: hsl.s,
    lightness: hsl.l,
    hueCategory,
    lab,
    lch,
    oklab,
    oklch,
    css,
  };
}

/**
 * 複数画像の色セットを集約し、上位 numColors 色を返す。
 */
export function aggregateColors(colorSets: ColorlipColor[][], numColors = 3): ColorlipColor[] {
  const colorMap = new Map<string, { color: ColorlipColor; weight: number }>();

  for (const colors of colorSets) {
    for (const color of colors) {
      const key = color.hex;
      const existing = colorMap.get(key);

      if (existing) {
        existing.weight += color.percentage;
      } else {
        colorMap.set(key, { color: { ...color }, weight: color.percentage });
      }
    }
  }

  return Array.from(colorMap.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, numColors)
    .map((item) =>
      createDominantColor(item.color.r, item.color.g, item.color.b, item.weight / colorSets.length),
    );
}
