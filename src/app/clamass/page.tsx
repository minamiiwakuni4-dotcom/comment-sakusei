"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

async function dataUrlToFile(dataUrl: string, i: number): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], `note_${i}.jpg`, {
    type: blob.type || "image/jpeg",
  });
}

type ScheduleItem = {
  id: string;
  teacher: string;
  student: string;
  koma: string;
  isDoneServer: boolean;
};

type EvalItem = {
  name: string;
  good: string;
  normal: string;
  effort: string;
};

type EvalMaster = Record<string, EvalItem[]>;

type Rating = "良い" | "普通" | "要注意";

const KOMA_ORDER: Record<string, number> = { Z: 0, A: 1, B: 2, C: 3, D: 4 };

const SUBJECT_ORDER = [
  "英語",
  "数学",
  "国語",
  "理科",
  "社会",
  "高校英語",
  "高校数学",
] as const;

const MAX_NOTE_PHOTOS = 3;

const COLOR_MAP: Record<string, { default: string; active: string }> = {
  英語: {
    default: "bg-red-50 border-red-200 text-red-700",
    active: "bg-red-600 border-red-700 text-white",
  },
  数学: {
    default: "bg-blue-50 border-blue-200 text-blue-700",
    active: "bg-blue-600 border-blue-700 text-white",
  },
  国語: {
    default: "bg-orange-50 border-orange-200 text-orange-700",
    active: "bg-orange-600 border-orange-700 text-white",
  },
  理科: {
    default: "bg-emerald-50 border-emerald-200 text-emerald-700",
    active: "bg-emerald-600 border-emerald-700 text-white",
  },
  社会: {
    default: "bg-purple-50 border-purple-200 text-purple-700",
    active: "bg-purple-600 border-purple-700 text-white",
  },
  高校英語: {
    default: "bg-rose-100 border-rose-300 text-rose-800",
    active: "bg-rose-800 border-rose-900 text-white",
  },
  高校数学: {
    default: "bg-indigo-100 border-indigo-300 text-indigo-800",
    active: "bg-indigo-800 border-indigo-900 text-white",
  },
};

const WATERMARK_MARKS: Record<string, string> = {
  英語: "ABC",
  数学: "∑",
  国語: "読解",
  理科: "🧪",
  社会: "🗺",
  高校英語: "Eng",
  高校数学: "f(x)",
};

type SectionBlock = {
  koma: string;
  teachers: { teacher: string; items: ScheduleItem[] }[];
};

function sortSchedule(list: ScheduleItem[]) {
  return [...list].sort(
    (a, b) =>
      (KOMA_ORDER[a.koma] ?? 99) - (KOMA_ORDER[b.koma] ?? 99) ||
      a.teacher.localeCompare(b.teacher, "ja"),
  );
}

function buildSections(list: ScheduleItem[]): SectionBlock[] {
  const sorted = sortSchedule(list);
  const sections: SectionBlock[] = [];
  for (const item of sorted) {
    if (!item.student) continue;
    let sec = sections.find((s) => s.koma === item.koma);
    if (!sec) {
      sec = { koma: item.koma, teachers: [] };
      sections.push(sec);
    }
    let blk = sec.teachers.find((t) => t.teacher === item.teacher);
    if (!blk) {
      blk = { teacher: item.teacher, items: [] };
      sec.teachers.push(blk);
    }
    blk.items.push(item);
  }
  return sections;
}

function cardId(item: ScheduleItem) {
  return `card_${item.student}_${item.teacher}_${item.koma}`.replace(/\s+/g, "");
}

function komaSectionClass(koma: string) {
  if (koma === "Z") return "mb-1 rounded-[2.5rem] border-2 bg-purple-50 p-3 shadow-sm";
  if (koma === "A") return "mb-1 rounded-[2.5rem] border-2 bg-blue-50 p-3 shadow-sm";
  if (koma === "B") return "mb-1 rounded-[2.5rem] border-2 bg-emerald-50 p-3 shadow-sm";
  return "mb-1 rounded-[2.5rem] border-2 bg-orange-50 p-3 shadow-sm";
}

