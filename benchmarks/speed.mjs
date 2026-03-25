import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { getColors } from "../dist/adapters/sharp.js";

const SCRIPT_NAMES = new Set(["try-compare.ts", "try-html.ts", "test.ts"]);
const IMAGE_RE = /\.(jpg|jpeg|png|webp)$/i;
const SAMPLES_DIR = path.resolve(import.meta.dirname, "../samples");

function parseArgs(argv) {
  const args = {
    rounds: 3,
    warmup: 1,
    limit: null,
    seed: 1337,
    include: "",
    jsonOut: "",
  };

  for (const arg of argv) {
    if (arg.startsWith("--rounds=")) {
      args.rounds = Number.parseInt(arg.slice("--rounds=".length), 10);
    } else if (arg.startsWith("--warmup=")) {
      args.warmup = Number.parseInt(arg.slice("--warmup=".length), 10);
    } else if (arg.startsWith("--limit=")) {
      args.limit = Number.parseInt(arg.slice("--limit=".length), 10);
    } else if (arg.startsWith("--seed=")) {
      args.seed = Number.parseInt(arg.slice("--seed=".length), 10);
    } else if (arg.startsWith("--include=")) {
      args.include = arg.slice("--include=".length);
    } else if (arg.startsWith("--json-out=")) {
      args.jsonOut = arg.slice("--json-out=".length);
    }
  }

  if (!Number.isInteger(args.rounds) || args.rounds < 1) {
    throw new Error(`Invalid --rounds value: ${args.rounds}`);
  }
  if (!Number.isInteger(args.warmup) || args.warmup < 0) {
    throw new Error(`Invalid --warmup value: ${args.warmup}`);
  }
  if (args.limit != null && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error(`Invalid --limit value: ${args.limit}`);
  }
  if (!Number.isInteger(args.seed)) {
    throw new Error(`Invalid --seed value: ${args.seed}`);
  }

  return args;
}

function listSampleFiles(include, limit) {
  let files = fs
    .readdirSync(SAMPLES_DIR)
    .filter((file) => IMAGE_RE.test(file) && !SCRIPT_NAMES.has(file))
    .sort();

  if (include) {
    files = files.filter((file) => file.includes(include));
  }
  if (limit != null) {
    files = files.slice(0, limit);
  }
  if (files.length === 0) {
    throw new Error("No sample images matched the current filters");
  }

  return files.map((file) => ({
    file,
    filePath: path.join(SAMPLES_DIR, file),
  }));
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, rng) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function measureMs(fn) {
  const start = performance.now();
  return Promise.resolve(fn()).then((result) => ({
    ms: performance.now() - start,
    result,
  }));
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index] ?? 0;
}

function median(values) {
  return percentile(values, 0.5);
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMs(value) {
  return `${value.toFixed(1)}ms`;
}

function formatRatio(value) {
  return `${value.toFixed(2)}x`;
}

function printTable(rows) {
  const columns = [
    { key: "name", label: "library" },
    { key: "medianMsPerImage", label: "median/img" },
    { key: "meanMsPerImage", label: "mean/img" },
    { key: "p95MsPerImage", label: "p95/img" },
    { key: "minMsPerImage", label: "min/img" },
    { key: "maxMsPerImage", label: "max/img" },
    { key: "vsColorlip", label: "vs colorlip" },
  ];

  const printable = rows.map((row) => ({
    name: row.name,
    medianMsPerImage: formatMs(row.medianMsPerImage),
    meanMsPerImage: formatMs(row.meanMsPerImage),
    p95MsPerImage: formatMs(row.p95MsPerImage),
    minMsPerImage: formatMs(row.minMsPerImage),
    maxMsPerImage: formatMs(row.maxMsPerImage),
    vsColorlip: formatRatio(row.vsColorlip),
  }));

  const widths = Object.fromEntries(
    columns.map(({ key, label }) => [
      key,
      Math.max(label.length, ...printable.map((row) => row[key].length)),
    ]),
  );

  const header = columns
    .map(({ key, label }) => label.padEnd(widths[key]))
    .join("  ");
  const divider = columns.map(({ key }) => "-".repeat(widths[key])).join("  ");

  console.log(header);
  console.log(divider);
  for (const row of printable) {
    console.log(columns.map(({ key }) => row[key].padEnd(widths[key])).join("  "));
  }
}

async function createRunners() {
  const [{ Vibrant }, { getPalette }, { extractColors }, { FastAverageColor }, quantizeModule, getImageColorsModule] =
    await Promise.all([
      import("node-vibrant/node"),
      import("colorthief"),
      import("extract-colors"),
      import("fast-average-color"),
      import("quantize"),
      import("get-image-colors"),
    ]);

  const quantize = quantizeModule.default;
  const getImageColors = getImageColorsModule.default ?? getImageColorsModule;

  return [
    {
      name: "colorlip",
      run: (filePath) => getColors(filePath, { numColors: 6 }),
    },
    {
      name: "node-vibrant",
      run: (filePath) => Vibrant.from(filePath).getPalette(),
    },
    {
      name: "colorthief",
      run: (filePath) => getPalette(filePath, { colorCount: 6 }),
    },
    {
      name: "quantize",
      run: async (filePath) => {
        const { data } = await sharp(filePath)
          .resize(150, 150, { fit: "inside" })
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const pixels = [];
        for (let i = 0; i < data.length; i += 3) {
          pixels.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]);
        }
        const colorMap = quantize(pixels, 6);
        return colorMap ? colorMap.palette() : [];
      },
    },
    {
      name: "extract-colors",
      run: async (filePath) => {
        const { data, info } = await sharp(filePath)
          .resize(150, 150, { fit: "inside" })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const imageData = {
          data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
          width: info.width,
          height: info.height,
        };
        return extractColors(imageData, { pixels: info.width * info.height });
      },
    },
    {
      name: "fast-average-color",
      run: async (filePath) => {
        const { data } = await sharp(filePath)
          .resize(150, 150, { fit: "inside" })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const fac = new FastAverageColor();
        try {
          return fac.getColorFromArray4(
            new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
            { algorithm: "dominant" },
          );
        } finally {
          fac.destroy();
        }
      },
    },
    {
      name: "get-image-colors",
      run: (filePath) => getImageColors(filePath, { count: 6 }),
    },
  ];
}

