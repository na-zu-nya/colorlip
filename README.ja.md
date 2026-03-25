# colorlip

Node.js とブラウザ向けの高速な代表色抽出ライブラリです。

`colorlip` は、画像から代表色やコンパクトなパレットを抽出するための、軽量で高速な TypeScript ファーストのライブラリです。特にイラスト、アートワーク、商品画像のような「見た目の印象」が大事な画像で、よりしっくりくる色を拾えるように調整しています。日本のイラスト系コミュニティや SNS、ショッピングサイトのようなビジュアル中心の用途でも使いやすいことを意識して設計しています。

コアはピクセルバッファを対象に動作して、ランタイム依存はありません。Node.js では `sharp`、ブラウザでは Canvas API を使うアダプターを利用できます。

[English README](./README.md)

## 特徴

- イラストやアートワークでも扱いやすい、知覚寄りの色抽出
- 画像の傾向に合わせて調整される適応的なパレット抽出
- 近い色を CIELAB Delta E で自然にまとめるマージ処理
- `dominant`、`accent`、`swatches` を返せる扱いやすいパレット API
- `hex`、`HSL`、`Lab`、`LCH`、`OKLab`、`OKLCH`、CSS カラー文字列、色相カテゴリを含む豊富な出力
- 生ピクセルからそのまま使える、プラットフォーム非依存のコア
- `sharp` と Canvas に対応したアダプターを同梱
- コアはランタイム依存なしで軽量

## インストール

コアのみを使う場合:

```bash
npm install colorlip
```

Node.js で `sharp` アダプターを使う場合:

```bash
npm install colorlip sharp
```

`sharp` は optional peer dependency で、`colorlip/sharp` を使う場合のみ必要です。

## クイックスタート

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

### ブラウザ

```ts
import { getColors, getPalette } from "colorlip/canvas";

const colors = await getColors(imgElement);
const palette = await getPalette(imgElement);
```

### 生ピクセル

```ts
import { getColors, getPalette } from "colorlip";

const colors = getColors(pixelData, width, height, channels);
const palette = getPalette(pixelData, width, height, channels);
```

## パッケージのエントリーポイント

### `colorlip`

生ピクセルバッファ向けのコア API です。

### `colorlip/sharp`

`sharp` ベースの Node.js アダプターです。画像を読み込み、縮小し、生ピクセルをコアに渡します。

### `colorlip/canvas`

Canvas API ベースのブラウザ用アダプターです。ブラウザの画像ソースを受け取り、Canvas に描画して `ImageData` をコアに渡します。

## API

### コア

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

生のピクセルデータから代表色を抽出します。

- `data`: `Uint8Array | Uint8ClampedArray`
- `width`: 画像の幅
- `height`: 画像の高さ
- `channels`: 通常は `3` または `4`

戻り値は `ColorlipColor[]` です。

#### `getPalette(data, width, height, channels, options?)`

生のピクセルデータから構造化されたパレットを抽出します。

戻り値:

```ts
interface ColorlipPalette {
  dominant: ColorlipColor | null;
  accent: ColorlipColor | null;
  swatches: ColorlipColor[];
}
```

#### `colorlip(...)`

`getColors(...)` の互換エイリアスです。

### Node.js アダプター

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

`sharp` で画像を読み込み、`Promise<ColorlipColor[]>` を返します。

#### `getPalette(source, options?)`

- `source`: `string | Buffer | Uint8Array`

`sharp` で画像を読み込み、`Promise<ColorlipPalette>` を返します。

#### `getColorsFromPixels(...)`

生ピクセル向けコア API の再エクスポートです。

#### `getPaletteFromPixels(...)`

生ピクセル向けコアのパレット API の再エクスポートです。

#### 互換エイリアス

- `colorlipFromFile(...)`
- `colorlipFromBuffer(...)`

### ブラウザアダプター

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

戻り値は `Promise<ColorlipColor[]>` です。

#### `getPalette(source, options?)`

- `source`: `HTMLImageElement | ImageBitmap | Blob | string`

戻り値は `Promise<ColorlipPalette>` です。

#### `getColorsFromImageData(imageData, options?)`

`ImageData` から直接色を抽出します。

