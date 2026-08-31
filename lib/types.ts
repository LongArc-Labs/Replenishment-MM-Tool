// Core data model for the Replenishment + Middle-Mile diagnostic tool.
//
// NOTE on KB <-> app terminology: the source KB's `module_id` column is a
// single constant (the whole domain diagnostic, "RM_V1"), its `area_id`
// column (RM1..RM14, 14 rows) is the real navigation grouping, and its
// `subpoint_id` column (RM1.1..RM14.3, 42 rows) carries the weight, 5-level
// rubric, and indicative questions - i.e. it's the scored/weighted unit.
// The app's two-level drill-down ("Module groups -> Areas within a module")
// therefore maps KB-area -> app-Module and KB-subpoint -> app-Area. An
// optional, currently-unused finer layer (ProblemRow) can sit below an Area.

export interface AreaRow {
  module_id: string; // = KB area_id, e.g. "RM1"
  module_name: string; // = KB area_name
  area_id: string; // = KB subpoint_id, e.g. "RM1.1"
  area_name: string; // = KB subpoint_name
  area_weight: number; // normalized share within its module, sums to 1.0 per module
  score_descs: [string, string, string, string, string]; // level 1..5
  indicative_scoring_questions: string[]; // split from the KB's single packed string
  primary_kpi_metric: string;
}

// Optional finer breakdown under an Area. Not populated by the current KB,
// but the aggregation/scoring code supports it so it can be authored later
// without a schema change.
export interface ProblemRow {
  module_id: string;
  area_id: string;
  problem_id: string;
  problem_name: string;
  problem_weight: number; // sums to 1.0 within its area
  score_descs: [string, string, string, string, string];
  indicative_scoring_questions: string[];
}

export interface RecommendationRow {
  module_id: string;
  area_id: string;
  target_level: 2 | 3 | 4 | 5;
  target_level_name: string;
  recommended_tasks: string;
}

export type MetricGroup = "kpi" | "operational";
export type MetricDirection = "lower_is_better" | "higher_is_better";

export interface BenchmarkRow {
  metric_id: string;
  metric_name: string;
  group: MetricGroup;
  unit: string;
  best_in_class: number | null; // null => omit the BiC line on the card
  direction: MetricDirection;
  source_note?: string | null;
  // Optional link back to the Area this metric is primarily read off of,
  // used to derive "current value" from run scores where possible.
  linked_area_id?: string | null;
}

export interface ModuleSummary {
  module_id: string;
  module_name: string;
  module_weight: number; // sums to 1.0 across all modules
  area_ids: string[];
}

// --- Weight profiles & quiz ---

export type WeightProfileId =
  | "cost_sensitive"
  | "process_sensitive"
  | "quality_sensitive"
  | "balanced";

export interface WeightProfile {
  id: WeightProfileId;
  name: string;
  description: string;
  module_weights: Record<string, number>; // module_id -> weight, sums to 1.0
}

export interface QuizOption {
  id: string;
  label: string;
  // affinity per profile, 0..1, need not sum to 1
  affinity: Partial<Record<WeightProfileId, number>>;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
}

export type QuizAnswers = Record<string, string[]>; // question id -> selected option ids

// --- Scoring & session state ---

export interface IndicativeAnswer {
  question: string;
  answer: string; // free text, or "N/A"
}

export interface ScoreEntry {
  module_id: string;
  area_id: string;
  indicative_answers: IndicativeAnswer[];
  observation: string; // composed free-text observation
  additional_observations?: string;
  llm_score: number | null;
  llm_rationale: string | null;
  // Manual override, set via the 1-5 picker next to each area. Always wins
  // over llm_score when present.
  manual_score: number | null;
  // true when the LLM call failed/was unavailable and llm_score was defaulted
  // to 1 so the flow doesn't block on a missing API key (only meaningful
  // when manual_score is not set).
  auto_failed: boolean;
  updated_at: string | null;
}

export function effectiveScore(entry: ScoreEntry | undefined): number | null {
  if (!entry) return null;
  return entry.manual_score ?? entry.llm_score ?? null;
}

export type PlanStatus = "not_started" | "in_progress" | "done";

export interface PlanItem {
  id: string; // `${module_id}:${area_id}`
  module_id: string;
  module_name: string;
  area_id: string;
  area_name: string;
  current_score: number;
  target_level: number;
  recommended_tasks: string;
  weighted_gap: number;
  owner: string;
  target_date: string | null;
  status: PlanStatus;
  notes: string;
}

// --- Rollup results ---

export interface AreaResult {
  module_id: string;
  area_id: string;
  area_name: string;
  score: number; // 1-5, effective score (defaults to 1 if unscored)
  scored: boolean;
  area_weight: number; // share within its module, sums to 1 per module
  module_weight: number;
  weighted_gap: number;
}

export interface ModuleResult {
  module_id: string;
  module_name: string;
  module_weight: number;
  score: number; // weighted rollup of its areas, 1-5
  band: MaturityBand;
}

export interface DiagnosticResult {
  overall_score: number;
  overall_band: MaturityBand;
  modules: ModuleResult[];
  areas: AreaResult[];
}

export type MaturityBand =
  | "Ad Hoc"
  | "Basic"
  | "Standardized"
  | "Managed"
  | "Best-in-Class";