/** クリップボード用。生徒名は本部ポリシーにより入れない。 */
function buildCopyText(params: {
  activeItem: ScheduleItem | null;
  selectedSubject: string;
  subjectLocked: boolean;
  currentEvals: Record<string, Rating>;
  masterEvalData: EvalMaster;
  freeNote: string;
}): string {
  const {
    activeItem,
    selectedSubject,
    subjectLocked,
    currentEvals,
    masterEvalData,
    freeNote,
  } = params;
  if (!selectedSubject || subjectLocked) return "";
  const items = masterEvalData[selectedSubject] ?? [];
  if (items.length === 0) return "";

  const evalBlock = Object.entries(currentEvals)
    .map(([itemName, rating]) => {
      const itemData = items.find((i) => i.name === itemName);
      if (!itemData) return "";
      const criteriaText =
        rating === "良い"
          ? itemData.good
          : rating === "普通"
            ? itemData.normal
            : itemData.effort;
      return `■${itemName}: ${String(criteriaText).replace(/\//g, "")}`;
    })
    .filter(Boolean)
    .join("\n");

  if (!evalBlock.trim()) return "";

  const meta = activeItem
    ? `【コマ】${activeItem.koma}　【担当】${activeItem.teacher}\n`
    : "";
  const body = `教科: ${selectedSubject}\n${evalBlock}`;
  const note = freeNote.trim() ? `\n備考:\n${freeNote.trim()}` : "";
  return meta + body + note;
}

