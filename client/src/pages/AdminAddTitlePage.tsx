import { useState } from "react";
import {
  GENRES,
  MOODS,
  PACES,
  TONES,
  CAST_STYLES,
  CONTENT_RATINGS,
  INTENSITIES,
  ERA_SETTINGS,
  STRUCTURES,
  SUB_DUB,
  COMPLETION_STATUSES,
  RECENCIES,
  LENGTH_BUCKETS,
  LOVE_FACTORS,
  INDUSTRIES,
  PLATFORMS,
  LANGUAGES,
  TITLE_TYPES,
} from "@watch-recommender/shared";
import { useAuth } from "../lib/auth-context";
import { apiPost, ApiError } from "../lib/api";

const TAG_SECTIONS: { key: string; label: string; options: readonly string[] }[] = [
  { key: "genre", label: "Genre", options: GENRES },
  { key: "mood", label: "Mood", options: MOODS },
  { key: "pace", label: "Pace", options: PACES },
  { key: "tone", label: "Tone", options: TONES },
  { key: "cast_style", label: "Cast style", options: CAST_STYLES },
  { key: "content_rating", label: "Content rating", options: CONTENT_RATINGS },
  { key: "intensity", label: "Intensity (mature titles)", options: INTENSITIES },
  { key: "era_setting", label: "Era / setting", options: ERA_SETTINGS },
  { key: "structure", label: "Structure", options: STRUCTURES },
  { key: "sub_dub", label: "Sub / dub (anime)", options: SUB_DUB },
  { key: "completion_status", label: "Completion status", options: COMPLETION_STATUSES },
  { key: "recency", label: "Recency", options: RECENCIES },
  { key: "length_bucket", label: "Length bucket", options: LENGTH_BUCKETS },
  { key: "love_factor", label: "Love factor", options: LOVE_FACTORS },
  { key: "industry", label: "Industry", options: INDUSTRIES },
];

function label(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function TagPicker({
  section,
  selected,
  onToggle,
}: {
  section: { key: string; label: string; options: readonly string[] };
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-[var(--text-muted)]">{section.label}</p>
      <div className="flex flex-wrap gap-1.5">
        {section.options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`chip px-2.5 py-1 text-[11px] ${
                isSelected ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
              }`}
            >
              {label(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AdminAddTitlePage() {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [type, setType] = useState<string>("show");
  const [plot, setPlot] = useState("");
  const [cast, setCast] = useState("");
  const [seasons, setSeasons] = useState("");
  const [episodes, setEpisodes] = useState("");
  const [runtime, setRuntime] = useState("");
  const [year, setYear] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [tags, setTags] = useState<Record<string, string[]>>(
    Object.fromEntries(TAG_SECTIONS.map((s) => [s.key, []])),
  );
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user?.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="surface p-6 font-bold">Admin access required.</p>
      </div>
    );
  }

  function toggleTag(category: string, value: string) {
    setTags((prev) => {
      const current = prev[category] ?? [];
      return {
        ...prev,
        [category]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  }

  function togglePlatform(value: string) {
    setPlatforms((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function toggleLanguage(value: string) {
    setLanguages((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleSubmit() {
    setStatus(null);
    if (!name.trim() || !plot.trim() || platforms.length === 0 || !year) {
      setStatus({ kind: "error", message: "Name, plot summary, at least one platform, and release year are required." });
      return;
    }
    setSubmitting(true);
    try {
      await apiPost("/admin/titles", {
        name,
        type,
        plot_summary: plot,
        cast: cast.split(",").map((c) => c.trim()).filter(Boolean),
        seasons: seasons ? Number(seasons) : undefined,
        episodes: episodes ? Number(episodes) : undefined,
        runtime_minutes: runtime ? Number(runtime) : undefined,
        release_year: Number(year),
        platforms,
        languages,
        poster_url: posterUrl || undefined,
        tags,
      });
      setStatus({ kind: "ok", message: `"${name}" added — it'll show up in the catalog immediately.` });
      setName("");
      setPlot("");
      setCast("");
      setSeasons("");
      setEpisodes("");
      setRuntime("");
      setYear("");
      setPosterUrl("");
      setPlatforms([]);
      setLanguages(["English"]);
      setTags(Object.fromEntries(TAG_SECTIONS.map((s) => [s.key, []])));
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof ApiError ? e.message : "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Add a title</h1>
      <p className="mb-6 text-sm text-[var(--text-muted)]">
        Inserted straight into the catalog — no seed rebuild or redeploy needed.
      </p>

      <div className="surface flex flex-col gap-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
            >
              {TITLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold">Plot summary</label>
          <textarea
            value={plot}
            onChange={(e) => setPlot(e.target.value)}
            rows={3}
            className="w-full rounded-lg border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold">Cast (comma-separated)</label>
          <input
            value={cast}
            onChange={(e) => setCast(e.target.value)}
            className="w-full rounded-lg border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Seasons</label>
            <input
              type="number"
              value={seasons}
              onChange={(e) => setSeasons(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Episodes</label>
            <input
              type="number"
              value={episodes}
              onChange={(e) => setEpisodes(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Runtime (min)</label>
            <input
              type="number"
              value={runtime}
              onChange={(e) => setRuntime(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold">
            Poster URL <span className="normal-case text-[var(--text-muted)]">(optional — a retro placeholder is generated if left blank)</span>
          </label>
          <input
            value={posterUrl}
            onChange={(e) => setPosterUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide">Platforms</p>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={`chip px-2.5 py-1 text-[11px] ${
                  platforms.includes(p) ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide">Languages</p>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => toggleLanguage(l)}
                className={`chip px-2.5 py-1 text-[11px] ${
                  languages.includes(l) ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <hr className="border-[var(--border)]" />
        <p className="text-sm font-semibold">Tags</p>
        {TAG_SECTIONS.map((section) => (
          <TagPicker
            key={section.key}
            section={section}
            selected={tags[section.key] ?? []}
            onToggle={(value) => toggleTag(section.key, value)}
          />
        ))}

        {status && (
          <p className={`text-sm font-bold ${status.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>
            {status.message}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="surface-interactive bg-accent-500 px-5 py-2.5 font-semibold text-[var(--on-accent)] disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add title"}
        </button>
      </div>
    </div>
  );
}
