import { scoreTitleBreakdown, type TagProfile, type TitleTags } from "@watch-recommender/shared";

const AXES: { key: string; label: string }[] = [
  { key: "genre", label: "Genre" },
  { key: "mood", label: "Mood" },
  { key: "pace", label: "Pace" },
  { key: "tone", label: "Tone" },
  { key: "love_factor", label: "What you love" },
];

interface TasteRadarChartProps {
  userProfile: TagProfile;
  tags: TitleTags;
  size?: number;
}

/** Hand-rolled SVG radar — "why this matches you," reusing the same scoreTitle data already
 * computed for the deck/results rather than a separate metric just for display. */
export function TasteRadarChart({ userProfile, tags, size = 220 }: TasteRadarChartProps) {
  const { byCategory } = scoreTitleBreakdown(userProfile, { tags });
  const values = AXES.map((a) => Math.max(0, byCategory[a.key] ?? 0));
  const maxVal = Math.max(1, ...values);

  const center = size / 2;
  const outerR = size / 2 - 28;
  const n = AXES.length;
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const pointAt = (i: number, r: number) => {
    const a = angleFor(i);
    return [center + r * Math.cos(a), center + r * Math.sin(a)] as const;
  };

  const ringLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = values.map((v, i) => pointAt(i, (v / maxVal) * outerR));
  const dataPath = dataPoints.map((p) => p.join(",")).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Why this matches you">
      {ringLevels.map((level) => {
        const ringPoints = Array.from({ length: n }, (_, i) => pointAt(i, level * outerR).join(",")).join(" ");
        return (
          <polygon
            key={level}
            points={ringPoints}
            fill="none"
            stroke="var(--border)"
            strokeOpacity={0.18}
            strokeWidth={1}
          />
        );
      })}

      {AXES.map((axis, i) => {
        const [x, y] = pointAt(i, outerR);
        const [lx, ly] = pointAt(i, outerR + 16);
        return (
          <g key={axis.key}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="var(--border)" strokeOpacity={0.18} strokeWidth={1} />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={700}
              fill="var(--text-muted)"
            >
              {axis.label}
            </text>
          </g>
        );
      })}

      <polygon points={dataPath} fill="var(--color-accent-500)" fillOpacity={0.35} stroke="var(--color-accent-500)" strokeWidth={2} />
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="var(--color-accent-500)" />
      ))}
    </svg>
  );
}
