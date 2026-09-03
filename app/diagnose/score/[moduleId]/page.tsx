"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getModule, getAreasByModule, getModules } from "@/lib/kb";
import { useDiagnostic } from "@/state/DiagnosticContext";
import { effectiveScore } from "@/lib/types";
import { findNextIncompleteModule } from "@/lib/flow";
import type { IndicativeAnswer } from "@/lib/types";

export default function ScoreModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const router = useRouter();
  const mod = getModule(moduleId);
  const areas = useMemo(() => getAreasByModule(moduleId), [moduleId]);
  const {
    isModuleSelected,
    selectedAreaIds,
    completedAreaIds,
    submitAreaAnswers,
    setManualScoreOverride,
    runDiagnosticNow,
    moduleWeights,
    scores,
  } = useDiagnostic();

  // answers[areaId][questionIndex] - prefilled from a prior score entry (e.g.
  // when navigating back to an already-scored area via the jump nav) so the
  // fields and the score shown next to the title never disagree.
  const [answers, setAnswers] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      areas.map((a) => {
        const entry = scores[a.area_id];
        return [
          a.area_id,
          entry
            ? entry.indicative_answers.map((ia) => ia.answer)
            : a.indicative_scoring_questions.map(() => ""),
        ];
      })
    )
  );
  const [observations, setObservations] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        areas.map((a) => [
          a.area_id,
          scores[a.area_id]?.additional_observations ?? "",
        ])
      )
  );
  const [manualScores, setManualScores] = useState<
    Record<string, number | null>
  >(() =>
    Object.fromEntries(
      areas.map((a) => [a.area_id, scores[a.area_id]?.manual_score ?? null])
    )
  );
  const [submitting, setSubmitting] = useState(false);
  // Areas with a scoring call currently in flight - drives the "Scoring…"
  // indicator next to the topic title.
  const [scoringAreaIds, setScoringAreaIds] = useState<Record<string, boolean>>(
    {}
  );

  // Refs (not state) so triggerScoreCheck can make synchronous in-flight and
  // dedupe decisions without waiting on a render, and so handleNext can await
  // every currently-running call before navigating on.
  const scoringRef = useRef<Record<string, boolean>>({});
  const pendingRef = useRef<Record<string, Promise<void>>>({});
  // Mirrors `answers` on every render so the async completion handler below
  // can always re-check the latest values, not whatever was captured in the
  // closure when the in-flight call started.
  const answersRef = useRef<Record<string, string[]>>({});
  answersRef.current = answers;
  const scoredSigRef = useRef<Record<string, string>>(
    Object.fromEntries(
      areas
        .filter((a) => scores[a.area_id])
        .map((a) => [
          a.area_id,
          JSON.stringify(scores[a.area_id].indicative_answers.map((ia) => ia.answer)),
        ])
    )
  );

  useEffect(() => {
    if (!isModuleSelected(moduleId)) {
      router.replace("/diagnose/areas");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const orderedSelectedModules = useMemo(
    () => getModules().filter((m) => isModuleSelected(m.module_id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moduleId]
  );
  const currentIndex = orderedSelectedModules.findIndex(
    (m) => m.module_id === moduleId
  );
  const isLast = currentIndex === orderedSelectedModules.length - 1;
  const nextModule = !isLast ? orderedSelectedModules[currentIndex + 1] : null;

  if (!mod) {
    return (
      <main className="page">
        <p>Area not found.</p>
      </main>
    );
  }

  const allAnswered = areas.every((a) =>
    answers[a.area_id]?.every((ans) => ans.trim().length > 0)
  );
  const weightPct = Math.round((moduleWeights[moduleId] ?? mod.module_weight) * 1000) / 10;

  // Grows a textarea to fit its content instead of clipping a multi-line
  // answer inside a fixed 1-row box. Used both as a ref callback (so a
  // prefilled/restored answer is already sized correctly on first paint)
  // and inline in onChange (so it keeps growing as the user types).
  function autoGrow(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function setAnswer(areaId: string, qIndex: number, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [areaId]: [...(prev[areaId] ?? [])] };
      next[areaId][qIndex] = value;
      return next;
    });
  }

  // Same as setAnswer, but also runs the score check against the value this
  // update actually produces. Computed inside the functional updater (not
  // from the `answers` closure) so two calls for the same area queued in the
  // same tick - e.g. clicking NA on both questions back to back - still see
  // each other's change instead of one clobbering the other.
  function setAnswerAndCheck(areaId: string, qIndex: number, value: string) {
    setAnswers((prev) => {
      const areaAnswers = [...(prev[areaId] ?? [])];
      areaAnswers[qIndex] = value;
      queueMicrotask(() => triggerScoreCheck(areaId, areaAnswers));
      return { ...prev, [areaId]: areaAnswers };
    });
  }

  // Scores a topic the moment its questions are all answered, rather than
  // waiting for the module-level Next/Finish click. Takes the answers array
  // directly (instead of reading `answers` state) so a same-tick caller like
  // the NA button doesn't race the setAnswer state update. Idempotent: a
  // second call with the same answers, or while a call is already in
  // flight, is a no-op - safe to call from both onBlur and the final sweep
  // in handleNext.
  function triggerScoreCheck(areaId: string, areaAnswers: string[]) {
    const area = areas.find((a) => a.area_id === areaId);
    if (!area) return;
    const complete =
      areaAnswers.length === area.indicative_scoring_questions.length &&
      areaAnswers.every((v) => v.trim().length > 0);
    if (!complete) return;

    const sig = JSON.stringify(areaAnswers);
    if (scoredSigRef.current[areaId] === sig) return;
    if (scoringRef.current[areaId]) return;

    scoringRef.current[areaId] = true;
    setScoringAreaIds((prev) => ({ ...prev, [areaId]: true }));

    const payload: IndicativeAnswer[] = area.indicative_scoring_questions.map(
      (q, i) => ({ question: q, answer: areaAnswers[i] })
    );

    const promise = submitAreaAnswers(
      areaId,
      moduleId,
      payload,
      manualScores[areaId],
      observations[areaId]
    )
      .then(() => {
        scoredSigRef.current[areaId] = sig;
      })
      .finally(() => {
        scoringRef.current[areaId] = false;
        delete pendingRef.current[areaId];
        setScoringAreaIds((prev) => {
          const next = { ...prev };
          delete next[areaId];
          return next;
        });
        // The user may have kept editing while this call was in flight - an
        // edit that arrived mid-call was silently dropped by the in-flight
        // guard above rather than queued. Re-check the latest answers now
        // so that final state still gets scored instead of going stale.
        triggerScoreCheck(areaId, answersRef.current[areaId] ?? []);
      });

    pendingRef.current[areaId] = promise;
  }

  async function handleNext() {
    setSubmitting(true);
    try {
      // Final sweep: catches the case where the user reached Next/Finish
      // without the last field ever blurring (e.g. via NA-click then an
      // immediate click on Next). Everything else has typically already
      // been scored in the background as each topic was completed.
      for (const a of areas) {
        triggerScoreCheck(a.area_id, answers[a.area_id] ?? []);
      }
      await Promise.all(Object.values(pendingRef.current));

      if (nextModule) {
        router.push(`/diagnose/score/${nextModule.module_id}`);
        return;
      }

      // "Last selected module" is only a position in orderedSelectedModules -
      // the jump-nav lets a module be reached out of that order, so being
      // "last" here doesn't mean every OTHER selected module is actually
      // done. Check the real completion state before finishing, the same
      // way Select Areas' "Start Assessment" and Result's "Re-run" already
      // do, rather than silently rolling up whatever is still unscored as
      // a floor-score 1.
      const effectiveCompletedIds = [
        ...completedAreaIds,
        ...areas.map((a) => a.area_id),
      ];
      const nextIncomplete = findNextIncompleteModule(
        selectedAreaIds,
        effectiveCompletedIds
      );
      if (nextIncomplete && nextIncomplete.module_id !== moduleId) {
        router.push(`/diagnose/score/${nextIncomplete.module_id}`);
        return;
      }

      runDiagnosticNow();
      router.push("/result");
    } finally {
      setSubmitting(false);
    }
  }

  const completedModules = orderedSelectedModules.filter((m) =>
    getAreasByModule(m.module_id).every((a) =>
      completedAreaIds.includes(a.area_id)
    )
  ).length;

  return (
    <main className="page reveal">
      <Link href="/diagnose/areas" className="change-selection-link">
        &larr; Change selected areas
      </Link>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 4 }}>
        Module {currentIndex + 1} of {orderedSelectedModules.length}{" "}
        &middot; {completedModules}/{orderedSelectedModules.length} completed
      </p>
      <div className="jump-nav">
        {orderedSelectedModules.map((m) => {
          const isCurrent = m.module_id === moduleId;
          const isComplete = getAreasByModule(m.module_id).every((a) =>
            completedAreaIds.includes(a.area_id)
          );
          return (
            <button
              key={m.module_id}
              type="button"
              className={`jump-pill${isCurrent ? " current" : ""}${
                isComplete ? " done" : ""
              }`}
              onClick={() => router.push(`/diagnose/score/${m.module_id}`)}
              title={m.module_name}
            >
              {isComplete && !isCurrent ? "✓ " : ""}
              {m.module_id}
            </button>
          );
        })}
      </div>
      <div className="qa-module-head">
        <h1 style={{ marginBottom: 0 }}>{mod.module_name}</h1>
        <span className="weight-badge">weight {weightPct}%</span>
      </div>
      <p className="lead">
        Answer every question below for this area - it covers {areas.length}{" "}
        topic{areas.length === 1 ? "" : "s"}. Each topic scores itself
        automatically the moment you finish answering it; the highlighted box
        on the right is that result. Click a different box to override it, or
        click the same box again to hand it back to the automatic score.
      </p>

      <div className="card" style={{ padding: 0 }}>
        {areas.map((a) => {
          const entry = scores[a.area_id];
          const isScoring = !!scoringAreaIds[a.area_id];
          const score = entry ? effectiveScore(entry) : null;
          const hasManualOverride = manualScores[a.area_id] != null;
          return (
          <div className="qa-block" key={a.area_id}>
            <div className="qa-head">
              <div className="qa-title">
                <span className="qa-id" title="Internal reference code for this topic">
                  {a.area_id}
                </span>
                {a.area_name}
                {isScoring && (
                  <span className="qa-auto-score" aria-live="polite">
                    <span className="dot" aria-hidden="true" />
                    Scoring…
                  </span>
                )}
                {entry?.auto_failed && entry.manual_score == null && (
                  <span
                    className="badge badge-basic"
                    style={{ marginLeft: 8 }}
                    title="The automatic scoring call failed and this topic was defaulted to Level 1. Set a manual score below to replace it, or edit an answer to retry."
                  >
                    Auto-score unavailable - defaulted
                  </span>
                )}
                {entry?.not_applicable && entry.manual_score == null && (
                  <span
                    className="badge badge-neutral"
                    style={{ marginLeft: 8 }}
                    title="Every question here was marked NA, so this topic is excluded from the overall score entirely rather than scored as a failure. Set a manual score below if you'd rather have it count."
                  >
                    Not applicable - excluded from score
                  </span>
                )}
              </div>
              <div className="score-picker">
                {[1, 2, 3, 4, 5].map((n) => {
                  const isManual = manualScores[a.area_id] === n;
                  const isAuto = !hasManualOverride && score === n;
                  return (
                  <button
                    key={n}
                    type="button"
                    className={isManual ? "active" : isAuto ? "auto" : ""}
                    onClick={() => {
                      const nextVal = manualScores[a.area_id] === n ? null : n;
                      setManualScores((prev) => ({
                        ...prev,
                        [a.area_id]: nextVal,
                      }));
                      if (scores[a.area_id]) {
                        setManualScoreOverride(a.area_id, nextVal);
                      }
                    }}
                    title={
                      isAuto
                        ? `Auto-scored ${n} from your answers - click to override`
                        : `Set manual score ${n}`
                    }
                    aria-label={`Set manual score ${n} for ${a.area_name}`}
                  >
                    {n}
                  </button>
                  );
                })}
              </div>
            </div>

            {entry?.llm_rationale && (
              <p className="qa-rationale">
                <strong>Why:</strong> {entry.llm_rationale}
              </p>
            )}

            {a.indicative_scoring_questions.map((q, i) => (
              <div className="qa-item" key={i}>
                <label className="qa-label">
                  <span className="req">*</span>
                  {q}
                </label>
                <div className="qa-input-row">
                  <textarea
                    ref={autoGrow}
                    className="qa-input"
                    rows={1}
                    placeholder='Type your answer, or click NA'
                    value={answers[a.area_id]?.[i] ?? ""}
                    onChange={(e) => {
                      setAnswer(a.area_id, i, e.target.value);
                      autoGrow(e.target);
                    }}
                    onBlur={() =>
                      triggerScoreCheck(a.area_id, answers[a.area_id] ?? [])
                    }
                  />
                  <button
                    type="button"
                    className={`qa-na${
                      (answers[a.area_id]?.[i] ?? "").trim().toUpperCase() ===
                      "NA"
                        ? " active"
                        : ""
                    }`}
                    title="Mark as not applicable - scores the same as typing NA"
                    onClick={() => setAnswerAndCheck(a.area_id, i, "NA")}
                  >
                    NA
                  </button>
                </div>
              </div>
            ))}

            <div className="qa-item">
              <label className="qa-label muted">
                Additional observations (optional)
              </label>
              <textarea
                ref={autoGrow}
                className="qa-input"
                rows={1}
                placeholder="Anything else worth noting"
                value={observations[a.area_id] ?? ""}
                onChange={(e) => {
                  setObservations((prev) => ({
                    ...prev,
                    [a.area_id]: e.target.value,
                  }));
                  autoGrow(e.target);
                }}
              />
            </div>
          </div>
          );
        })}
      </div>

      <div className="btn-row">
        <button
          className="btn btn-primary"
          disabled={!allAnswered || submitting}
          onClick={handleNext}
        >
          {submitting
            ? "Assessing…"
            : nextModule
              ? `Next: ${nextModule.module_name}`
              : "Finish & View Result"}
        </button>
      </div>
    </main>
  );
}
