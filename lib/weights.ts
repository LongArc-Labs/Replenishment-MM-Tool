import { getWeightProfiles, getQuiz, getModules } from "@/lib/kb";
import type { QuizAnswers, WeightProfileId } from "@/lib/types";

/**
 * How much each company archetype (weight profile) is represented in the
 * quiz answers given so far - sums to 1. This is the actual "why" behind
 * blendWeights()'s output: a module's weight moved because the archetype
 * mix that owns a high weight for it moved, not some opaque black box.
 * Each selected option carries an affinity score per profile; affinities
 * are summed across all answers, then normalized.
 */
export function computeProfileBlend(
  answers: QuizAnswers
): Record<string, number> {
  const profiles = getWeightProfiles();
  const quiz = getQuiz();

  const affinityTotals: Partial<Record<WeightProfileId, number>> = {};
  for (const q of quiz) {
    const selected = answers[q.id] ?? [];
    for (const optId of selected) {
      const opt = q.options.find((o) => o.id === optId);
      if (!opt) continue;
      for (const [profileId, score] of Object.entries(opt.affinity)) {
        const key = profileId as WeightProfileId;
        affinityTotals[key] = (affinityTotals[key] ?? 0) + (score ?? 0);
      }
    }
  }

  const totalAffinity = Object.values(affinityTotals).reduce(
    (s, v) => s + (v ?? 0),
    0
  );

  // No signal yet (quiz incomplete) -> fall back to an even blend of all
  // profiles, which is close to the raw KB base weights.
  const profileBlend: Record<string, number> = {};
  if (totalAffinity <= 0) {
    const even = 1 / profiles.length;
    for (const p of profiles) profileBlend[p.id] = even;
  } else {
    for (const p of profiles) {
      profileBlend[p.id] = (affinityTotals[p.id] ?? 0) / totalAffinity;
    }
  }
  return profileBlend;
}

/**
 * Blend quiz answers into a per-module weight override: the blended module
 * weight is the profile-blend-weighted average of each profile's
 * module_weights map, renormalized to sum to 1 across all modules.
 */
export function blendWeights(answers: QuizAnswers): Record<string, number> {
  const profiles = getWeightProfiles();
  const modules = getModules();
  const profileBlend = computeProfileBlend(answers);

  const raw: Record<string, number> = {};
  for (const m of modules) raw[m.module_id] = 0;
  for (const p of profiles) {
    const blend = profileBlend[p.id] ?? 0;
    for (const [moduleId, weight] of Object.entries(p.module_weights)) {
      raw[moduleId] = (raw[moduleId] ?? 0) + blend * weight;
    }
  }

  return renormalize(raw);
}

export function renormalize(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  if (total <= 0) {
    const even = 1 / Object.keys(weights).length;
    return Object.fromEntries(Object.keys(weights).map((k) => [k, even]));
  }
  return Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, v / total])
  );
}
