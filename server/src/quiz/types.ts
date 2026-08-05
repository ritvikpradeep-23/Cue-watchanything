export type Answers = Record<string, any>;

export interface QuizOption {
  value: string;
  label: string;
}

export type QuestionKind = "single" | "multi" | "text" | "toggle-pair";

export interface QuizQuestion {
  id: string;
  prompt: string;
  kind: QuestionKind;
  options?: QuizOption[];
  /** for toggle-pair: each sub-toggle renders its own two options (not necessarily yes/no) */
  toggles?: { key: string; label: string; options: [QuizOption, QuizOption] }[];
}
