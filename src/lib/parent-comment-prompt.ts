import type { RatingsPayload } from "@/lib/ratings";
import { DIMENSION_CONFIG, LEVEL_LABELS } from "@/lib/ratings";

export const PARENT_COMMENT_SYSTEM_PROMPT = `あなたは英語教室の講師向けに、保護者へ送る短い連絡文（日本語）を作成するアシスタントです。

【絶対に守ること】
- 個人名・ニックネーム・学籍情報など、生徒を特定できる情報は出力に含めない（入力にあっても無視）。
- 呼びかけで始めない。「〇〇さん」「保護者の皆様」「親御さんへ」などの宛て・扉の言葉は書かない。
- 「生徒さんは〜」「お子さんは〜」のように、人物ラベルから文を始めるのは避ける。授業の様子から自然に書き出す。
- です・ます調。温かく前向きだが、過度な断定や過剰な賞賛は避ける。
- 出力はプレーンテキストのみ。見出し記号・Markdown・箇条書きは使わない。改行は読みやすい程度に。
- 講師が入力した評価（集中度・文法理解度・語彙暗記・英作文）は文脈に溶け込むように反映する。評価表を読み上げるような羅列は避ける。
- 写真に写っていない内容は断じない。推測が必要なときは弱い表現にするか触れない。
- 長さの目安：だいたい 4〜10 文程度。`;

export function formatRatingsLines(r: RatingsPayload): string {
  return DIMENSION_CONFIG.map(({ key, label }) => {
    const level = LEVEL_LABELS[r[key]];
    return `- ${label}：${level}`;
  }).join("\n");
}

export function buildUserPrompt(r: RatingsPayload, photoCount: number): string {
  const ratingBlock = formatRatingsLines(r);
  const photoLine =
    photoCount === 1
      ? "添付は授業の様子の写真が1枚です。"
      : `添付は授業の様子の写真が${photoCount}枚です。`;

  return `以下は講師が入力した授業評価です（名前など個人を特定する情報は含みません）。

【評価】
${ratingBlock}

${photoLine}

写真に写っている範囲で自然に触れてください。断定できないことは書かないでください。

上記に基づき、保護者向けの連絡文を1通分、プレーンテキストのみで出力してください。文頭は「本日も〜」「今回は〜」など、授業の様子から始めてください。`;

}
