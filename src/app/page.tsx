"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DimensionKey,
  RatingLevel,
  RatingsPayload,
  SubjectId,
} from "@/lib/ratings";
import {
  DIMENSION_KEYS,
  SUBJECT_IDS,
  SUBJECT_LABELS,
  LEVEL_LABELS,
  dimensionEntries,
} from "@/lib/ratings";

const STORAGE_KEY = "comment-sakusei:lastComment";

const LEVELS: RatingLevel[] = ["good", "average", "attention"];

const emptyRatings = (): Partial<Record<DimensionKey, RatingLevel>> => ({
  d1: undefined,
  d2: undefined,
  d3: undefined,
  d4: undefined,
});

export default function Home() {
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null]);
  const [subject, setSubject] = useState<SubjectId | null>(null);
  const [ratings, setRatings] =
    useState<Partial<Record<DimensionKey, RatingLevel>>>(emptyRatings);
  const [generated, setGenerated] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return sessionStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      if (generated) sessionStorage.setItem(STORAGE_KEY, generated);
    } catch {
      /* ignore */
    }
  }, [generated]);

  const thumbUrls = useMemo(
    () => photos.map((p) => (p ? URL.createObjectURL(p) : null)),
    [photos],
  );

  useEffect(() => {
    return () => {
      thumbUrls.forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, [thumbUrls]);

  const photoCount = useMemo(
    () => photos.filter((p) => p !== null).length,
    [photos],
  );

  const ratingsComplete = useMemo(() => {
    if (!subject) return false;
    return DIMENSION_KEYS.every((k) => ratings[k] !== undefined);
  }, [subject, ratings]);

  const canSubmit = photoCount >= 1 && ratingsComplete && subject !== null;

  function setPhotoAt(index: number, file: File | null) {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }

  function onSubjectChange(next: SubjectId) {
    setSubject(next);
    setRatings(emptyRatings());
  }

  async function onGenerate() {
    if (!subject) return;
    setError(null);
    setCopied(false);
    setLoading(true);
    try {
      const payload: RatingsPayload = {
        subject,
        d1: ratings.d1!,
        d2: ratings.d2!,
        d3: ratings.d3!,
        d4: ratings.d4!,
      };
      const fd = new FormData();
      fd.append("ratings", JSON.stringify(payload));
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

  const dimList = subject ? dimensionEntries(subject) : [];

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
          <h2 className="text-sm font-medium text-zinc-800">
            授業の写真（最大3枚）
          </h2>
          <p className="text-xs text-zinc-500">
            1枚以上必要です。並んだ枠では縮小プレビューです。縦写真も高さが揃います。
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex min-w-0 flex-col gap-1.5">
                <label className="relative aspect-square w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm">
                  {thumbUrls[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- blob: preview
                    <img
                      src={thumbUrls[i]!}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-[11px] text-zinc-400">
                      写真{i + 1}
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    capture="environment"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setPhotoAt(i, f);
                    }}
                  />
                </label>
                {photos[i] ? (
                  <p className="truncate px-0.5 text-[10px] leading-tight text-zinc-500">
                    {photos[i]!.name}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-zinc-800">
              教科（{SUBJECT_IDS.length}教科）
            </h2>
            <p className="text-[11px] leading-snug text-zinc-500">
              {SUBJECT_IDS.map((id) => SUBJECT_LABELS[id]).join("・")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUBJECT_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSubjectChange(id)}
                className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                  subject === id
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
                }`}
              >
                {SUBJECT_LABELS[id]}
              </button>
            ))}
          </div>

          {!subject ? (
            <p className="text-xs text-zinc-500">教科を選ぶと評価項目が表示されます。</p>
          ) : (
            dimList.map(({ key, label }) => (
              <fieldset
                key={key}
                className="space-y-2 rounded-xl bg-zinc-50/80 px-3 py-3"
              >
                <legend className="text-sm font-medium text-zinc-700">
                  {label}
                </legend>
                <div className="flex flex-wrap gap-1">
                  {LEVELS.map((lvl) => (
                    <label
                      key={lvl}
                      className={`flex min-h-8 cursor-pointer items-center justify-center rounded-md border px-2 py-1 text-[11px] font-medium transition ${
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
            ))
          )}
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
              {photoCount && !subject ? "教科を選んでください。" : null}
              {photoCount && subject && !ratingsComplete
                ? "評価4項目すべてを選んでください。"
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
            rows={10}
            className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-3 text-base leading-relaxed text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-300"
          />
        </section>
      </main>
    </div>
  );
}
