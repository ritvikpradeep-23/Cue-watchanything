import { useEffect, useRef, useState } from "react";

export interface QuizOption {
  value: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  kind: "single" | "multi" | "text" | "text3" | "toggle-pair";
  options?: QuizOption[];
  toggles?: { key: string; label: string; options: [QuizOption, QuizOption] }[];
}

interface QuizWizardProps {
  title: string;
  subtitle?: string;
  /** Pure, synchronous — computed entirely client-side, no network round-trip per answer. */
  getNext: (answersSoFar: Record<string, any>) => QuizQuestion | null;
  onComplete: (answers: Record<string, any>) => Promise<void>;
  /** When set, persists in-progress answers to localStorage under this key so a page refresh
   * doesn't lose progress. Cleared once the quiz completes. Omit for a quiz that doesn't need
   * this (e.g. one already scoped to a single short session). */
  storageKey?: string;
}

interface PersistedState {
  answers: Record<string, any>;
  history: string[]; // question ids answered, in order — drives the back button
}

function storageKeyFor(key: string) {
  return `watchrec_quiz_${key}`;
}

function loadPersisted(key: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(storageKeyFor(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.answers && Array.isArray(parsed.history)) {
      return parsed;
    }
  } catch {
    // corrupt/foreign localStorage value — ignore and start fresh
  }
  return null;
}

