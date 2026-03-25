import type { Lab } from "./types";

export interface QuantizedColorBin {
  weight: number;
  sumR: number;
  sumG: number;
  sumB: number;
  sumX: number;
  sumY: number;
  sumX2: number;
  sumY2: number;
  borderCount: number;
  centerCount: number;
  count: number;
}

export interface ClusteredColorBin extends QuantizedColorBin {
  r: number;
  g: number;
  b: number;
  lab: Lab;
  saturation: number;
}

export interface ScoredColorEntry {
  r: number;
  g: number;
  b: number;
  lab: Lab;
  score: number;
  weight: number;
  accentPreference: number;
}

export interface MergeThresholds {
  preMergeDeltaE: number;
  finalMergeDeltaE: number;
}
