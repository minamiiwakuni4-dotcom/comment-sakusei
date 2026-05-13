import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ClaMas Assist",
  description:
    "授業評価コピーと、ノート写真＋評価による保護者コメント生成。成績表 AI 読み取りなし。",
};

export default function ClamassLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
