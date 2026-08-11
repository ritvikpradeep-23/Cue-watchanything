import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNextOnboardingQuestion } from "@watch-recommender/shared";
import { QuizWizard } from "../components/QuizWizard";
import { apiGet, apiPost } from "../lib/api";

export function QuizPage() {
  const navigate = useNavigate();
  // Only name+type are needed to gate the anime path's conditional demographic question
  // (does a favorite title match an anime-tagged title?) — fetched once, not on every
  // getNext() call.
  const [titleIndex, setTitleIndex] = useState<{ name: string; type: string }[] | undefined>(undefined);

  useEffect(() => {
    apiGet<{ titles: { name: string; type: string }[] }>("/titles").then((res) =>
      setTitleIndex(res.titles.map((t) => ({ name: t.name, type: t.type }))),
    );
  }, []);

  async function handleComplete(answers: Record<string, any>) {
    await apiPost("/quiz/submit", { answers });
    navigate("/swipe");
  }

  return (
    <QuizWizard
      title="Taste quiz"
      subtitle="Answers you skip won't be asked — some questions only show up if they apply."
      getNext={(answers) => getNextOnboardingQuestion(answers, titleIndex)}
      onComplete={handleComplete}
      storageKey="onboarding"
    />
  );
}
