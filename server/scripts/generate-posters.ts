/**
 * Generates a static, deterministic placeholder poster (SVG) for every seeded title.
 * No scraping, no external image APIs — just a genre-colored gradient + title text,
 * satisfying "poster_url: static asset path, not scraped" from the spec.
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { TITLES } from "../prisma/seed-data/titles";

const OUT_DIR = path.resolve(__dirname, "../../client/public/posters");

const GENRE_GRADIENTS: Record<string, [string, string]> = {
  comedy: ["#f59e0b", "#ec4899"],
  drama: ["#3b82f6", "#1e293b"],
  thriller: ["#dc2626", "#18181b"],
  horror: ["#7f1d1d", "#000000"],
  "sci-fi": ["#06b6d4", "#4c1d95"],
  fantasy: ["#8b5cf6", "#db2777"],
  romance: ["#f43f5e", "#7c2d92"],
  action: ["#f97316", "#7f1d1d"],
  documentary: ["#10b981", "#1e293b"],
  mystery: ["#4338ca", "#18181b"],
  "slice-of-life": ["#14b8a6", "#065f46"],
};

const DEFAULT_GRADIENT: [string, string] = ["#7c3aed", "#3b0764"];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function wrapTitle(name: string, maxCharsPerLine = 16): string[] {
  const words = name.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSvg(name: string, type: string, year: number, genre: string, seed: string): string {
  const [c1, c2] = GENRE_GRADIENTS[genre] ?? DEFAULT_GRADIENT;
  const angle = hashString(seed) % 360;
  const lines = wrapTitle(name);
  const lineHeight = 34;
  const startY = 225 - ((lines.length - 1) * lineHeight) / 2;

  const textLines = lines
    .map(
      (line, i) =>
        `<text x="150" y="${startY + i * lineHeight}" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="26" font-weight="700" fill="white" opacity="0.96">${escapeXml(line)}</text>`,
    )
    .join("\n    ");

  return `<svg viewBox="0 0 300 450" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="100%" stop-color="${c2}" />
    </linearGradient>
  </defs>
  <rect width="300" height="450" fill="url(#g)" />
  <rect width="300" height="450" fill="black" opacity="0.15" />
  ${textLines}
  <text x="150" y="410" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="13" letter-spacing="2" fill="white" opacity="0.75">${type.toUpperCase()} • ${year}</text>
</svg>`;
}

mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const title of TITLES) {
  const primaryGenre = title.tags.genre[0] ?? "";
  const svg = buildSvg(title.name, title.type, title.release_year, primaryGenre, title.id);
  writeFileSync(path.join(OUT_DIR, `${title.id}.svg`), svg, "utf-8");
  count++;
}

console.log(`Generated ${count} poster placeholders in ${OUT_DIR}`);
