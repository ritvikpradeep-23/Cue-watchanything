import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import { PosterImage } from "../components/ui/PosterImage";

interface MilestoneTitle {
  id: string;
  name: string;
  posterUrl: string;
}

interface TimelineSession {
  id: string;
  kind: string;
  createdAt: string;
  topTags: string[];
  milestoneTitles: MilestoneTitle[];
  caption: string;
}

const POINT_SPACING = 220;
const WAVE_MID = 230;
const WAVE_HEIGHT = 35;
const CARD_WIDTH = 168;
const CARD_ABOVE_OFFSET = 178;
const CARD_BELOW_OFFSET = 22;
const TRACK_HEIGHT = WAVE_MID + WAVE_HEIGHT + CARD_BELOW_OFFSET + 170;

export function TasteTimelinePage() {
  const [sessions, setSessions] = useState<TimelineSession[] | null>(null);

  useEffect(() => {
    apiGet<{ sessions: TimelineSession[] }>("/profile/timeline").then((res) => setSessions(res.sessions));
  }, []);

  if (!sessions) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  const width = Math.max(700, sessions.length * POINT_SPACING + 120);
  const points = sessions.map((s, i) => {
    const x = 90 + i * POINT_SPACING;
    // gentle wave so the journey reads as a winding path, not a flat line
    const y = WAVE_MID + Math.sin(i * 1.1) * WAVE_HEIGHT;
    return { ...s, x, y };
  });
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Taste Timeline</h1>
      <p className="mb-8 text-sm font-medium text-[var(--text-muted)]">See where your taste has taken you.</p>

      {sessions.length === 0 ? (
        <div className="surface p-6 text-center">
          <p className="font-normal text-[var(--text-muted)]">
            No sessions yet.{" "}
            <Link to="/quiz" className="font-medium text-[var(--text-accent)] underline">
              Take the quiz
            </Link>{" "}
            to start your journey.
          </p>
        </div>
      ) : (
        <div className="surface overflow-x-auto bg-[var(--bg-elevated)] p-6">
          <div className="relative" style={{ width, height: TRACK_HEIGHT }}>
            <svg width={width} height={TRACK_HEIGHT} viewBox={`0 0 ${width} ${TRACK_HEIGHT}`} className="absolute left-0 top-0">
              <path
                d={pathD}
                fill="none"
                stroke="var(--color-accent-500)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="1 10"
              />
            </svg>

            {points.map((p, i) => {
              const above = i % 2 === 0;
              return (
                <div key={p.id}>
                  <div
                    className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-accent-500)] bg-[var(--bg-elevated)]"
                    style={{ left: p.x, top: p.y }}
                  />
                  <div
                    className="surface absolute -translate-x-1/2 bg-[var(--bg-elevated)] p-2.5"
                    style={{ left: p.x, top: above ? p.y - CARD_ABOVE_OFFSET : p.y + CARD_BELOW_OFFSET, width: CARD_WIDTH }}
                  >
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      {p.kind === "onboarding" ? "Onboarding" : "Pick next show"} · {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                    {p.milestoneTitles.length > 0 && (
                      <div className="mb-2 flex gap-1">
                        {p.milestoneTitles.map((t) => (
                          <Link
                            key={t.id}
                            to={`/titles/${t.id}`}
                            title={t.name}
                            className="surface-interactive block w-1/3 shrink-0 overflow-hidden bg-[var(--bg-elevated)]"
                          >
                            <PosterImage src={t.posterUrl} alt={t.name} className="aspect-[2/3] w-full" />
                          </Link>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] font-semibold leading-snug">{p.caption}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Link to="/profile" className="mt-8 inline-block text-sm font-medium text-[var(--text-accent)] hover:underline">
        ← Back to profile
      </Link>
    </div>
  );
}
