# colorlip

Fast, general-purpose dominant color extraction library for Node.js and Browser. Especially strong with illustrations and artwork. Zero-dependency core.

## Features

- Adaptive color extraction using CIELAB Delta E perceptual distance
- Rich output: hex, HSL, Lab, LCH, OKLab, OKLCH, CSS color strings, and hue category per color
- Optional palette analysis with `dominant`, `accent`, and `swatches`
- Platform-agnostic core (`colorlip`) works anywhere
- Built-in adapters for **Node.js (sharp)** and **Browser (Canvas API)**
- TypeScript-first with full type definitions
- Zero runtime dependencies in core

## Install

```bash
npm install colorlip
```

For Node.js usage with sharp adapter:

```bash
npm install colorlip sharp
```

## Quick Start

### Node.js (sharp)

```ts
import { getColors } from "colorlip/sharp";

const colors = await getColors("photo.jpg");

console.log(colors[0]);
// {
//   r: 42, g: 98, b: 168, hex: '#2A62A8', percentage: 0.34,
//   hue: 213, saturation: 75, lightness: 41, hueCategory: 'blue',
//   lab: { L: 41.2, a: -2.3, b: -40.1 },
//   lch: { L: 41.2, C: 40.2, H: 266.7 },
//   oklab: { L: 0.49, a: -0.03, b: -0.12 },
//   oklch: { L: 0.49, C: 0.12, H: 256.7 },
//   css: { rgb: 'rgb(42 98 168)', hsl: 'hsl(213 60% 41%)', ... }
// }
```

```ts
import { getPalette } from "colorlip/sharp";

const palette = await getPalette("photo.jpg");

console.log(palette.dominant?.hex);
console.log(palette.accent?.hex);
console.log(palette.swatches);
```

### Browser (Canvas API)

```ts
import { getColors } from "colorlip/canvas";

const colors = await getColors(imgElement);
```

### Raw pixels (any environment)

```ts
import { getColors } from "colorlip";

const colors = getColors(pixelData, width, height, channels);
```

## API

### `getColors(source, options?)` — Node.js / sharp

Accepts a file path (`string`) or in-memory image data (`Buffer` / `Uint8Array`) and returns dominant colors.

### `getPalette(source, options?)` — Node.js / sharp

Returns `{ dominant, accent, swatches }`.

### `getColors(source, options?)` — Browser / Canvas

Accepts `HTMLImageElement`, `ImageBitmap`, `Blob`, or image URL string.

### `getPalette(source, options?)` — Browser / Canvas

Returns `{ dominant, accent, swatches }`.

### `getColorsFromImageData(imageData, options?)` — Browser / Canvas

Extracts from a Canvas `ImageData` object directly.

### `getColors(data, width, height, channels, options?)` — Core

Low-level function that works with raw pixel data (`Uint8Array` / `Uint8ClampedArray`). Platform-agnostic.

### `getPalette(data, width, height, channels, options?)` — Core

Low-level detailed API that returns a palette object.

### Legacy aliases

Existing names remain available for compatibility:

- `colorlip(...)`
- `colorlipFromFile(...)`
- `colorlipFromBuffer(...)`
- `colorlipFromImage(...)`
- `colorlipFromImageData(...)`
- `DominantColor` (type alias)

### Options

```ts
interface ExtractOptions {
  numColors?: number;            // Number of colors to extract (default: 3)
  saturationThreshold?: number;  // Saturation filter threshold (default: 0.15)
  brightnessMin?: number;        // Min brightness filter (default: 20)
  brightnessMax?: number;        // Max brightness filter (default: 235)
  quantizationStep?: number;     // Quantization step size (default: 12)
}
```

### Output

Each color in the result array is a `ColorlipColor`:

```ts
interface ColorlipColor {
  r: number;           // 0-255
  g: number;           // 0-255
  b: number;           // 0-255
  hex: string;         // e.g. "#2A62A8"
  percentage: number;  // Relative weight (0-1)
  hue: number;         // 0-360
  saturation: number;  // 0-100
  lightness: number;   // 0-100
  hueCategory: HueCategory; // "red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "violet" | "gray"

  lab:   { L: number; a: number; b: number }  // CIE L*a*b*
  lch:   { L: number; C: number; H: number }  // CIE LCH
  oklab: { L: number; a: number; b: number }  // OKLab
  oklch: { L: number; C: number; H: number }  // OKLCH

  css: {
    rgb:   string  // "rgb(42 98 168)"
    hsl:   string  // "hsl(213 60% 41%)"
    lab:   string  // "lab(43.1 -2.3 -40.1)"
    lch:   string  // "lch(43.1 40.2 266.7)"
    oklab: string  // "oklab(0.49 -0.03 -0.12)"
    oklch: string  // "oklch(0.49 0.12 256.7)"
  }
}
```

```ts
interface ColorlipPalette {
  dominant: ColorlipColor | null
  accent: ColorlipColor | null
  swatches: ColorlipColor[]
}
```

### Utility functions

```ts
import { rgbToHex, rgbToHsl, getHueCategory, createDominantColor, aggregateColors } from "colorlip";
```

| Function | Description |
|----------|-------------|
| `rgbToHex(r, g, b)` | RGB → hex string (e.g. `"#FF00AA"`) |
| `rgbToHsl(r, g, b)` | RGB → `{ h, s, l }` |
| `getHueCategory(hue)` | Hue (0–360) → `"red"` \| `"orange"` \| … \| `"gray"` |
| `createDominantColor(r, g, b, percentage)` | Build a full `ColorlipColor` object from RGB + weight |
| `aggregateColors(colorSets, numColors?)` | Merge multiple extraction results into top-N colors |

## How It Works

1. **Resize** — Image is downscaled to 150x150 max via adapter (sharp / canvas)
2. **Analyze** — Sampling pass estimates image characteristics (median saturation, edge centrality)
3. **Extract** — Single-pass pixel scan with adaptive saturation threshold, center weighting, and edge weighting
4. **Quantize** — Colors are bucketed by quantization step into a Map
5. **Score** — Each color bucket is scored by weight, saturation, and spatial variance
6. **Merge** — Similar colors are merged using CIE76 Delta E (threshold: 15)
7. **Fallback** — If no colors pass the filter, a simpler histogram-based extraction is used

## License

[MIT](./LICENSE)
