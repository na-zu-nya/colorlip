import path from "node:path";
import { describe, expect, it } from "vitest";
import { colorlipFromBuffer, colorlipFromFile, getColors, getPalette } from "../adapters/sharp";

const SAMPLES_DIR = path.resolve(import.meta.dirname, "../../samples");

describe("colorlipFromFile", () => {
  it("JPEG 画像から代表色を抽出できる", async () => {
    const result = await colorlipFromFile(path.join(SAMPLES_DIR, "photo1.jpg"));
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(3);

    for (const color of result) {
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(255);
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(color.percentage).toBeGreaterThan(0);
    }
  });

  it("PNG 画像から代表色を抽出できる", async () => {
    const result = await colorlipFromFile(path.join(SAMPLES_DIR, "illust1.png"));
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("getColors でファイルパスとバッファを同じ関数名で扱える", async () => {
    const fs = await import("node:fs");
    const filePath = path.join(SAMPLES_DIR, "photo1.jpg");
    const fromPath = await getColors(filePath);
    const fromBuffer = await getColors(fs.readFileSync(filePath));
    expect(fromPath.length).toBeGreaterThanOrEqual(1);
    expect(fromBuffer.length).toBeGreaterThanOrEqual(1);
  });

  it("getPalette で dominant / accent / swatches を返せる", async () => {
    const palette = await getPalette(path.join(SAMPLES_DIR, "photo6.jpg"));
    expect(palette.dominant).toBeTruthy();
    expect(palette.swatches.length).toBeGreaterThanOrEqual(1);
    if (palette.accent) {
      expect(palette.accent.hex).not.toBe(palette.dominant?.hex);
    }
  });

  it("numColors オプションで抽出数を制御できる", async () => {
    const result = await colorlipFromFile(path.join(SAMPLES_DIR, "photo1.jpg"), {
      numColors: 5,
    });
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("複数のサンプル画像で一貫した結果を返す", async () => {
    const files = [
      "photo1.jpg",
      "photo2.jpg",
      "photo3.jpg",
      "photo5.jpg",
      "photo6.jpg",
      "photo7.jpg",
      "mari1.jpg",
    ];
    for (const file of files) {
      const result = await colorlipFromFile(path.join(SAMPLES_DIR, file));
      expect(result.length).toBeGreaterThanOrEqual(1);
      for (const color of result) {
        expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
        expect(color.hueCategory).toBeTruthy();
      }
    }
  });
});

describe("colorlipFromBuffer", () => {
  it("バッファから代表色を抽出できる", async () => {
    const fs = await import("node:fs");
    const buffer = fs.readFileSync(path.join(SAMPLES_DIR, "photo1.jpg"));
    const result = await colorlipFromBuffer(buffer);
    expect(result.length).toBeGreaterThanOrEqual(1);

    for (const color of result) {
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
