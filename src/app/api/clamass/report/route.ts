import { NextResponse } from "next/server";

/**
 * （任意）GAS の doPost へ中継。ClaMas UI からは現在呼ばれていません。
 * `CLAMASS_REPORT_WEBHOOK_URL` をセットすると POST を転送。未設定時はデモ応答。
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const url = process.env.CLAMASS_REPORT_WEBHOOK_URL?.trim();
  if (url) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      try {
        return NextResponse.json(JSON.parse(text) as object, {
          status: res.status,
        });
      } catch {
        return NextResponse.json(
          { error: "中継先が JSON 以外を返しました", detail: text.slice(0, 200) },
          { status: 502 },
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "不明なエラー";
      return NextResponse.json(
        { error: `中継に失敗: ${msg}` },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ result: "ok", demo: true });
}
