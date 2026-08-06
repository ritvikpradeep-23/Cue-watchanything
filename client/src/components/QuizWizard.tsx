import { useState } from "react";

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
}

export function QuizWizard({ title, subtitle, getNext, onComplete }: QuizWizardProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [question, setQuestion] = useState<QuizQuestion | null>(() => getNext({}));
  const [submitting, setSubmitting] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // draft state for multi/text/toggle-pair before the user hits Continue
  const [draftMulti, setDraftMulti] = useState<string[]>([]);
  const [draftText, setDraftText] = useState("");
  const [draftText3, setDraftText3] = useState<[string, string, string]>(["", "", ""]);
  const [draftToggles, setDraftToggles] = useState<Record<string, string>>({});

  async function advance(currentAnswers: Record<string, any>, nextNumber: number) {
    const q = getNext(currentAnswers);
    setDraftMulti([]);
    setDraftText("");
    setDraftText3(["", "", ""]);
    setDraftToggles({});

    if (q) {
      setQuestion(q);
      setQuestionNumber(nextNumber);
      return;
    }

    setQuestion(null);
    setSubmitting(true);
    setError(null);
    try {
      await onComplete(currentAnswers);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
      setSubmitting(false);
    }
  }

  function submitAnswer(value: any) {
    if (!question) return;
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    advance(next, questionNumber + 1);
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
        <p className="pop-badge inline-flex bg-accent-500 px-3 py-1 text-xs text-[var(--on-accent)]">{title}</p>
        {subtitle && <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">{subtitle}</p>}
        <p className="mt-3 text-xs font-bold uppercase text-[var(--text-muted)]">Question {questionNumber + 1}</p>
      </div>

      {error && (
        <div className="pop-panel mb-4 bg-red-100 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {question && (
        <div key={question.id} className="quiz-question-enter pop-panel bg-[var(--bg-elevated)] p-6">
          <h2 className="mb-5 text-2xl font-black uppercase leading-tight">{question.prompt}</h2>

          {question.kind === "single" && (
            <div className="flex flex-col gap-2">
              {question.options?.map((o) => (
                <button
                  key={o.value}
                  onClick={() => submitAnswer(o.value)}
                  className="pop-pressable bg-[var(--bg-elevated)] px-4 py-3 text-left text-sm font-bold hover:bg-accent-500 hover:text-[var(--on-accent)]"
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
                      className={`pop-badge px-4 py-2 text-sm ${
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
                className="pop-pressable mt-6 w-full bg-accent-500 px-4 py-3 font-black uppercase text-[var(--on-accent)]"
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
                className="pop-pressable mt-4 w-full bg-accent-500 px-4 py-3 font-black uppercase text-[var(--on-accent)]"
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
                className="pop-pressable mt-4 w-full bg-accent-500 px-4 py-3 font-black uppercase text-[var(--on-accent)]"
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
                          className={`pop-badge px-4 py-2 text-sm ${
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
                className="pop-pressable mt-6 w-full bg-accent-500 px-4 py-3 font-black uppercase text-[var(--on-accent)] disabled:opacity-40"
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
