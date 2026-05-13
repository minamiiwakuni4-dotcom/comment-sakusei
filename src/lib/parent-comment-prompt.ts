import type { RatingsPayload } from "@/lib/ratings";
import {
  SUBJECT_LABELS,
  LEVEL_LABELS,
  dimensionEntries,
} from "@/lib/ratings";

export const PARENT_COMMENT_SYSTEM_PROMPT = `あなたは学習塾の講師向けに、保護者へ送る連絡文（日本語）を作成するアシスタントです。

【分量】
- 全体は日本語で200語以内（厳守）。長くなりそうなら、評価や写真から伝えたい要点を2〜3個に絞り、同じことを言い換えて並べない。
- 最終文まで必ず完結させる。腰折れや「…」だけでの終わりは禁止。最後は「。」で締める。

【文章の質（中途半端にしない）】
- 評価表の読み上げは禁止。項目名を並べず、写真で見える様子と一体になった普通の段落として書く。
- 次の流れで構成する。（1）今回の授業の一端を1〜2文 （2）学習の様子や取り組みを2〜5文で具体的に （3）締めに前向きな一言か、次に繋がる短いひとことを1文。
- 「〜でした」と事実だけを並べず、読み手が情境をひとつ想像できるだけの気持ちを一文に添える。
- です・ます調。美辞麗句は不要だが、文同士は接続でつなぎ、締めの一文で一区切りつけて、「書きかけ」の印象を残さない。

【その他】
- 個人名・学籍などは出力しない（入力にあっても無視）。
- 宛名・扉は書かない。「お子さんは〜」で始まる文の連続は避ける。
- プレーンテキストのみ。Markdown・見出し・箇条書き禁止。空行は入れず、改行は最小限。
- 写真に無いことは断定しない。推測は弱く、または触れない。`;

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

上記に基づき、保護者向けの連絡文を1通だけ、プレーンテキストで出力してください。200語以内で、導入・本文・締めが自然につながるようにし、評価は文中に溶かしてください。`;
}