export default function ClamassPage() {
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const aiCommentRef = useRef<HTMLTextAreaElement>(null);

  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [masterEvalData, setMasterEvalData] = useState<EvalMaster>({});

  const [search, setSearch] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<ScheduleItem | null>(null);

  const [selectedSubject, setSelectedSubject] = useState("");
  const [subjectLocked, setSubjectLocked] = useState(true);
  const [currentEvals, setCurrentEvals] = useState<Record<string, Rating>>({});
  const [photoList, setPhotoList] = useState<string[]>([]);
  const [freeNote, setFreeNote] = useState("");
  const [watermark, setWatermark] = useState("");

  const [toast, setToast] = useState("");

  const [aiComment, setAiComment] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const loadMaster = useCallback(async () => {
    try {
      const res = await fetch(
        `/clamass/evaluation-master.json?t=${Date.now()}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as EvalMaster;
      setMasterEvalData(data);
    } catch (e) {
      window.alert(
        `評価項目の読込に失敗: ${e instanceof Error ? e.message : ""}`,
      );
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/clamass/schedule.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const rows = (await res.json()) as ScheduleItem[];
      setScheduleData(Array.isArray(rows) ? rows : []);
    } catch {
      setScheduleData([]);
    }
  }, []);

  useEffect(() => {
    const kick = window.setTimeout(() => {
      void loadData();
      void loadMaster();
    }, 0);
    const id = window.setInterval(() => void loadData(), 300_000);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(id);
    };
  }, [loadData, loadMaster]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return scheduleData;
    return scheduleData.filter((i) =>
      i.student.toLowerCase().includes(q),
    );
  }, [scheduleData, search]);

  const sections = useMemo(() => buildSections(filtered), [filtered]);

  const sortedSubjects = useMemo(() => {
    const keys = Object.keys(masterEvalData);
    return SUBJECT_ORDER.filter((s) => keys.includes(s));
  }, [masterEvalData]);

  const copyPayload = useMemo(
    () =>
      buildCopyText({
        activeItem,
        selectedSubject,
        subjectLocked,
        currentEvals,
        masterEvalData,
        freeNote,
      }),
    [
      activeItem,
      selectedSubject,
      subjectLocked,
      currentEvals,
      masterEvalData,
      freeNote,
    ],
  );

  const showToastMsg = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 3500);
  }, []);

  const copyEvalText = useCallback(() => {
    const text = copyPayload;
    if (!text.trim()) {
      window.alert("教科を選び、評価を入力してください。");
      return;
    }

    function doneOk() {
      showToastMsg("コピーしました。台帳に貼り付け、生徒名は手入力してください。");
    }

    try {
      if (
        exportRef.current &&
        typeof document !== "undefined" &&
        typeof document.execCommand === "function"
      ) {
        const ta = exportRef.current;
        ta.focus();
        ta.setSelectionRange(0, ta.value.length);
        if (document.execCommand("copy")) {
          const len = ta.value.length;
          ta.setSelectionRange(len, len);
          doneOk();
          return;
        }
      }
    } catch {
      /* fall through */
    }

    void navigator.clipboard?.writeText(text).then(doneOk, () => {
      window.alert(
        "コピーできませんでした。下の「コピー用プレビュー」を長押ししてコピーしてください。",
      );
    });
  }, [copyPayload, showToastMsg]);

  const generateParentComment = useCallback(async () => {
    const pack = copyPayload;
    if (!pack.trim()) {
      window.alert("教科を選び、評価を入力してください。");
      return;
    }
    if (photoList.length === 0) {
      window.alert("ノートの写真を1枚以上追加してください。");
      return;
    }
    setAiLoading(true);
    try {
      const fd = new FormData();
      fd.append("textPack", pack);
      for (let i = 0; i < photoList.length; i++) {
        const src = photoList[i];
        if (!src) continue;
        fd.append(`photo_${i}`, await dataUrlToFile(src, i));
      }
      const r = await fetch("/api/clamass/generate", {
        method: "POST",
        body: fd,
      });
      const data = (await r.json()) as { text?: string; error?: string };
      if (!r.ok) {
        window.alert(data.error ?? "生成に失敗しました");
        return;
      }
      if (!data.text) {
        window.alert("本文が返りませんでした。");
        return;
      }
      setAiComment(data.text);
      showToastMsg("保護者向けコメントを生成しました");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setAiLoading(false);
    }
  }, [copyPayload, photoList, showToastMsg]);

  const copyAiComment = useCallback(() => {
    const text = aiComment;
    if (!text.trim()) return;

    function doneOk() {
      showToastMsg("保護者コメントをコピーしました");
    }

    try {
      if (
        aiCommentRef.current &&
        typeof document !== "undefined" &&
        typeof document.execCommand === "function"
      ) {
        const ta = aiCommentRef.current;
        ta.focus();
        ta.setSelectionRange(0, ta.value.length);
        if (document.execCommand("copy")) {
          const len = ta.value.length;
          ta.setSelectionRange(len, len);
          doneOk();
          return;
        }
      }
    } catch {
      /* fall through */
    }

    void navigator.clipboard?.writeText(text).then(doneOk, () => {
      window.alert("コピーできませんでした。長押しでコピーしてください。");
    });
  }, [aiComment, showToastMsg]);

  const openReport = (item: ScheduleItem) => {
    setActiveItem(item);
    setPhotoList([]);
    setFreeNote("");
    setSubjectLocked(true);
    setSelectedSubject("");
    setCurrentEvals({});
    setWatermark("");
    setAiComment("");
    setReportOpen(true);
    window.scrollTo(0, 0);
  };

  const backToDashboard = () => {
    setReportOpen(false);
    void loadData();
  };

  const activateSubject = (subject: string) => {
    setSelectedSubject(subject);
    setSubjectLocked(false);
    setWatermark(WATERMARK_MARKS[subject] ?? subject.slice(0, 1));
    const items = masterEvalData[subject] ?? [];
    const init: Record<string, Rating> = {};
    items.forEach((it) => {
      init[it.name] = "普通";
    });
    setCurrentEvals(init);
  };

  const renderEvalLabelParts = (t: string) =>
    (t || "").split("/").map((part, idx) => (
      <span key={idx}>
        {idx > 0 ? <br /> : null}
        {part}
      </span>
    ));

  const setEvalRating = (name: string, value: Rating) => {
    setCurrentEvals((prev) => ({ ...prev, [name]: value }));
  };

  const onPhotoChange = (files: FileList | null) => {
    if (!files?.length) return;
    Array.from(files).forEach((f) => {
      const r = new FileReader();
      r.onload = (e) => {
        const s = e.target?.result;
        if (typeof s !== "string") return;
        setPhotoList((prev) => {
          if (prev.length >= MAX_NOTE_PHOTOS) return prev;
          return [...prev, s];
        });
      };
      r.readAsDataURL(f);
    });
  };

  const removePhoto = (i: number) => {
    setPhotoList((prev) => prev.filter((_, j) => j !== i));
  };

  return (
    <div className="clamass-body min-h-dvh text-slate-800">
      <div hidden={reportOpen}>
        <header className="sticky top-0 z-10 bg-white p-4 shadow-sm">
          <h1 className="text-center text-xl font-extrabold tracking-tight text-slate-800">
            ClaMas <span className="font-medium text-blue-600">Assist</span>
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-center text-[11px] leading-snug text-slate-500">
            授業評価は「評価文をコピー」で台帳へ手動貼り付け（生徒名はコピー文に含めません）。
            ノート写真＋評価から「保護者コメント生成」も利用できます（Gemini・生徒名は送りません）。
            保護者コメント生成ではノート写真を Gemini に送りますが、生徒名は含めません。
            成績表の AI 読み取りは本部ポリシーによりありません。
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="生徒名検索..."
              className="w-36 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={() => void loadData()}
              className="whitespace-nowrap rounded-lg bg-blue-500 px-3 py-2 text-sm font-bold text-white shadow-md"
            >
              🔄 更新
            </button>
          </div>
        </header>
        <main className="grid grid-cols-1 gap-1 p-4">
          {!filtered.some((x) => x.student) ? (
            <div className="py-10 text-center text-gray-400">
              該当する生徒はいません
            </div>
          ) : (
            sections.map((sec) => (
              <div key={sec.koma} className={komaSectionClass(sec.koma)}>
                <h2 className="mb-6 text-xl font-black">
                  <span className="rounded-full border bg-white px-6 py-2 shadow-sm">
                    {sec.koma}コマ
                  </span>
                </h2>
                {sec.teachers.map((tb) => (
                  <div key={`${sec.koma}-${tb.teacher}`} className="mb-3 last:mb-2">
                    <h3 className="mb-2 ml-2 flex items-center text-xl font-black">
                      <span className="mr-3 h-6 w-2.5 rounded-full bg-blue-600" />
                      {tb.teacher}
                      <span className="ml-2 text-xs italic text-slate-400">
                        先生
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {tb.items.map((item) => (
                        <button
                          key={cardId(item)}
                          type="button"
                          id={cardId(item)}
                          className={`relative flex min-h-[70px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 p-3 transition active:scale-95 ${
                            item.isDoneServer
                              ? "border-emerald-300 bg-emerald-50/50 opacity-80"
                              : "border-white bg-white shadow-lg"
                          }`}
                          onClick={() => openReport(item)}
                        >
                          <span className="text-center text-lg font-black text-slate-700">
                            {item.student}
                          </span>
                          {item.isDoneServer ? (
                            <span className="absolute right-1 top-1 flex h-6 w-9 items-center justify-center rounded-full bg-emerald-500 text-[16px] font-black text-white shadow-md">
                              済
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </main>
      </div>

      <div
        className={`fixed inset-0 z-20 overflow-y-auto bg-white pb-52 ${
          reportOpen ? "" : "hidden"
        }`}
      >
        <header className="sticky top-0 z-[100] border-b bg-amber-50/90 p-4 backdrop-blur-md">
          <div className="mb-4 flex items-start justify-between">
            <button
              type="button"
              onClick={backToDashboard}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-500"
            >
              ＜ 戻る
            </button>
            <div className="text-right">
              <div className="text-xl font-black leading-none text-slate-800">
                {activeItem?.student ?? ""}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {activeItem
                  ? `${activeItem.teacher} 先生 / ${activeItem.koma}コマ`
                  : null}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {sortedSubjects.map((subj) => {
              const colors = COLOR_MAP[subj] ?? {
                default: "border-slate-200 bg-white text-slate-700",
                active: "bg-blue-700 text-white",
              };
              const active = selectedSubject === subj;
              return (
                <button
                  key={subj}
                  type="button"
                  onClick={() => activateSubject(subj)}
                  className={`clamass-subj-btn shadow-sm ${colors.default} ${active ? `clamass-subj-active ${colors.active}` : ""}`}
                >
                  {subj}
                </button>
              );
            })}
          </div>
        </header>

        <div className="clamass-watermark">{watermark}</div>

        <div className="relative space-y-0 p-4">
          {subjectLocked ? (
            <div className="clamass-lock-overlay rounded-[2rem]">
              教科を選択してください
            </div>
          ) : null}
          <div
            className={`relative mt-[-12px] transition-all duration-300 ${
              subjectLocked ? "pointer-events-none opacity-50" : "opacity-100"
            }`}
          >
            <div className="space-y-1.5 rounded-[2rem] border-2 border-slate-100 bg-white p-4 shadow-inner">
              {(masterEvalData[selectedSubject] ?? []).map((item) => {
                const r = currentEvals[item.name] ?? "普通";
                return (
                  <div
                    key={item.name}
                    className="mb-1 border-b border-slate-50 pb-1 pt-0 last:border-0"
                  >
                    <span className="mb-0 block text-lg font-black uppercase leading-none tracking-tighter text-slate-500">
                      {item.name}
                    </span>
                    <div className="mt-1 flex gap-2">
                      {(
                        [
                          {
                            rating: "良い" as const,
                            cls: "clamass-eval-good",
                          },
                          {
                            rating: "普通" as const,
                            cls: "clamass-eval-normal",
                          },
                          {
                            rating: "要注意" as const,
                            cls: "clamass-eval-effort",
                          },
                        ] as const
                      ).map(({ rating, cls }) => (
                        <button
                          key={rating}
                          type="button"
                          className={`clamass-choice-btn py-0 text-lg leading-tight ${cls} ${r === rating ? "clamass-active" : ""}`}
                          onClick={() => setEvalRating(item.name, rating)}
                        >
                          {rating === "良い"
                            ? renderEvalLabelParts(item.good)
                            : rating === "普通"
                              ? renderEvalLabelParts(item.normal)
                              : renderEvalLabelParts(item.effort)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-2 text-center text-[10px] leading-snug text-slate-400">
              解答ノートの撮影です（氏名等は写さない運用）。「保護者コメント生成」で、評価文と写真を
              サーバー経由で Gemini に渡します。生徒名は送信しません。
            </p>
            <div className="mt-3 rounded-3xl border-2 border-dashed border-blue-300 bg-white p-6 text-center shadow-sm">
              <button
                type="button"
                onClick={() =>
                  document.getElementById("clamass-camera")?.click()
                }
                className="active:scale-95 w-full rounded-2xl bg-blue-600 py-5 text-lg font-black text-white shadow-lg transition"
              >
                📷 ノートを撮影
              </button>
              <input
                id="clamass-camera"
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => onPhotoChange(e.target.files)}
              />
              <div className="mt-4 grid grid-cols-3 gap-2">
                {photoList.map((src, i) => (
                  <div key={`p-${i}`} className="clamass-preview-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" />
                    <button
                      type="button"
                      className="clamass-del-btn"
                      aria-label="削除"
                      onClick={() => removePhoto(i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <textarea
              value={freeNote}
              onChange={(e) => setFreeNote(e.target.value)}
              placeholder="特記事項があれば..."
              className="mt-3 h-32 w-full rounded-2xl border-2 border-slate-100 p-4 text-sm outline-none transition focus:border-blue-400"
            />

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-1 text-[10px] font-bold text-slate-500">
                コピー用プレビュー（生徒名は含みません）
              </div>
              <textarea
                ref={exportRef}
                readOnly
                value={copyPayload}
                placeholder="教科選択・評価後に表示"
                rows={8}
                className="w-full resize-y rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs leading-relaxed text-slate-800 outline-none"
              />
            </div>
            <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3">
              <div className="mb-1 text-xs font-black text-indigo-900">
                保護者向けコメント（AI）
              </div>
              <p className="mb-2 text-[10px] leading-snug text-indigo-900/80">
                上の評価プレビューとノート写真からコメント案を作成します。本文は訂正・追記してから
                「生成文をコピー」でご利用ください。
              </p>
              <textarea
                ref={aiCommentRef}
                value={aiComment}
                onChange={(e) => setAiComment(e.target.value)}
                placeholder="「保護者コメント生成」後に表示されます。"
                rows={7}
                className="w-full resize-y rounded-lg border border-indigo-200 bg-white px-2 py-2 text-xs leading-relaxed text-slate-900 outline-none focus:border-indigo-400"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={!aiComment.trim()}
                  onClick={() => copyAiComment()}
                  className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-[11px] font-bold text-indigo-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  生成文をコピー
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-[110] flex flex-col gap-2 border-t bg-white/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:flex-row">
          <button
            type="button"
            disabled={
              aiLoading ||
              !copyPayload.trim() ||
              photoList.length === 0
            }
            onClick={() => void generateParentComment()}
            className="active:bg-indigo-800 flex-1 rounded-2xl bg-indigo-600 py-3.5 text-base font-black text-white shadow-xl transition disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {aiLoading ? "生成中…" : "保護者コメント生成"}
          </button>
          <button
            type="button"
            disabled={!copyPayload.trim()}
            onClick={() => copyEvalText()}
            className="active:bg-blue-700 flex-1 rounded-2xl bg-blue-600 py-3.5 text-base font-black text-white shadow-xl transition disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            評価文をコピー
          </button>
        </div>
      </div>

      <div
        className={`clamass-toast ${toast ? "clamass-toast-show" : ""}`}
        role="status"
      >
        {toast}
      </div>
    </div>
  );
}