#### `getPaletteFromImageData(imageData, options?)`

`ImageData` から直接パレットを抽出します。

#### `getColorsFromPixels(...)`

生ピクセル向けコア API の再エクスポートです。

#### `getPaletteFromPixels(...)`

生ピクセル向けコアのパレット API の再エクスポートです。

#### 互換エイリアス

- `colorlipFromImage(...)`
- `colorlipFromImageData(...)`

## オプション

```ts
interface ExtractOptions {
  numColors?: number;           // default: 3
  saturationThreshold?: number; // default: 0.15
  brightnessMin?: number;       // default: 20
  brightnessMax?: number;       // default: 235
  quantizationStep?: number;    // default: 12
}
```

デフォルト値:

```ts
{
  numColors: 3,
  saturationThreshold: 0.15,
  brightnessMin: 20,
  brightnessMax: 235,
  quantizationStep: 12,
}
```

## 出力

抽出された各色は `ColorlipColor` として返されます。

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

例:

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

## ユーティリティ関数

```ts
import {
  aggregateColors,
  createDominantColor,
  getHueCategory,
  rgbToHex,
  rgbToHsl,
} from "colorlip";
```

| 関数 | 説明 |
| --- | --- |
| `rgbToHex(r, g, b)` | RGB を `#RRGGBB` に変換 |
| `rgbToHsl(r, g, b)` | RGB を `{ h, s, l }` に変換 |
| `getHueCategory(hue)` | 色相を `"red" \| "orange" \| ... \| "gray"` に変換 |
| `createDominantColor(r, g, b, percentage)` | 完全な `ColorlipColor` を生成 |
| `aggregateColors(colorSets, numColors?)` | 複数の抽出結果を上位色へ集約 |
| `extractFallbackPalette(...)` | 単純なフォールバック抽出器を直接実行 |

## 仕組み

抽出パイプラインは次の流れです。

1. アダプター経由の入力は最大 `150x150` まで縮小されます。生ピクセルのコア API はこの段階を持ちません。
2. サンプリングパスで、中央値彩度、彩度の広がり、エッジがどれだけ中央に集中しているかを推定します。
3. `alpha < 0.5` のピクセルは無視されます。それ以外は alpha ベースの重み付きで扱われます。
4. ピクセルは適応的な彩度下限と設定された明度範囲でフィルタされます。
5. 残ったピクセルは量子化ビンに集約され、中央バイアス、エッジ強度、彩度、alpha に基づいて重み付けされます。
6. 近いビンは Lab 空間で適応的な Delta E 閾値を使って事前マージされます。
7. クラスタは重み、彩度、空間分布、中央/外周バイアス、OKLCH における accent 適性でスコアリングされます。
8. 最終スウォッチは、さらに適応的な Delta E マージを通して選ばれます。
9. `dominant` は最上位スウォッチです。`accent` は知覚的に十分離れた候補またはスウォッチから選ばれます。
10. メイン経路で候補が得られなければ、より単純なヒストグラムベースのフォールバック抽出が使われます。

## Alpha の扱い

入力に alpha チャンネルがある場合:

- `alpha < 128` のピクセルは無視されます
- `alpha >= 128` のピクセルは採用されます
- 寄与度は `(alpha / 255) ** 2` で重み付けされます

これにより、半透明の縁ノイズを抑えつつ、実際に見えている色は抽出に反映できます。

## 補足

- コアは `Uint8Array` と `Uint8ClampedArray` の両方を受け付けます
- `channels` は `3` または `4` を想定しています
- ブラウザで文字列ソースを渡す場合は `fetch(...)` で取得されます
- ブラウザアダプターの縮小処理は `OffscreenCanvas` を使います
- グレースケール画像や強くフィルタされた画像では、単純なフォールバック経路に落ちる場合があります

## 互換エイリアス

以下の名前は互換性のため残っています。

- `DominantColor` は `ColorlipColor` の型エイリアス
- `colorlip(...)`
- `colorlipFromFile(...)`
- `colorlipFromBuffer(...)`
- `colorlipFromImage(...)`
- `colorlipFromImageData(...)`

## ライセンス

[MIT](./LICENSE)
