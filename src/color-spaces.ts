import type { CSSColors, HSL, HueCategory, LCH, Lab, OKLCH, OKLab } from "./types";

/** RGB (0-255) → CIELAB。D65 白色点使用。 */
export function rgbToLab(r: number, g: number, b: number): Lab {
  let rl = r / 255;
  let gl = g / 255;
  let bl = b / 255;

  rl = rl > 0.04045 ? ((rl + 0.055) / 1.055) ** 2.4 : rl / 12.92;
  gl = gl > 0.04045 ? ((gl + 0.055) / 1.055) ** 2.4 : gl / 12.92;
  bl = bl > 0.04045 ? ((bl + 0.055) / 1.055) ** 2.4 : bl / 12.92;

  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  let z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;

  const epsilon = 0.008856;
  const kappa = 903.3;

  x = x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116;
  y = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116;
  z = z > epsilon ? Math.cbrt(z) : (kappa * z + 16) / 116;

  return {
    L: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

/** CIE76 Delta E（Lab 空間でのユークリッド距離） */
export function deltaE76(lab1: Lab, lab2: Lab): number {
  return Math.sqrt((lab1.L - lab2.L) ** 2 + (lab1.a - lab2.a) ** 2 + (lab1.b - lab2.b) ** 2);
}

/** Lab → LCH（Lab の極座標変換） */
export function labToLch(lab: Lab): LCH {
  const C = Math.sqrt(lab.a ** 2 + lab.b ** 2);
  let H = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: lab.L, C, H };
}

/** RGB (0-255) → OKLab */
export function rgbToOklab(r: number, g: number, b: number): OKLab {
  let rl = r / 255;
  let gl = g / 255;
  let bl = b / 255;

  rl = rl > 0.04045 ? ((rl + 0.055) / 1.055) ** 2.4 : rl / 12.92;
  gl = gl > 0.04045 ? ((gl + 0.055) / 1.055) ** 2.4 : gl / 12.92;
  bl = bl > 0.04045 ? ((bl + 0.055) / 1.055) ** 2.4 : bl / 12.92;

  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/** OKLab → OKLCH（OKLab の極座標変換） */
export function oklabToOklch(oklab: OKLab): OKLCH {
  const C = Math.sqrt(oklab.a ** 2 + oklab.b ** 2);
  let H = (Math.atan2(oklab.b, oklab.a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: oklab.L, C, H };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** 全色空間から CSS 文字列を生成 */
export function createCSSColors(
  r: number,
  g: number,
  b: number,
  hsl: HSL,
  lab: Lab,
  lch: LCH,
  oklab: OKLab,
  oklch: OKLCH,
): CSSColors {
  return {
    rgb: `rgb(${r} ${g} ${b})`,
    hsl: `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`,
    lab: `lab(${round(lab.L, 1)} ${round(lab.a, 1)} ${round(lab.b, 1)})`,
    lch: `lch(${round(lch.L, 1)} ${round(lch.C, 1)} ${round(lch.H, 1)})`,
    oklab: `oklab(${round(oklab.L, 2)} ${round(oklab.a, 2)} ${round(oklab.b, 2)})`,
    oklch: `oklch(${round(oklch.L, 2)} ${round(oklch.C, 2)} ${round(oklch.H, 1)})`,
  };
}

/** RGB → 16進数カラーコード（例: `#FF00AA`）。 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => {
      const hex = x.toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    })
    .join("")
    .toUpperCase()}`;
}

/** RGB → HSL 変換。 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/** 色相値から色相カテゴリを判定。 */
export function getHueCategory(hue: number): HueCategory {
  let h = hue % 360;
  if (h < 0) h += 360;

  if (h >= 345 || h < 15) return "red";
  if (h < 45) return "orange";
  if (h < 75) return "yellow";
  if (h < 135) return "green";
  if (h < 195) return "cyan";
  if (h < 255) return "blue";
  if (h < 345) return "violet";

  return "gray";
}
