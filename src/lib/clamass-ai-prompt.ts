import { PARENT_COMMENT_SYSTEM_PROMPT } from "@/lib/parent-comment-prompt";

/** ClaMas 用: ノート写真（解答のみ想定）＋講師評価を渡すときの追加ルール */
const CLAMASS_PHOTO_NOTE = `
【写真について】
添付は授業中の解答ノートなどの撮影であり、氏名・顔・学籍など個人を特定する情報は写っていない想定とする。万一写っていても出力に含めず、写真から個人を推測して書かない。`;

export function clamassMultimodalSystemPrompt(): string {
  return PARENT_COMMENT_SYSTEM_PROMPT.trim() + CLAMASS_PHOTO_NOTE;
}

/** pack: フロントの「コピー用」と同じテキスト（生徒名なし）。 */
export function buildClamassAiUserPrompt(
  pack: string,
  photoCount: number,
): string {
  const photoLine =
    photoCount === 1
      ? "添付画像は解答ノートの様子が1枚です。"
      : `添付画像は解答ノートの様子が${photoCount}枚です。`;

  return `以下は講師が入力した内容です。生徒名など個人を特定する情報は含みません（含まれていたとしても無視してください）。

${pack}

${photoLine}

写真に映る範囲と、上記の評価・備考を照らし合わせてください。写真にないことは断定しない。

上記に基づき、保護者向けの連絡文を1通、プレーンテキストのみで出力してください。およそ350〜420字を目安に、導入・本文・締めが自然につながり、評価は文中に溶かしてください。文末まで出力し切ってください。`;
}
