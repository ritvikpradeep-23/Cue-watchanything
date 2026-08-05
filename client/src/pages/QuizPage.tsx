import { useNavigate } from "react-router-dom";
import { getNextOnboardingQuestion } from "@watch-recommender/shared";
import { QuizWizard } from "../components/QuizWizard";
import { apiPost } from "../lib/api";

export function QuizPage() {
  const navigate = useNavigate();

  async function handleComplete(answers: Record<string, any>) {
    await apiPost("/quiz/submit", { answers });
    navigate("/swipe");
  }

  return (
    <QuizWizard
      title="Taste quiz"
      subtitle="Answers you skip won't be asked — some questions only show up if they apply."
      getNext={getNextOnboardingQuestion}
      onComplete={handleComplete}
    />
  );
}
