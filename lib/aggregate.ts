import { getAreas, getModules } from "@/lib/kb";
import { effectiveScore } from "@/lib/types";
import type {
  ScoreEntry,
  AreaResult,
  ModuleResult,
  DiagnosticResult,
  MaturityBand,
} from "@/lib/types";

const MAX_LEVEL = 5;

export function maturityBand(score: number): MaturityBand {
  if (score < 1.8) return "Ad Hoc";
  if (score < 2.6) return "Basic";
  if (score < 3.4) return "Standardized";
  if (score < 4.2) return "Managed";
  return "Best-in-Class";
}

/**
 * Renormalizes the quiz-blended module weights across only a given subset
 * of modules (e.g. the ones currently selected on the Select Areas screen).
 * This is the exact same math runDiagnostic uses for the real rollup, shared
 * so the selection screen can preview the true, applied weight instead of
 * showing the pre-selection blend as if it were what actually counts.
 */
export function normalizedModuleWeights(
  moduleWeights: Record<string, number>,
  moduleIds: string[]
): Record<string, number> {
  const rawSum = moduleIds.reduce((s, id) => s + (moduleWeights[id] ?? 0), 0);
  const result: Record<string, number> = {};
  for (const id of moduleIds) {
    result[id] =
      rawSum > 0
        ? (moduleWeights[id] ?? 0) / rawSum
        : 1 / Math.max(moduleIds.length, 1);
  }
  return result;
}

/**
 * Runs the full weighted rollup: Area (scored unit) -> Module -> overall,
 * scoped to only the areas the user selected (unselected areas never enter
 * the rollup - they aren't defaulted to the floor, they simply don't exist
 * for this run).
 *
 * Both area_weight (within its module) and module_weight (across all
 * modules) are renormalized to the selected subset: a module with 2 of 5
 * areas picked splits its weight across those 2; a module with zero areas
 * picked drops out of the overall score entirely.
 *
 * weighted_gap chains module weight so a single cross-cutting priority order
 * can be derived straight from the Area-level results (used for both
 * Recommendations ordering and Plan Item ordering - not recomputed twice).
 */
export function runDiagnostic(
  scores: Record<string, ScoreEntry>,
  moduleWeights: Record<string, number>,
  selectedAreaIds: string[]
): DiagnosticResult {
  const selected = new Set(selectedAreaIds);
  // An area marked not_applicable (every indicative question answered NA)
  // is dropped from the rollup entirely - its weight is redistributed
  // across the remaining areas/modules instead of scoring it as a Level-1
  // failure - unless a manual_score was set to explicitly override that.
  const isExcluded = (areaId: string) => {
    const entry = scores[areaId];
    return entry?.not_applicable === true && entry.manual_score == null;
  };
  const areas = getAreas().filter(
    (a) => selected.has(a.area_id) && !isExcluded(a.area_id)
  );
  const includedAreaIds = new Set(areas.map((a) => a.area_id));
  const modules = getModules().filter((m) =>
    m.area_ids.some((id) => includedAreaIds.has(id))
  );

  const normalizedWeights = normalizedModuleWeights(
    moduleWeights,
    modules.map((m) => m.module_id)
  );
  const normalizedModuleWeight = (moduleId: string) =>
    normalizedWeights[moduleId] ?? 0;

  // Renormalize area_weight within each module across only its selected areas.
  const areaWeightSumByModule = new Map<string, number>();
  for (const a of areas) {
    areaWeightSumByModule.set(
      a.module_id,
      (areaWeightSumByModule.get(a.module_id) ?? 0) + a.area_weight
    );
  }

  const areaResults: AreaResult[] = areas.map((a) => {
    const entry = scores[a.area_id];
    const score = effectiveScore(entry) ?? 1;
    const moduleWeight = normalizedModuleWeight(a.module_id);
    const weightSum = areaWeightSumByModule.get(a.module_id) ?? a.area_weight;
    const areaWeight = weightSum > 0 ? a.area_weight / weightSum : 0;
    const weighted_gap = (MAX_LEVEL - score) * areaWeight * moduleWeight;

    return {
      module_id: a.module_id,
      area_id: a.area_id,
      area_name: a.area_name,
      score,
      scored: entry != null,
      area_weight: areaWeight,
      module_weight: moduleWeight,
      weighted_gap,
    };
  });

  const moduleResults: ModuleResult[] = modules.map((m) => {
    const inModule = areaResults.filter((a) => a.module_id === m.module_id);
    const score = inModule.reduce((s, a) => s + a.score * a.area_weight, 0);
    return {
      module_id: m.module_id,
      module_name: m.module_name,
      module_weight: normalizedModuleWeight(m.module_id),
      score,
      band: maturityBand(score),
    };
  });

  const overall_score = moduleResults.reduce(
    (s, m) => s + m.score * m.module_weight,
    0
  );

  return {
    overall_score,
    overall_band: maturityBand(overall_score),
    modules: moduleResults,
    areas: areaResults,
  };
}

/** Areas below max level, sorted by weighted_gap descending - the single
 * cross-cutting priority order reused by both Recommendations and Planning. */
export function prioritizedGaps(result: DiagnosticResult): AreaResult[] {
  return result.areas
    .filter((a) => a.score < MAX_LEVEL)
    .sort((a, b) => b.weighted_gap - a.weighted_gap);
}

// Area.score is always an integer 1-5 (the effective score of that single
// scored unit - Areas have no children of their own to roll up).
export function targetLevelFor(area: AreaResult): number {
  return Math.min(area.score + 1, MAX_LEVEL);
}
