# colorlip

Fast dominant color extraction for Node.js and the browser.

`colorlip` is a lightweight, fast, TypeScript-first library for extracting dominant colors and compact palettes from images. It is tuned to pick colors that feel more perceptually right, especially for illustrations, artwork, and product images where visual impression matters. It is designed with visually driven use cases in mind, including illustration communities, social platforms, and commerce experiences.

[日本語版 README](./README.ja.md)

## Features

- Perceptually tuned color extraction that works well for illustrations and artwork
- Adaptive palette extraction based on image statistics
- Natural merging of nearby colors using CIELAB Delta E
- Practical palette API with `dominant`, `accent`, and `swatches`
- Rich color output: `hex`, `HSL`, `Lab`, `LCH`, `OKLab`, `OKLCH`, CSS color strings, and hue category
- Platform-agnostic core for raw pixel data
- Built-in adapters for `sharp` and Canvas
- Zero runtime dependencies in the core package

## Install

Core only:

```bash
npm install colorlip
```

Node.js with the `sharp` adapter:

```bash
npm install colorlip sharp
```

`sharp` is an optional peer dependency and is only required when you use `colorlip/sharp`.

## Quick Start

### Node.js

```ts
import { getColors, getPalette } from "colorlip/sharp";

const colors = await getColors("photo.jpg");
const palette = await getPalette("photo.jpg");

console.log(colors[0]?.hex);
console.log(palette.dominant?.hex);
console.log(palette.accent?.hex);
console.log(palette.swatches);
```

### Browser

```ts
import { getColors, getPalette } from "colorlip/canvas";

const colors = await getColors(imgElement);
const palette = await getPalette(imgElement);
```

### Raw Pixels

```ts
import { getColors, getPalette } from "colorlip";

const colors = getColors(pixelData, width, height, channels);
const palette = getPalette(pixelData, width, height, channels);
```

## Package Entry Points

### `colorlip`

Core API for raw pixel buffers.

### `colorlip/sharp`

Node.js adapter backed by `sharp`. It loads the image, downsizes it, and passes raw pixels to the core.

### `colorlip/canvas`

Browser adapter backed by the Canvas API. It accepts browser image sources, draws them to a canvas, and passes `ImageData` to the core.

## API

### Core

```ts
import {
  aggregateColors,
  colorlip,
  createDominantColor,
  extractFallbackPalette,
  getColors,
  getHueCategory,
  getPalette,
  rgbToHex,
  rgbToHsl,
} from "colorlip";
```

#### `getColors(data, width, height, channels, options?)`

Extract dominant colors from raw pixel data.

- `data`: `Uint8Array | Uint8ClampedArray`
- `width`: image width
- `height`: image height
- `channels`: typically `3` or `4`

Returns `ColorlipColor[]`.

#### `getPalette(data, width, height, channels, options?)`

Extract a structured palette from raw pixel data.

Returns:

```ts
interface ColorlipPalette {
  dominant: ColorlipColor | null;
  accent: ColorlipColor | null;
  swatches: ColorlipColor[];
}
```

#### `colorlip(...)`

Compatibility alias of `getColors(...)`.

### Node.js Adapter

```ts
import {
  colorlip,
  colorlipFromBuffer,
  colorlipFromFile,
  getColors,
  getColorsFromPixels,
  getPalette,
  getPaletteFromPixels,
} from "colorlip/sharp";
```

#### `getColors(source, options?)`

- `source`: `string | Buffer | Uint8Array`

Loads an image through `sharp` and returns `Promise<ColorlipColor[]>`.

#### `getPalette(source, options?)`

- `source`: `string | Buffer | Uint8Array`

Loads an image through `sharp` and returns `Promise<ColorlipPalette>`.

#### `getColorsFromPixels(...)`

Re-export of the raw-pixel core API.

#### `getPaletteFromPixels(...)`

Re-export of the raw-pixel core palette API.

#### Legacy aliases

- `colorlipFromFile(...)`
- `colorlipFromBuffer(...)`

### Browser Adapter

```ts
import {
  colorlip,
  colorlipFromImage,
  colorlipFromImageData,
  getColors,
  getColorsFromImageData,
  getColorsFromPixels,
  getPalette,
  getPaletteFromImageData,
  getPaletteFromPixels,
} from "colorlip/canvas";
```

#### `getColors(source, options?)`

- `source`: `HTMLImageElement | ImageBitmap | Blob | string`

Returns `Promise<ColorlipColor[]>`.

#### `getPalette(source, options?)`

- `source`: `HTMLImageElement | ImageBitmap | Blob | string`

Returns `Promise<ColorlipPalette>`.

#### `getColorsFromImageData(imageData, options?)`

Extract colors directly from `ImageData`.

#### `getPaletteFromImageData(imageData, options?)`

Extract a palette directly from `ImageData`.

#### `getColorsFromPixels(...)`

