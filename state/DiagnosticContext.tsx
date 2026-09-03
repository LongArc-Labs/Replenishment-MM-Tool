"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  getModules,
  getRecommendation,
  getAreasByModule,
  getQuiz,
} from "@/lib/kb";
import { blendWeights } from "@/lib/weights";
import { runDiagnostic, prioritizedGaps, targetLevelFor } from "@/lib/aggregate";
import type {
  QuizAnswers,
  ScoreEntry,
  IndicativeAnswer,
  PlanItem,
  DiagnosticResult,
  PlanStatus,
} from "@/lib/types";

interface DiagnosticState {
  quizAnswers: QuizAnswers;
  setQuizAnswer: (questionId: string, optionIds: string[]) => void;
  quizComplete: boolean;

  moduleWeights: Record<string, number>;
  weightsInitialized: boolean;
  applyRecommendedWeights: () => void;

  profileLocked: boolean;
  lockProfile: () => void;

  selectedAreaIds: string[];
  toggleAreaSelection: (areaId: string) => void;
  isModuleSelected: (moduleId: string) => boolean;
  toggleModuleSelection: (moduleId: string) => void;

  scores: Record<string, ScoreEntry>;
  completedAreaIds: string[];
  submitAreaAnswers: (
    areaId: string,
    moduleId: string,
    answers: IndicativeAnswer[],
    manualScore?: number | null,
    additionalObservations?: string
  ) => Promise<void>;
  setManualScoreOverride: (areaId: string, manualScore: number | null) => void;

  result: DiagnosticResult | null;
  resultStale: boolean;
  runDiagnosticNow: () => void;

  planItems: PlanItem[];

  reset: () => void;
}

const DiagnosticContext = createContext<DiagnosticState | null>(null);

// Bumping this invalidates any session saved under an older shape - safer
// than trying to migrate a stored blob if the state shape changes later.
const STORAGE_KEY = "diagnostic-session-v1";

