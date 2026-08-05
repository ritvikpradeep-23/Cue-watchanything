/**
 * Generates a bold, retro/pop-art poster card as an SVG string — no scraping, no external
 * image APIs. Used both to pre-render the static catalog's poster files and, at runtime, to
 * generate a poster for titles added through the admin route that don't supply a real image.
 */

const GENRE_PALETTES: Record<string, [string, string]> = {
  comedy: ["#f97316", "#1a1410"],
  drama: ["#2563eb", "#1a1410"],
  thriller: ["#dc2626", "#1a1410"],
  horror: ["#7c2d12", "#1a1410"],
  "sci-fi": ["#0891b2", "#1a1410"],
  fantasy: ["#9333ea", "#1a1410"],
  romance: ["#e11d48", "#1a1410"],
  action: ["#ea580c", "#1a1410"],
  documentary: ["#16a34a", "#1a1410"],
  mystery: ["#4338ca", "#1a1410"],
  "slice-of-life": ["#0d9488", "#1a1410"],
};

const DEFAULT_PALETTE: [string, string] = ["#f97316", "#1a1410"];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function wrapTitle(name: string, maxCharsPerLine = 14): string[] {
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
  return lines.slice(0, 3);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface PosterArtInput {
  id: string;
  name: string;
  type: string;
  year: number;
  primaryGenre?: string;
}

export function buildPosterSvg({ id, name, type, year, primaryGenre }: PosterArtInput): string {
  const [accent] = GENRE_PALETTES[primaryGenre ?? ""] ?? DEFAULT_PALETTE;
  const ink = "#1a1410";
  const cream = "#fbf3ea";
  const seed = hashString(id);
  const angle = seed % 8; // slight halftone rotation variance for texture variety
  const lines = wrapTitle(name);
  const bandTop = 300;
  const lineHeight = 30;
  const startY = bandTop + 46 - ((lines.length - 1) * lineHeight) / 2;

  const textLines = lines
    .map(
      (line, i) =>
        `<text x="24" y="${startY + i * lineHeight}" font-family="'Segoe UI', Arial, sans-serif" font-size="25" font-weight="900" letter-spacing="-0.5" fill="${cream}">${escapeXml(line.toUpperCase())}</text>`,
    )
    .join("\n    ");

  const initial = escapeXml(name.trim().charAt(0).toUpperCase() || "?");

  return `<svg viewBox="0 0 300 450" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dots-${id}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
      <circle cx="2" cy="2" r="1.3" fill="${ink}" opacity="0.16" />
    </pattern>
  </defs>
  <rect width="300" height="450" fill="${cream}" />
  <rect width="300" height="${bandTop}" fill="${accent}" />
  <rect width="300" height="${bandTop}" fill="url(#dots-${id})" />
  <rect x="0" y="${bandTop - 6}" width="300" height="6" fill="${ink}" />
  <rect width="300" height="450" fill="none" stroke="${ink}" stroke-width="10" />
  <circle cx="252" cy="48" r="30" fill="${cream}" stroke="${ink}" stroke-width="4" />
  <text x="252" y="59" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="30" font-weight="900" fill="${ink}">${initial}</text>
  <rect width="300" height="${450 - bandTop}" y="${bandTop}" fill="${ink}" />
  ${textLines}
  <text x="24" y="${420}" font-family="'Segoe UI', Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="2" fill="${accent}">${escapeXml(type.toUpperCase())} • ${year}</text>
</svg>`;
}

export function posterSvgToDataUri(svg: string): string {
  const base64 = Buffer.from(svg, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
