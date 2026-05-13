export type RatingLevel = "good" | "average" | "attention";

export type SubjectId = "math" | "japanese" | "science" | "social";

export const SUBJECT_IDS: SubjectId[] = [
  "math",
  "japanese",
  "science",
  "social",
];

export const SUBJECT_LABELS: Record<SubjectId, string> = {
  math: "数学",
  japanese: "国語",
  science: "理科",
  social: "社会",
};

/** 教科ごとの評価4項目ラベル */
export const DIMENSIONS_BY_SUBJECT: Record<
  SubjectId,
  readonly [string, string, string, string]
> = {
  math: ["集中度", "計算・手順", "概念の理解", "応用力"],
  japanese: ["集中度", "読解", "語彙・表現", "作文・記述"],
  science: ["集中度", "観察・実験", "概念の理解", "説明のしかた"],
  social: ["集中度", "資料の読み取り", "概念の理解", "記述・まとめ"],
};

export const DIMENSION_KEYS = ["d1", "d2", "d3", "d4"] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export interface RatingsPayload {
  subject: SubjectId;
  d1: RatingLevel;
  d2: RatingLevel;
  d3: RatingLevel;
  d4: RatingLevel;
}

export const LEVEL_LABELS: Record<RatingLevel, string> = {
  good: "良い",
  average: "普通",
  attention: "要注意",
};

const LEVEL_SET = new Set<RatingLevel>(["good", "average", "attention"]);
const SUBJECT_SET = new Set<SubjectId>(SUBJECT_IDS);

export function isRatingLevel(v: unknown): v is RatingLevel {
  return typeof v === "string" && LEVEL_SET.has(v as RatingLevel);
}

export function isSubjectId(v: unknown): v is SubjectId {
  return typeof v === "string" && SUBJECT_SET.has(v as SubjectId);
}

export function parseRatingsPayload(raw: unknown): RatingsPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isSubjectId(o.subject)) return null;
  for (const k of DIMENSION_KEYS) {
    if (!isRatingLevel(o[k])) return null;
  }
  return {
    subject: o.subject,
    d1: o.d1 as RatingLevel,
    d2: o.d2 as RatingLevel,
    d3: o.d3 as RatingLevel,
    d4: o.d4 as RatingLevel,
  };
}

export function dimensionEntries(
  subject: SubjectId,
): { key: DimensionKey; label: string }[] {
  const labels = DIMENSIONS_BY_SUBJECT[subject];
  return DIMENSION_KEYS.map((key, i) => ({ key, label: labels[i]! }));
}