export function DiagnosticProvider({ children }: { children: ReactNode }) {
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>({});
  const [moduleWeights, setModuleWeights] = useState<Record<string, number>>(
    {}
  );
  const [weightsInitialized, setWeightsInitialized] = useState(false);
  const [profileLocked, setProfileLocked] = useState(false);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreEntry>>({});
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [resultStale, setResultStale] = useState(false);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  // Starts false on both server and client so the first client render still
  // matches the server-rendered HTML (no hydration mismatch) - flips true
  // right after mount once any saved session has been loaded. Children are
  // held back until then (see the early return in the JSX below) so a page
  // deep in the flow (e.g. a specific score screen) doesn't run its own
  // "am I allowed to be here" redirect check against the still-empty state
  // a split second before the real, restored state arrives.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.quizAnswers) setQuizAnswers(saved.quizAnswers);
        if (saved.moduleWeights) setModuleWeights(saved.moduleWeights);
        if (typeof saved.weightsInitialized === "boolean")
          setWeightsInitialized(saved.weightsInitialized);
        if (typeof saved.profileLocked === "boolean")
          setProfileLocked(saved.profileLocked);
        if (saved.selectedAreaIds) setSelectedAreaIds(saved.selectedAreaIds);
        if (saved.scores) setScores(saved.scores);
        if (saved.result) setResult(saved.result);
        if (typeof saved.resultStale === "boolean")
          setResultStale(saved.resultStale);
        if (saved.planItems) setPlanItems(saved.planItems);
      }
    } catch {
      // Corrupt or inaccessible storage - continue with a fresh session
      // rather than blocking the app.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return; // don't clobber storage with the pre-load empty state
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          quizAnswers,
          moduleWeights,
          weightsInitialized,
          profileLocked,
          selectedAreaIds,
          scores,
          result,
          resultStale,
          planItems,
        })
      );
    } catch {
      // Storage full or unavailable (e.g. private browsing) - the session
      // still works in-memory for the rest of this tab, it just won't
      // survive a reload.
    }
  }, [
    hydrated,
    quizAnswers,
    moduleWeights,
    weightsInitialized,
    profileLocked,
    selectedAreaIds,
    scores,
    result,
    resultStale,
    planItems,
  ]);

  const setQuizAnswer = useCallback((questionId: string, optionIds: string[]) => {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: optionIds }));
    // Any answer change invalidates a weight blend/lock computed from the
    // previous answers - force both back through Profile Verification
    // rather than silently keeping a stale blend. Clearing moduleWeights
    // (not just the flags) matters: runDiagnosticNow() falls back to a
    // fresh blend only when this object is empty, so a stale-but-non-empty
    // object would otherwise still get reused if scoring is somehow reached
    // again without revisiting Profile Verification first.
    setModuleWeights({});
    setWeightsInitialized(false);
    setProfileLocked(false);
    // A result computed under the old answers/weights no longer reflects
    // the new ones - flag it the same way an area-selection change does.
    setResultStale(true);
  }, []);

  const quizComplete = useMemo(() => {
    const questions = getQuiz();
    return questions.every((q) => (quizAnswers[q.id] ?? []).length > 0);
  }, [quizAnswers]);

  const applyRecommendedWeights = useCallback(() => {
    setModuleWeights(blendWeights(quizAnswers));
    setWeightsInitialized(true);
  }, [quizAnswers]);

  const lockProfile = useCallback(() => setProfileLocked(true), []);

  const toggleAreaSelection = useCallback((areaId: string) => {
    setSelectedAreaIds((prev) =>
      prev.includes(areaId)
        ? prev.filter((id) => id !== areaId)
        : [...prev, areaId]
    );
    setResultStale(true);
  }, []);

  const isModuleSelected = useCallback(
    (moduleId: string) => {
      const ids = getAreasByModule(moduleId).map((a) => a.area_id);
      return ids.length > 0 && ids.every((id) => selectedAreaIds.includes(id));
    },
    [selectedAreaIds]
  );

  const toggleModuleSelection = useCallback(
    (moduleId: string) => {
      const ids = getAreasByModule(moduleId).map((a) => a.area_id);
      setSelectedAreaIds((prev) => {
        const allSelected = ids.every((id) => prev.includes(id));
        return allSelected
          ? prev.filter((id) => !ids.includes(id))
          : [...prev.filter((id) => !ids.includes(id)), ...ids];
      });
      setResultStale(true);
    },
    []
  );

  // Scores one area and returns the entry - does not touch state itself, so
  // callers can score several areas and commit them together. The LLM is
  // called whenever any question wasn't marked NA, even when a manual score
  // is also given, so a rationale is kept on record either way - manual_score
  // just wins in effectiveScore() when present. One retry before giving up
  // keeps a single transient network blip from wrongly flagging the area as
  // auto_failed; that retry runs at a nonzero temperature (see
  // app/api/score/route.ts) so it isn't just the same deterministic request
  // repeated.
  async function callScoreApi(
    areaId: string,
    observation: string,
    attempt: 1 | 2 = 1
  ): Promise<{ score: number; rationale: string | null } | null> {
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area_id: areaId, observation, attempt }),
      });
      const data = await res.json();
      if (data.result?.score != null) {
        return { score: data.result.score, rationale: data.result.rationale ?? null };
      }
      return null;
    } catch {
      return null;
    }
  }

  async function scoreArea(
    areaId: string,
    moduleId: string,
    answers: IndicativeAnswer[],
    manualScore?: number | null,
    additionalObservations?: string
  ): Promise<ScoreEntry> {
    const observation = answers
      .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
      .join("\n\n");

    // Every question marked NA means this topic doesn't apply to the
    // business at all (e.g. no reefer fleet) - that's different from a bad
    // answer, so it's excluded from the rollup entirely (see runDiagnostic)
    // rather than scored as a Level-1 failure. No LLM call needed either.
    const not_applicable =
      answers.length > 0 &&
      answers.every((a) => a.answer.trim().toUpperCase() === "NA");

    let llm_score: number | null = null;
    let llm_rationale: string | null = null;
    let auto_failed = false;

    if (!not_applicable) {
      let outcome = await callScoreApi(areaId, observation, 1);
      if (!outcome) outcome = await callScoreApi(areaId, observation, 2); // one retry

      if (outcome) {
        llm_score = outcome.score;
        llm_rationale = outcome.rationale;
      } else {
        auto_failed = true;
        llm_score = 1;
      }
    }

    return {
      module_id: moduleId,
      area_id: areaId,
      indicative_answers: answers,
      observation,
      additional_observations: additionalObservations,
      llm_score,
      llm_rationale,
      manual_score: manualScore ?? null,
      auto_failed,
      not_applicable,
      updated_at: new Date().toISOString(),
    };
  }

  const submitAreaAnswers = useCallback(
    async (
      areaId: string,
      moduleId: string,
      answers: IndicativeAnswer[],
      manualScore?: number | null,
      additionalObservations?: string
    ) => {
      const entry = await scoreArea(
        areaId,
        moduleId,
        answers,
        manualScore,
        additionalObservations
      );
      setScores((prev) => ({ ...prev, [areaId]: entry }));
      setResultStale(true);
    },
    []
  );

  // Patches a manual override into an already-scored entry without calling
  // the LLM again - the answers haven't changed, only which score wins.
  const setManualScoreOverride = useCallback(
    (areaId: string, manualScore: number | null) => {
      setScores((prev) => {
        const entry = prev[areaId];
        if (!entry) return prev;
        return { ...prev, [areaId]: { ...entry, manual_score: manualScore } };
      });
      setResultStale(true);
    },
    []
  );

  const runDiagnosticNow = useCallback(() => {
    const weights =
      Object.keys(moduleWeights).length > 0
        ? moduleWeights
        : blendWeights(quizAnswers);
    const diagnosticResult = runDiagnostic(scores, weights, selectedAreaIds);
    setResult(diagnosticResult);
    setResultStale(false);

    const gaps = prioritizedGaps(diagnosticResult);
    const items: PlanItem[] = gaps.map((g) => {
      const targetLevel = targetLevelFor(g);
      const rec = getRecommendation(g.area_id, targetLevel);
      return {
        id: `${g.module_id}:${g.area_id}`,
        module_id: g.module_id,
        module_name:
          getModules().find((m) => m.module_id === g.module_id)?.module_name ??
          g.module_id,
        area_id: g.area_id,
        area_name: g.area_name,
        current_score: g.score,
        target_level: targetLevel,
        recommended_tasks: rec?.recommended_tasks ?? "",
        weighted_gap: g.weighted_gap,
        owner: "",
        target_date: null,
        status: "not_started" as PlanStatus,
        notes: "",
      };
    });
    setPlanItems(items);
  }, [moduleWeights, quizAnswers, scores, selectedAreaIds]);

  const reset = useCallback(() => {
    setQuizAnswers({});
    setModuleWeights({});
    setWeightsInitialized(false);
    setProfileLocked(false);
    setSelectedAreaIds([]);
    setScores({});
    setResult(null);
    setResultStale(false);
    setPlanItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const completedAreaIds = useMemo(() => Object.keys(scores), [scores]);

  const value = useMemo<DiagnosticState>(
    () => ({
      quizAnswers,
      setQuizAnswer,
      quizComplete,
      moduleWeights,
      weightsInitialized,
      applyRecommendedWeights,
      profileLocked,
      lockProfile,
      selectedAreaIds,
      toggleAreaSelection,
      isModuleSelected,
      toggleModuleSelection,
      scores,
      completedAreaIds,
      submitAreaAnswers,
      setManualScoreOverride,
      result,
      resultStale,
      runDiagnosticNow,
      planItems,
      reset,
    }),
    [
      quizAnswers,
      setQuizAnswer,
      quizComplete,
      moduleWeights,
      weightsInitialized,
      applyRecommendedWeights,
      profileLocked,
      lockProfile,
      selectedAreaIds,
      toggleAreaSelection,
      isModuleSelected,
      toggleModuleSelection,
      scores,
      completedAreaIds,
      submitAreaAnswers,
      setManualScoreOverride,
      result,
      resultStale,
      runDiagnosticNow,
      planItems,
      reset,
    ]
  );

  return (
    <DiagnosticContext.Provider value={value}>
      {hydrated ? (
        children
      ) : (
        <main className="page">
          <p className="lead">Loading your diagnostic…</p>
        </main>
      )}
    </DiagnosticContext.Provider>
  );
}

export function useDiagnostic(): DiagnosticState {
  const ctx = useContext(DiagnosticContext);
  if (!ctx) {
    throw new Error("useDiagnostic must be used within a DiagnosticProvider");
  }
  return ctx;
}
