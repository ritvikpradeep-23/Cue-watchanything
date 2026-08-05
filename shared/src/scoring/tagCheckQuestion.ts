import type { TitleSeed } from "../types";

export interface TagCheckQuestion {
  category: string;
  tag: string;
  prompt: string;
  options: { label: string; delta: number }[];
}

/**
 * Category-specific calibration phrasing. Falls back to a generic "more/less of this" shape
 * for categories that don't have a bespoke phrasing (e.g. custom tags added later).
 */
const CATEGORY_TEMPLATES: Record<
  string,
  (tagLabel: string) => { prompt: string; options: { label: string; delta: number }[] }
> = {
  pace: (tag) => ({
    prompt: `The pace was ${tag} — was that right, too slow, or too fast?`,
    options: [
      { label: "Too slow", delta: -1 },
      { label: "Right", delta: 1 },
      { label: "Too fast", delta: -1 },
    ],
  }),
  mood: (tag) => ({
    prompt: `This one leaned "${tag}" — was that the right mood, or off?`,
    options: [
      { label: "Right mood", delta: 1 },
      { label: "Wasn't for me", delta: -1 },
    ],
  }),
  intensity: (tag) => ({
    prompt: `On "${tag}" — was that too much, too little, or about right?`,
    options: [
      { label: "Too much", delta: -1 },
      { label: "About right", delta: 1 },
      { label: "Too little", delta: -1 },
    ],
  }),
  tone: (tag) => ({
    prompt: `The tone was ${tag} — was that right, or not what you wanted?`,
    options: [
      { label: "Right tone", delta: 1 },
      { label: "Not what I wanted", delta: -1 },
    ],
  }),
};

function genericTemplate(tag: string) {
  return {
    prompt: `Want more titles like this one's "${tag.replace(/-/g, " ")}" tag, or less?`,
    options: [
      { label: "More like this", delta: 1 },
      { label: "Less like this", delta: -1 },
    ],
  };
}

/** Picks the title's top-2 most defining tags (by category priority) and builds one calibration question per tag. */
export function generateTagCheckQuestions(title: TitleSeed): TagCheckQuestion[] {
  const priorityCategories: { category: keyof TitleSeed["tags"]; label: (t: string) => string }[] = [
    { category: "pace", label: (t) => t },
    { category: "mood", label: (t) => t },
    { category: "tone", label: (t) => t },
    { category: "intensity", label: (t) => t },
    { category: "genre", label: (t) => t },
  ];

  const chosen: { category: string; tag: string }[] = [];
  for (const { category } of priorityCategories) {
    const values = title.tags[category];
    if (values && values.length > 0) {
      chosen.push({ category, tag: values[0] });
    }
    if (chosen.length >= 2) break;
  }

  return chosen.map(({ category, tag }) => {
    const template = CATEGORY_TEMPLATES[category]?.(tag) ?? genericTemplate(tag);
    return { category, tag, ...template };
  });
}
