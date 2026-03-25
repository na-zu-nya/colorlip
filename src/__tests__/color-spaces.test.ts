import { describe, expect, it } from "vitest";
import {
  createCSSColors,
  deltaE76,
  getHueCategory,
  labToLch,
  oklabToOklch,
  rgbToHex,
  rgbToHsl,
  rgbToLab,
  rgbToOklab,
} from "../color-spaces";

describe("color-spaces", () => {
  it("rgbToHex を変換できる", () => {
    expect(rgbToHex(255, 0, 0)).toBe("#FF0000");
    expect(rgbToHex(1, 2, 3)).toBe("#010203");
  });

  it("rgbToHsl を変換できる", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl(128, 128, 128)).toEqual({ h: 0, s: 0, l: 50 });
  });

  it("getHueCategory を判定できる", () => {
    expect(getHueCategory(60)).toBe("yellow");
    expect(getHueCategory(180)).toBe("cyan");
    expect(getHueCategory(-10)).toBe("red");
  });

  it("Lab / LCH 変換ができる", () => {
    const lab = rgbToLab(255, 0, 0);
    expect(lab.L).toBeCloseTo(53.2, 0);
    const lch = labToLch(lab);
    expect(lch.C).toBeGreaterThan(100);
    expect(lch.H).toBeCloseTo(40, 0);
  });

  it("Delta E を計算できる", () => {
    const lab1 = rgbToLab(255, 0, 0);
    const lab2 = rgbToLab(0, 0, 255);
    expect(deltaE76(lab1, lab2)).toBeGreaterThan(100);
  });

  it("OKLab / OKLCH 変換ができる", () => {
    const oklab = rgbToOklab(255, 0, 0);
    expect(oklab.L).toBeGreaterThan(0);
    expect(oklab.L).toBeLessThan(1);
    const oklch = oklabToOklch(oklab);
    expect(oklch.C).toBeGreaterThan(0);
    expect(oklch.H).toBeGreaterThanOrEqual(0);
  });

  it("CSS カラー文字列を生成できる", () => {
    const hsl = rgbToHsl(255, 0, 0);
    const lab = rgbToLab(255, 0, 0);
    const lch = labToLch(lab);
    const oklab = rgbToOklab(255, 0, 0);
    const oklch = oklabToOklch(oklab);
    const css = createCSSColors(255, 0, 0, hsl, lab, lch, oklab, oklch);
    expect(css.rgb).toBe("rgb(255 0 0)");
    expect(css.hsl).toBe("hsl(0 100% 50%)");
    expect(css.lab).toMatch(/^lab\(.+\)$/);
    expect(css.oklch).toMatch(/^oklch\(.+\)$/);
  });
});