async function runPass(files, runners, rng, totals) {
  for (const { file, filePath } of shuffled(files, rng)) {
    for (const runner of shuffled(runners, rng)) {
      const { ms } = await measureMs(() => runner.run(filePath));
      totals[runner.name].push(ms);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = listSampleFiles(args.include, args.limit);
  const runners = await createRunners();
  const rng = mulberry32(args.seed);

  const runTotals = Object.fromEntries(runners.map((runner) => [runner.name, []]));

  console.log(
    `\nSpeed benchmark: ${files.length} images, ${runners.length} runners, ${args.warmup} warmup, ${args.rounds} measured rounds`,
  );
  console.log(`Seed: ${args.seed}`);

  for (let round = 0; round < args.warmup; round++) {
    console.log(`\nWarmup ${round + 1}/${args.warmup}`);
    const warmupRound = Object.fromEntries(runners.map((runner) => [runner.name, []]));
    await runPass(files, runners, rng, warmupRound);
  }

  for (let round = 0; round < args.rounds; round++) {
    console.log(`\nRound ${round + 1}/${args.rounds}`);
    const roundValues = Object.fromEntries(runners.map((runner) => [runner.name, []]));
    await runPass(files, runners, rng, roundValues);

    for (const runner of runners) {
      const total = roundValues[runner.name].reduce((sum, value) => sum + value, 0);
      runTotals[runner.name].push(total);
      console.log(`  ${runner.name.padEnd(18)} ${formatMs(total / files.length)} / image`);
    }
  }

  const colorlipMedian = median(runTotals.colorlip) / files.length;
  const summary = runners
    .map((runner) => {
      const totals = runTotals[runner.name];
      return {
        name: runner.name,
        medianMsPerImage: median(totals) / files.length,
        meanMsPerImage: mean(totals) / files.length,
        p95MsPerImage: percentile(totals, 0.95) / files.length,
        minMsPerImage: Math.min(...totals) / files.length,
        maxMsPerImage: Math.max(...totals) / files.length,
        vsColorlip: (median(totals) / files.length) / colorlipMedian,
      };
    })
    .sort((a, b) => a.medianMsPerImage - b.medianMsPerImage);

  console.log("\nSummary");
  printTable(summary);

  if (args.jsonOut) {
    const output = {
      createdAt: new Date().toISOString(),
      config: {
        rounds: args.rounds,
        warmup: args.warmup,
        limit: args.limit,
        include: args.include,
        seed: args.seed,
        fileCount: files.length,
        files: files.map(({ file }) => file),
      },
      summary,
      totalsMsPerRound: runTotals,
    };
    fs.writeFileSync(args.jsonOut, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`\nWrote ${args.jsonOut}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
