import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildUserPrompt,
  PARENT_COMMENT_SYSTEM_PROMPT,
} from "@/lib/parent-comment-prompt";
import { parseRatingsPayload } from "@/lib/ratings";

export const maxDuration = 60;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES_PER_IMAGE = 5 * 1024 * 1024;
const MAX_IMAGES = 3;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelId = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY が設定されていません。.env.local を確認してください。",
      },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "フォームデータの読み取りに失敗しました。" },
      { status: 400 },
    );
  }

  const ratingsRaw = formData.get("ratings");
  if (typeof ratingsRaw !== "string") {
    return NextResponse.json({ error: "ratings が不正です。" }, { status: 400 });
  }

  let ratingsJson: unknown;
  try {
    ratingsJson = JSON.parse(ratingsRaw) as unknown;
  } catch {
    return NextResponse.json({ error: "ratings の JSON が不正です。" }, { status: 400 });
  }

  const ratings = parseRatingsPayload(ratingsJson);
  if (!ratings) {
    return NextResponse.json(
      {
        error:
          "評価の内容が不正です。教科と4項目すべてを選んでください。",
      },
      { status: 400 },
    );
  }

  const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];

  for (let i = 0; i < MAX_IMAGES; i++) {
    const field = formData.get(`photo_${i}`);
    if (field === null || field === "") continue;
    if (!(field instanceof File) || field.size === 0) {
      return NextResponse.json(
        { error: `写真 ${i + 1} の形式が不正です。` },
        { status: 400 },
      );
    }
    if (field.size > MAX_BYTES_PER_IMAGE) {
      return NextResponse.json(
        {
          error: `写真は1枚あたり最大 ${MAX_BYTES_PER_IMAGE / (1024 * 1024)}MB までです。`,
        },
        { status: 400 },
      );
    }
    const mimeType = field.type || "image/jpeg";
    if (!ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: "対応している画像形式は JPEG / PNG / WebP / GIF です。" },
        { status: 400 },
      );
    }
    const buf = Buffer.from(await field.arrayBuffer());
    imageParts.push({
      inlineData: {
        mimeType,
        data: buf.toString("base64"),
      },
    });
  }

  if (imageParts.length === 0) {
    return NextResponse.json(
      { error: "写真を1枚以上アップロードしてください（最大3枚）。" },
      { status: 400 },
    );
  }

  const userText = buildUserPrompt(ratings, imageParts.length);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: {
        role: "system",
        parts: [{ text: PARENT_COMMENT_SYSTEM_PROMPT }],
      },
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: userText }, ...imageParts],
        },
      ],
      generationConfig: {
        /** 短文でもマルチモーダルで MAX_TOKENS 切れしやすいため余裕を持つ（プロンプトで字数を抑制） */
        maxOutputTokens: 4096,
        temperature: 0.62,
      },
    });

    const text = result.response.text()?.trim();
    if (!text) {
      return NextResponse.json(
        { error: "モデルから本文が返りませんでした。もう一度お試しください。" },
        { status: 502 },
      );
    }

    return NextResponse.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `生成に失敗しました: ${message}` },
      { status: 502 },
    );
  }
}