Re-export of the raw-pixel core API.

#### `getPaletteFromPixels(...)`

Re-export of the raw-pixel core palette API.

#### Legacy aliases

- `colorlipFromImage(...)`
- `colorlipFromImageData(...)`

## Options

```ts
interface ExtractOptions {
  numColors?: number;           // default: 3
  saturationThreshold?: number; // default: 0.15
  brightnessMin?: number;       // default: 20
  brightnessMax?: number;       // default: 235
  quantizationStep?: number;    // default: 12
}
```

Default values:

```ts
{
  numColors: 3,
  saturationThreshold: 0.15,
  brightnessMin: 20,
  brightnessMax: 235,
  quantizationStep: 12,
}
```

## Output

Each extracted color is returned as a `ColorlipColor`:

```ts
interface ColorlipColor {
  r: number;
  g: number;
  b: number;
  hex: string;
  percentage: number;
  hue: number;
  saturation: number;
  lightness: number;
  hueCategory: HueCategory;
  lab: { L: number; a: number; b: number };
  lch: { L: number; C: number; H: number };
  oklab: { L: number; a: number; b: number };
  oklch: { L: number; C: number; H: number };
  css: {
    rgb: string;
    hsl: string;
    lab: string;
    lch: string;
    oklab: string;
    oklch: string;
  };
}
```

Example:

```ts
{
  r: 42,
  g: 98,
  b: 168,
  hex: "#2A62A8",
  percentage: 0.34,
  hue: 213,
  saturation: 60,
  lightness: 41,
  hueCategory: "blue",
  lab: { L: 41.2, a: -2.3, b: -40.1 },
  lch: { L: 41.2, C: 40.2, H: 266.7 },
  oklab: { L: 0.49, a: -0.03, b: -0.12 },
  oklch: { L: 0.49, C: 0.12, H: 256.7 },
  css: {
    rgb: "rgb(42 98 168)",
    hsl: "hsl(213 60% 41%)",
    lab: "lab(41.2 -2.3 -40.1)",
    lch: "lch(41.2 40.2 266.7)",
    oklab: "oklab(0.49 -0.03 -0.12)",
    oklch: "oklch(0.49 0.12 256.7)",
  },
}
```

## Utility Functions

```ts
import {
  aggregateColors,
  createDominantColor,
  getHueCategory,
  rgbToHex,
  rgbToHsl,
} from "colorlip";
```

| Function | Description |
| --- | --- |
| `rgbToHex(r, g, b)` | Convert RGB to `#RRGGBB` |
| `rgbToHsl(r, g, b)` | Convert RGB to `{ h, s, l }` |
| `getHueCategory(hue)` | Convert hue to `"red" \| "orange" \| ... \| "gray"` |
| `createDominantColor(r, g, b, percentage)` | Build a full `ColorlipColor` |
| `aggregateColors(colorSets, numColors?)` | Merge multiple extraction results into top colors |
| `extractFallbackPalette(...)` | Run the simplified fallback extractor directly |

## How It Works

The extraction pipeline is:

1. Adapter input is resized to a maximum of `150x150` pixels. Raw-pixel core calls skip this step.
2. A sampling pass estimates median saturation, saturation spread, and how centrally edges are concentrated.
3. Pixels with `alpha < 0.5` are ignored. Remaining pixels are included with alpha-based weighting.
4. Pixels are filtered by adaptive saturation floor and configured brightness range.
5. Surviving pixels are quantized into bins and weighted by center bias, edge strength, saturation, and alpha.
6. Nearby bins are pre-merged in Lab space using an adaptive Delta E threshold.
7. Clusters are scored using weight, saturation, spatial distribution, center/border bias, and accent preference in OKLCH space.
8. Final swatches are selected with another adaptive Delta E merge pass.
9. `dominant` is the top swatch. `accent` is chosen from perceptually distant candidates or swatches.
10. If the main path produces no candidates, a simpler histogram-based fallback extractor is used.

## Alpha Handling

When the input has an alpha channel:

- Pixels with `alpha < 128` are ignored
- Pixels with `alpha >= 128` are kept
- Their contribution is weighted by `(alpha / 255) ** 2`

This reduces semi-transparent edge noise while still allowing partially visible colors to contribute.

## Notes

- The core accepts both `Uint8Array` and `Uint8ClampedArray`
- `channels` is expected to be `3` or `4`
- Browser string sources are fetched with `fetch(...)`
- Browser adapter resizing happens through `OffscreenCanvas`
- Grayscale or heavily filtered inputs may fall back to the simpler histogram path

## Compatibility Aliases

These names remain available for compatibility:

- `DominantColor` as a type alias of `ColorlipColor`
- `colorlip(...)`
- `colorlipFromFile(...)`
- `colorlipFromBuffer(...)`
- `colorlipFromImage(...)`
- `colorlipFromImageData(...)`

## License

[MIT](./LICENSE)
