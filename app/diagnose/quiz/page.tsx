"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getQuiz } from "@/lib/kb";
import { useDiagnostic } from "@/state/DiagnosticContext";

export default function QuizPage() {
  const router = useRouter();
  const questions = getQuiz();
  const { quizAnswers, setQuizAnswer, applyRecommendedWeights } =
    useDiagnostic();
  // Resume at the first unanswered question instead of always restarting at
  // Q1 - answers already persist across a remount (e.g. revisiting via the
  // nav tab), so the visible step should too.
  const [step, setStep] = useState(() => {
    const firstUnanswered = questions.findIndex(
      (qq) => (quizAnswers[qq.id] ?? []).length === 0
    );
    return firstUnanswered === -1 ? questions.length - 1 : firstUnanswered;
  });

  const q = questions[step];
  const selected = quizAnswers[q.id] ?? [];
  const answeredCount = questions.filter(
    (qq) => (quizAnswers[qq.id] ?? []).length > 0
  ).length;
  const isLast = step === questions.length - 1;
  const canAdvance = selected.length > 0;

  function selectOption(optionId: string) {
    setQuizAnswer(q.id, [optionId]);
  }

  function next() {
    if (isLast) {
      applyRecommendedWeights();
      router.push("/diagnose/profile");
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <main className="page reveal quiz-page">
      <h1>Priorities</h1>
      <p className="lead">
        {answeredCount}/{questions.length} answered - these responses shape
        how the diagnostic prioritizes across modules.
      </p>

      <div className="progress-track" style={{ marginBottom: 28 }}>
        <div
          className="progress-fill"
          style={{ width: `${((step + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="card quiz-card">
        <span className="quiz-step">
          Question {step + 1} of {questions.length}
        </span>
        <h2 className="quiz-question">{q.question}</h2>
        <div className="quiz-options">
          {q.options.map((opt, i) => (
            <label
              key={opt.id}
              className={`option quiz-option${
                selected.includes(opt.id) ? " selected" : ""
              }`}
            >
              <input
                type="radio"
                name={q.id}
                checked={selected.includes(opt.id)}
                onChange={() => selectOption(opt.id)}
              />
              <span className="quiz-option-letter">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="quiz-option-label">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="btn-row quiz-btn-row">
        <button
          className="btn btn-secondary"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </button>
        <button className="btn btn-primary" disabled={!canAdvance} onClick={next}>
          {isLast ? "Verify Profile" : "Next"}
        </button>
      </div>
    </main>
  );
}
