"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RatingLevel, RatingsPayload } from "@/lib/ratings";
import { DIMENSION_CONFIG, LEVEL_LABELS } from "@/lib/ratings";

const STORAGE_KEY = "comment-sakusei:lastComment";

const LEVELS: RatingLevel[] = ["good", "average", "attention"];

export default function Home() {
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null]);
  const [ratings, setRatings] = useState<Partial<RatingsPayload>>({});
  const [generated, setGenerated] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setGenerated(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (generated) sessionStorage.setItem(STORAGE_KEY, generated);
    } catch {
      /* ignore */
    }
  }, [generated]);

  const photoCount = useMemo(
    () => photos.filter((p) => p !== null).length,
    [photos],
  );

  const ratingsComplete = useMemo(
    () => DIMENSION_CONFIG.every(({ key }) => ratings[key] !== undefined),
    [ratings],
  );

  const canSubmit = photoCount >= 1 && ratingsComplete;

  function setPhotoAt(index: number, file: File | null) {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }

  async function onGenerate() {
    setError(null);
    setCopied(false);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("ratings", JSON.stringify(ratings as RatingsPayload));
      photos.forEach((file, i) => {
        if (file) fd.append(`photo_${i}`, file);
      });
      const res = await fetch("/api/generate", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました。");
        return;
      }
      if (!data.text) {
        setError("本文が返りませんでした。");
        return;
      }
      setGenerated(data.text);
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください。");
    } finally {
      setLoading(false);
    }
  }

  const copyAll = useCallback(async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        "自動コピーに失敗しました。下の欄をタップして全文選択し、コピーしてください。",
      );
    }
  }, [generated]);

  function selectAllText() {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }

  return (
    <div className="min-h-full bg-zinc-100 text-zinc-900">
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-8 pb-28">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            保護者向けコメント作成
          </h1>
          <p className="text-sm leading-relaxed text-zinc-600">
            写真と評価から、名前を含まない汎用コメントを作成します。生成後は「全文コピー」から基幹システムに貼り付けてください。
          </p>
        </header>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80">
          <h2 className="text-sm font-medium text-zinc-800">授業の写真（最大3枚）</h2>
          <p className="text-xs text-zinc-500">
            1枚以上必要です。iPad ではカメラが開きます。
          </p>
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <label
                key={i}
                className="flex cursor-pointer flex-col gap-1 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-3 py-3 transition hover:border-zinc-400"
              >
                <span className="text-sm font-medium text-zinc-700">
                  写真 {i + 1}
                  {photos[i] ? (
                    <span className="ml-2 font-normal text-zinc-500">
                      （{photos[i]!.name}）
                    </span>
                  ) : null}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  capture="environment"
                  className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:text-white"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setPhotoAt(i, f);
                  }}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80">
          <h2 className="text-sm font-medium text-zinc-800">授業評価（英語）</h2>
          {DIMENSION_CONFIG.map(({ key, label }) => (
            <fieldset key={key} className="space-y-2 rounded-xl bg-zinc-50/80 px-3 py-3">
              <legend className="text-sm font-medium text-zinc-700">{label}</legend>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((lvl) => (
                  <label
                    key={lvl}
                    className={`flex min-h-12 min-w-[5.5rem] cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-medium transition ${
                      ratings[key] === lvl
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name={key}
                      className="sr-only"
                      checked={ratings[key] === lvl}
                      onChange={() =>
                        setRatings((prev) => ({ ...prev, [key]: lvl }))
                      }
                    />
                    {LEVEL_LABELS[lvl]}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </section>

        {error ? (
          <p
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={!canSubmit || loading}
            onClick={onGenerate}
            className="min-h-14 rounded-2xl bg-zinc-900 text-lg font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {loading ? "作成中…" : "コメントを作成"}
          </button>
          {!canSubmit ? (
            <p className="text-center text-xs text-zinc-500">
              {!photoCount ? "写真を1枚以上選んでください。" : null}
              {photoCount && !ratingsComplete
                ? "4項目すべて評価を選んでください。"
                : null}
            </p>
          ) : null}
        </div>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-zinc-800">生成結果</h2>
            <button
              type="button"
              disabled={!generated}
              onClick={copyAll}
              className="min-h-12 min-w-[10rem] rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              {copied ? "コピーしました" : "全文コピー"}
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            欄をタップすると全文選択されます。コピーできないときは長押しメニューからコピーしてください。
          </p>
          <textarea
            ref={textareaRef}
            readOnly
            value={generated}
            placeholder="「コメントを作成」を押すとここに表示されます。"
            onFocus={selectAllText}
            onClick={selectAllText}
            rows={12}
            className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-3 text-base leading-relaxed text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-300"
          />
        </section>
      </main>
    </div>
  );
}
