import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";

interface TimelineSession {
  id: string;
  kind: string;
  createdAt: string;
  watchedTitleId: string | null;
  topTags: string[];
}

const POINT_SPACING = 160;
const WAVE_HEIGHT = 60;
const CHART_HEIGHT = 220;

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

  const width = Math.max(600, sessions.length * POINT_SPACING + 80);
  const midY = CHART_HEIGHT / 2;
  const points = sessions.map((s, i) => {
    const x = 60 + i * POINT_SPACING;
    // gentle wave so the journey reads as a winding path, not a flat line
    const y = midY + Math.sin(i * 1.1) * WAVE_HEIGHT;
    return { ...s, x, y };
  });
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Taste Timeline</h1>
      <p className="mb-8 text-sm font-bold text-[var(--text-muted)]">See where your taste has taken you.</p>

      {sessions.length === 0 ? (
        <div className="surface p-6 text-center">
          <p className="font-semibold text-[var(--text-muted)]">
            No sessions yet.{" "}
            <Link to="/quiz" className="font-bold text-[var(--text-accent)] underline">
              Take the quiz
            </Link>{" "}
            to start your journey.
          </p>
        </div>
      ) : (
        <div className="surface overflow-x-auto bg-[var(--bg-elevated)] p-6">
          <svg width={width} height={CHART_HEIGHT + 70} viewBox={`0 0 ${width} ${CHART_HEIGHT + 70}`}>
            <path d={pathD} fill="none" stroke="var(--color-accent-500)" strokeWidth={3} strokeLinecap="round" />
            {points.map((p, i) => (
              <g key={p.id}>
                <circle cx={p.x} cy={p.y} r={8} fill="var(--bg-elevated)" stroke="var(--color-accent-500)" strokeWidth={3} />
                <text
                  x={p.x}
                  y={p.y + (i % 2 === 0 ? -22 : 34)}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="var(--text)"
                >
                  {p.kind === "onboarding" ? "Onboarding" : "Pick next show"}
                </text>
                <text
                  x={p.x}
                  y={p.y + (i % 2 === 0 ? -8 : 48)}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--text-muted)"
                >
                  {new Date(p.createdAt).toLocaleDateString()}
                </text>
                {p.topTags.slice(0, 2).map((tag, ti) => (
                  <text
                    key={tag}
                    x={p.x}
                    y={p.y + (i % 2 === 0 ? -8 : 48) + 14 * (ti + 1)}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={600}
                    fill="var(--text-accent)"
                  >
                    {tag.replace(/-/g, " ")}
                  </text>
                ))}
              </g>
            ))}
          </svg>
        </div>
      )}

      <Link to="/profile" className="mt-8 inline-block text-sm font-bold text-[var(--text-accent)] hover:underline">
        ← Back to profile
      </Link>
    </div>
  );
}
