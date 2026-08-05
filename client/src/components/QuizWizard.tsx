import { useState } from "react";

export interface QuizOption {
  value: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  kind: "single" | "multi" | "text" | "toggle-pair";
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
  const [draftToggles, setDraftToggles] = useState<Record<string, string>>({});

  async function advance(currentAnswers: Record<string, any>, nextNumber: number) {
    const q = getNext(currentAnswers);
    setDraftMulti([]);
    setDraftText("");
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
        <p className="text-sm font-medium uppercase tracking-wider text-accent-500">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>}
        <p className="mt-3 text-xs text-[var(--text-muted)]">Question {questionNumber + 1}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {question && (
        <div
          key={question.id}
          className="quiz-question-enter rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-sm"
        >
          <h2 className="mb-5 text-xl font-semibold">{question.prompt}</h2>

          {question.kind === "single" && (
            <div className="flex flex-col gap-2">
              {question.options?.map((o) => (
                <button
                  key={o.value}
                  onClick={() => submitAnswer(o.value)}
                  className="rounded-xl border border-[var(--border)] px-4 py-3 text-left text-sm font-medium transition-colors hover:border-accent-500 hover:bg-[var(--bg-sunken)]"
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
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        selected
                          ? "border-accent-500 bg-accent-500 text-white"
                          : "border-[var(--border)] hover:border-accent-500"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => submitAnswer(draftMulti)}
                className="mt-6 w-full rounded-xl bg-accent-500 px-4 py-3 font-semibold text-white hover:bg-accent-600"
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
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none focus:border-accent-500"
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
                className="mt-4 w-full rounded-xl bg-accent-500 px-4 py-3 font-semibold text-white hover:bg-accent-600"
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
                    <p className="mb-2 text-sm text-[var(--text-muted)]">{t.label}</p>
                    <div className="flex gap-2">
                      {t.options.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => setDraftToggles((prev) => ({ ...prev, [t.key]: o.value }))}
                          className={`rounded-full border px-4 py-2 text-sm font-medium ${
                            draftToggles[t.key] === o.value
                              ? "border-accent-500 bg-accent-500 text-white"
                              : "border-[var(--border)] hover:border-accent-500"
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
                className="mt-6 w-full rounded-xl bg-accent-500 px-4 py-3 font-semibold text-white hover:bg-accent-600 disabled:opacity-40"
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
