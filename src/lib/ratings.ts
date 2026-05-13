export type RatingLevel = "good" | "average" | "attention";

export interface RatingsPayload {
  concentration: RatingLevel;
  grammar: RatingLevel;
  vocabulary: RatingLevel;
  composition: RatingLevel;
}

export const DIMENSION_CONFIG = [
  { key: "concentration", label: "集中度" },
  { key: "grammar", label: "文法理解度" },
  { key: "vocabulary", label: "語彙暗記" },
  { key: "composition", label: "英作文" },
] as const;

export type DimensionKey = (typeof DIMENSION_CONFIG)[number]["key"];

export const LEVEL_LABELS: Record<RatingLevel, string> = {
  good: "良い",
  average: "普通",
  attention: "要注意",
};

const LEVEL_SET = new Set<RatingLevel>(["good", "average", "attention"]);

export function isRatingLevel(v: unknown): v is RatingLevel {
  return typeof v === "string" && LEVEL_SET.has(v as RatingLevel);
}

export function parseRatingsPayload(raw: unknown): RatingsPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const keys: DimensionKey[] = [
    "concentration",
    "grammar",
    "vocabulary",
    "composition",
  ];
  const out: Partial<RatingsPayload> = {};
  for (const k of keys) {
    const v = o[k];
    if (!isRatingLevel(v)) return null;
    out[k] = v;
  }
  return out as RatingsPayload;
}
