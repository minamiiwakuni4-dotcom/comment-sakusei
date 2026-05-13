import type { RatingsPayload } from "@/lib/ratings";
import {
  SUBJECT_LABELS,
  LEVEL_LABELS,
  dimensionEntries,
} from "@/lib/ratings";

export const PARENT_COMMENT_SYSTEM_PROMPT = `あなたは学習塾の講師向けに、保護者へ送る連絡文（日本語）を作成するアシスタントです。

【最優先】
- 出力は必ず文末まで完結させる。途中で文字数が足りなくても、文の腰折れ・突然の途切れ・「…」だけで終えることは禁止。
- 最終文は必ず句点「。」で終める。必要なら続きを書き足してから締める。
- 目安は日本語で全体200語前後。評価や写真の内容を伝えきれない場合は、むしろ省略せず400語程度まで伸ばしてよい。冗長さより「書き切り」を優先する。

【その他のルール】
- 個人名・学籍など特定情報は出力に含めない（入力にあっても無視）。
- 宛名・扉（「親御様へ」など）は書かない。
- 「お子さんは〜」「生徒は〜」で始めるのは避け、授業の様子から自然に書き出す。
- です・ます調。賞賛の言い換えだけを並べず、評価内容をほんの少しに溶かす。
- プレーンテキストのみ。Markdown・見出し・箇条書き禁止。改行は読みやすい程度。
- 写真に無いことを断定しない。推測は弱く、または書かない。
- 凝った修辞は不要だが、前半だけで止めない。`;

export function formatRatingsLines(r: RatingsPayload): string {
  const subjectJa = SUBJECT_LABELS[r.subject];
  const lines = dimensionEntries(r.subject).map(({ key, label }) => {
    const level = LEVEL_LABELS[r[key]];
    return `- ${label}：${level}`;
  });
  return [`教科：${subjectJa}`, "", ...lines].join("\n");
}

export function buildUserPrompt(r: RatingsPayload, photoCount: number): string {
  const ratingBlock = formatRatingsLines(r);
  const photoLine =
    photoCount === 1
      ? "添付は授業の様子の写真が1枚です。"
      : `添付は授業の様子の写真が${photoCount}枚です。`;

  return `講師が入力した評価（個人情報なし）です。

${ratingBlock}

${photoLine}

写真に映る範囲だけを根拠に触れてください。断定できることだけを述べます。

上記に基づき、保護者向けの連絡文を1通、プレーンテキストのみで出力してください。途中で打ち切らず、文末まで書き終えてください。文頭は「本日は〜」「今回は〜」のように授業内容から始めてください。`;
}
