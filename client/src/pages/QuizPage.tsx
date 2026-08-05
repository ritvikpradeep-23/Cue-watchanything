import { useNavigate } from "react-router-dom";
import { QuizWizard, type QuizQuestion } from "../components/QuizWizard";
import { apiGet, apiPost } from "../lib/api";

export function QuizPage() {
  const navigate = useNavigate();

  async function fetchNext(answers: Record<string, any>): Promise<QuizQuestion | null> {
    const res = await apiGet<{ question: QuizQuestion | null }>(
      `/quiz/next?answers=${encodeURIComponent(JSON.stringify(answers))}`,
    );
    return res.question;
  }

  async function handleComplete(answers: Record<string, any>) {
    await apiPost("/quiz/submit", { answers });
    navigate("/swipe");
  }

  return (
    <QuizWizard
      title="Taste quiz"
      subtitle="Answers you skip won't be asked — some questions only show up if they apply."
      fetchNext={fetchNext}
      onComplete={handleComplete}
    />
  );
}
