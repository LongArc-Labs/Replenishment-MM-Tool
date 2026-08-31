import areasData from "@/data/areas.json";
import modulesData from "@/data/modules.json";
import recommendationsData from "@/data/recommendations.json";
import benchmarksData from "@/data/benchmarks.json";
import weightProfilesData from "@/data/weight-profiles.json";
import quizData from "@/data/quiz.json";
import type {
  AreaRow,
  ModuleSummary,
  RecommendationRow,
  BenchmarkRow,
  WeightProfile,
  QuizQuestion,
} from "@/lib/types";

const areas = areasData as AreaRow[];
const modules = modulesData as ModuleSummary[];
const recommendations = recommendationsData as RecommendationRow[];
const benchmarks = benchmarksData as BenchmarkRow[];
const weightProfiles = weightProfilesData as WeightProfile[];
const quiz = quizData as QuizQuestion[];

export function getModules(): ModuleSummary[] {
  return modules;
}

export function getModule(moduleId: string): ModuleSummary | undefined {
  return modules.find((m) => m.module_id === moduleId);
}

export function getAreas(): AreaRow[] {
  return areas;
}

export function getAreasByModule(moduleId: string): AreaRow[] {
  return areas.filter((a) => a.module_id === moduleId);
}

export function getArea(areaId: string): AreaRow | undefined {
  return areas.find((a) => a.area_id === areaId);
}

export function getRecommendation(
  areaId: string,
  targetLevel: number
): RecommendationRow | undefined {
  return recommendations.find(
    (r) => r.area_id === areaId && r.target_level === targetLevel
  );
}

export function getRecommendationsForArea(areaId: string): RecommendationRow[] {
  return recommendations.filter((r) => r.area_id === areaId);
}

export function getBenchmarks(): BenchmarkRow[] {
  return benchmarks;
}

export function getBenchmark(metricId: string): BenchmarkRow | undefined {
  return benchmarks.find((b) => b.metric_id === metricId);
}

export function getWeightProfiles(): WeightProfile[] {
  return weightProfiles;
}

export function getQuiz(): QuizQuestion[] {
  return quiz;
}
