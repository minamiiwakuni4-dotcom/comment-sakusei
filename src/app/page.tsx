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
    useState<Partial<Record<DimensionKey, RatingLevel>>>(() => emptyRatings());
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

  const copyAll = useCallback(() => {
    const ta = textareaRef.current;
    const text = ta?.value ?? generated;
    if (!text) return;

    function showCopiedFeedback() {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }

    /** iPad / Safari で Clipboard API が失敗しがちなため、ユーザー操作タップ後は同期コピーを先に試す */
    try {
      if (
        ta &&
        typeof document !== "undefined" &&
        typeof document.execCommand === "function"
      ) {
        ta.focus();
        ta.setSelectionRange(0, text.length);
        if (document.execCommand("copy")) {
          ta.setSelectionRange(text.length, text.length);
          setError(null);
          showCopiedFeedback();
          return;
        }
      }
    } catch {
      /* Clipboard API に降りる */
    }

    try {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(text).then(
          () => {
            setError(null);
            showCopiedFeedback();
          },
          () => {
            setError(
              "コピーできませんでした。「全文選択」後、長押しメニューからコピーしてください。",
            );
          },
        );
        return;
      }
    } catch {
      /* 下の共通エラー */
    }

    setError(
      "コピーできませんでした。「全文選択」後、長押しメニューからコピーしてください。",
    );
  }, [generated]);

  function selectAllText() {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }

  const dimList = subject ? dimensionEntries(subject) : [];

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-zinc-100 text-zinc-900">
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-2">
          <main className="flex flex-col gap-2 pb-2">
            <header className="shrink-0">
              <h1 className="text-lg font-semibold leading-tight tracking-tight sm:text-xl">
                保護者向けコメント作成
              </h1>
            </header>

            <section className="space-y-1.5 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-zinc-200/80">
              <h2 className="text-xs font-medium text-zinc-800">
                写真（最大3枚・1枚以上）
              </h2>
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="min-w-0">
                    <label className="relative block h-16 w-full overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
                      {thumbUrls[i] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- blob: preview
                        <img
                          src={thumbUrls[i]!}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-[10px] text-zinc-400">
                          {i + 1}
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
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-1.5 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-zinc-200/80">
              <h2 className="text-xs font-medium text-zinc-800">教科</h2>
              <div className="flex flex-wrap gap-1">
                {SUBJECT_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSubjectChange(id)}
                    className={`rounded border px-1.5 py-0.5 text-[11px] font-medium transition ${
                      subject === id
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
                    }`}
                  >
                    {SUBJECT_LABELS[id]}
                  </button>
                ))}
              </div>

              {subject
                ? dimList.map(({ key, label }) => (
                    <fieldset
                      key={key}
                      className="space-y-1 rounded-lg bg-zinc-50/80 px-2 py-1.5"
                    >
                      <legend className="text-[11px] font-medium text-zinc-700">
                        {label}
                      </legend>
                      <div className="flex flex-wrap gap-0.5">
                        {LEVELS.map((lvl) => (
                          <label
                            key={lvl}
                            className={`flex min-h-7 cursor-pointer items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none transition ${
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
                : null}
            </section>

            {error ? (
              <p
                className="shrink-0 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] leading-snug text-red-800 ring-1 ring-red-200"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="shrink-0 flex flex-col gap-1">
              <button
                type="button"
                disabled={!canSubmit || loading}
                onClick={onGenerate}
                className="min-h-10 rounded-xl bg-zinc-900 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
              >
                {loading ? "作成中…" : "コメントを作成"}
              </button>
              {!canSubmit ? (
                <p className="text-center text-[10px] leading-tight text-zinc-500">
                  {!photoCount ? "写真を1枚以上。" : null}
                  {photoCount && !subject ? "教科を選択。" : null}
                  {photoCount && subject && !ratingsComplete
                    ? "評価4項目をすべて。"
                    : null}
                </p>
              ) : null}
            </div>
          </main>
        </div>

        <section className="flex h-[min(42dvh,22rem)] min-h-[9.5rem] shrink-0 flex-col gap-1 border-t border-zinc-200/80 bg-zinc-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-1">
            <h2 className="text-xs font-medium text-zinc-800">生成結果</h2>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              <button
                type="button"
                disabled={!generated}
                onClick={selectAllText}
                className="min-h-8 rounded-lg border border-zinc-300 bg-white px-2 text-[11px] font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                全文選択
              </button>
              <button
                type="button"
                disabled={!generated}
                onClick={copyAll}
                className="min-h-8 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                {copied ? "コピー済" : "全文コピー"}
              </button>
            </div>
          </div>
          <p className="text-[10px] leading-tight text-zinc-500">
            編集して加筆・削除もできます。その内容がコピーと再表示に使われます。
          </p>
          <textarea
            ref={textareaRef}
            value={generated}
            placeholder="「コメントを作成」後、ここに表示されます。そのまま手直ししてください。"
            onChange={(e) => setGenerated(e.target.value)}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="sentences"
            className="min-h-0 flex-1 resize-y rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs leading-snug text-zinc-900 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300"
          />
        </section>
      </div>
    </div>
  );
}