export function QuizWizard({ title, subtitle, getNext, onComplete, storageKey }: QuizWizardProps) {
  const persisted = storageKey ? loadPersisted(storageKey) : null;

  const [answers, setAnswers] = useState<Record<string, any>>(persisted?.answers ?? {});
  const [history, setHistory] = useState<string[]>(persisted?.history ?? []);
  const [question, setQuestion] = useState<QuizQuestion | null>(() => getNext(persisted?.answers ?? {}));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dev-mode runtime check: a question_id should never be dispatched twice within a single
  // forward progression through the quiz — this was a real bug (a node reachable via two
  // different branches). Going back and re-answering the same question is not a violation
  // (its id is removed from this set when history is truncated on back()).
  const seenIds = useRef<Set<string>>(new Set(persisted?.history ?? []));

  // draft state for multi/text/toggle-pair before the user hits Continue
  const [draftMulti, setDraftMulti] = useState<string[]>([]);
  const [draftText, setDraftText] = useState("");
  const [draftText3, setDraftText3] = useState<[string, string, string]>(["", "", ""]);
  const [draftToggles, setDraftToggles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!storageKey) return;
    if (!question) {
      localStorage.removeItem(storageKeyFor(storageKey));
      return;
    }
    localStorage.setItem(storageKeyFor(storageKey), JSON.stringify({ answers, history }));
  }, [storageKey, answers, history, question]);

  function resetDrafts() {
    setDraftMulti([]);
    setDraftText("");
    setDraftText3(["", "", ""]);
    setDraftToggles({});
  }

  async function advance(currentAnswers: Record<string, any>, currentHistory: string[]) {
    const q = getNext(currentAnswers);
    resetDrafts();

    if (q) {
      if (seenIds.current.has(q.id)) {
        // Surfaced as a thrown error in dev rather than a silent console warning — this
        // invariant should never trip in production, so failing loudly during development is
        // the point.
        throw new Error(
          `Quiz state machine bug: question "${q.id}" was dispatched twice in one session (seen: ${[...seenIds.current].join(", ")})`,
        );
      }
      seenIds.current.add(q.id);
      setQuestion(q);
      setHistory(currentHistory);
      return;
    }

    setQuestion(null);
    setHistory(currentHistory);
    setSubmitting(true);
    setError(null);
    try {
      await onComplete(currentAnswers);
      if (storageKey) localStorage.removeItem(storageKeyFor(storageKey));
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
      setSubmitting(false);
    }
  }

  function submitAnswer(value: any) {
    if (!question) return;
    const next = { ...answers, [question.id]: value };
    const nextHistory = [...history, question.id];
    setAnswers(next);
    advance(next, nextHistory);
  }

  function goBack() {
    if (history.length === 0) return;
    const revisedHistory = history.slice(0, -1);
    const revertedId = history[history.length - 1];
    // Truncate every answer given at or after the reverted question — the spec's edge case:
    // changing an earlier answer must recompute (and drop stale) branch questions that
    // depended on it, not leave orphaned answers getNext() would otherwise treat as "already
    // answered".
    const revisedAnswers = { ...answers };
    delete revisedAnswers[revertedId];
    for (const id of history.slice(revisedHistory.length)) {
      delete revisedAnswers[id];
    }
    seenIds.current = new Set(revisedHistory);
    resetDrafts();
    setAnswers(revisedAnswers);
    setHistory(revisedHistory);
    setQuestion(getNext(revisedAnswers));
  }

  if (submitting) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
        <p className="text-[var(--text-muted)]">Building your recommendations…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-6 text-center">
        <p className="chip inline-flex bg-accent-500 px-3 py-1 text-xs text-[var(--on-accent)]">{title}</p>
        {subtitle && <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">{subtitle}</p>}
        <p className="mt-3 text-xs font-bold text-[var(--text-muted)]">Question {history.length + 1}</p>
      </div>

      {error && (
        <div className="surface mb-4 bg-red-100 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {question && (
        <div key={question.id} className="quiz-question-enter surface bg-[var(--bg-elevated)] p-6">
          {history.length > 0 && (
            <button
              onClick={goBack}
              className="mb-4 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-accent)]"
            >
              ← Back
            </button>
          )}
          <h2 className="mb-5 text-2xl font-semibold leading-tight">{question.prompt}</h2>

          {question.kind === "single" && (
            <div className="flex flex-col gap-2">
              {question.options?.map((o) => (
                <button
                  key={o.value}
                  onClick={() => submitAnswer(o.value)}
                  className="surface-interactive bg-[var(--bg-elevated)] px-4 py-3 text-left text-sm font-bold hover:bg-accent-500 hover:text-[var(--on-accent)]"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {question.kind === "multi" && (
            <>
              <div className="flex flex-wrap gap-2">
                {question.options?.map((o) => {
                  const selected = draftMulti.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      onClick={() =>
                        setDraftMulti((prev) =>
                          selected ? prev.filter((v) => v !== o.value) : [...prev, o.value],
                        )
                      }
                      className={`chip px-4 py-2 text-sm ${
                        selected ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => submitAnswer(draftMulti)}
                className="surface-interactive mt-6 w-full bg-accent-500 px-4 py-3 font-semibold text-[var(--on-accent)]"
              >
                Continue
              </button>
            </>
          )}

          {question.kind === "text" && (
            <>
              <input
                type="text"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Comma-separated, e.g. Breaking Bad, Parasite"
                className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-4 py-3 text-sm outline-none"
              />
              <button
                onClick={() =>
                  submitAnswer(
                    draftText
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                className="surface-interactive mt-4 w-full bg-accent-500 px-4 py-3 font-semibold text-[var(--on-accent)]"
              >
                Continue
              </button>
            </>
          )}

          {question.kind === "text3" && (
            <>
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <input
                    key={i}
                    type="text"
                    value={draftText3[i]}
                    onChange={(e) =>
                      setDraftText3((prev) => {
                        const next = [...prev] as [string, string, string];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    placeholder={`Favorite title #${i + 1}${i > 0 ? " (optional)" : ""}`}
                    className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-4 py-3 text-sm outline-none"
                  />
                ))}
              </div>
              <button
                onClick={() => submitAnswer(draftText3.map((s) => s.trim()).filter(Boolean))}
                className="surface-interactive mt-4 w-full bg-accent-500 px-4 py-3 font-semibold text-[var(--on-accent)]"
              >
                Continue
              </button>
            </>
          )}

          {question.kind === "toggle-pair" && (
            <>
              <div className="flex flex-col gap-4">
                {question.toggles?.map((t) => (
                  <div key={t.key}>
                    <p className="mb-2 text-sm font-bold text-[var(--text-muted)]">{t.label}</p>
                    <div className="flex gap-2">
                      {t.options.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => setDraftToggles((prev) => ({ ...prev, [t.key]: o.value }))}
                          className={`chip px-4 py-2 text-sm ${
                            draftToggles[t.key] === o.value
                              ? "bg-accent-500 text-[var(--on-accent)]"
                              : "bg-[var(--bg-elevated)] text-[var(--text)]"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                disabled={!question.toggles?.every((t) => draftToggles[t.key])}
                onClick={() => submitAnswer(draftToggles)}
                className="surface-interactive mt-6 w-full bg-accent-500 px-4 py-3 font-semibold text-[var(--on-accent)] disabled:opacity-40"
              >
                Continue
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
