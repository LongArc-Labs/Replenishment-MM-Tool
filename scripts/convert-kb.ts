// One-time conversion: reads the KB xlsx and emits the bundled JSON files
// that the app reads at runtime (see lib/kb.ts). Re-run with `npm run convert-kb`
// whenever the source workbook changes.
//
// KB <-> app mapping (see lib/types.ts header comment for the full rationale):
//   KB module_id (constant "RM_V1")  -> dropped, not useful for navigation
//   KB area_id / area_name / area_weight (RM1..RM14)   -> app Module
//   KB subpoint_id / subpoint_name / subpoint_weight (RM1.1..RM14.3) -> app Area
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import type { AreaRow, RecommendationRow, ModuleSummary } from "../lib/types";

const KB_PATH = path.join(
  __dirname,
  "..",
  "240826_LongArc Labs_Replenishment + Middle Mile KB.xlsx"
);
const DATA_DIR = path.join(__dirname, "..", "data");

function splitQuestions(blob: string | undefined): string[] {
  if (!blob) return [];
  return blob
    .split(/(?<=\?)\s+(?=[A-Z])/)
    .map((q) => q.trim())
    .filter(Boolean);
}

function main() {
  const wb = XLSX.readFile(KB_PATH);

  // --- Master sheet -> areas (app-Module = KB-area, app-Area = KB-subpoint) ---
  const masterSheet = wb.Sheets["Master"];
  const masterRows: any[] = XLSX.utils.sheet_to_json(masterSheet, {
    defval: null,
  });

  const activeRows = masterRows.filter((r) => r.status === "active");

  // KB area_weight (e.g. 0.12 for RM1) already sums to 1.0 across all 14
  // KB-areas -> that becomes our module_weight directly.
  // KB subpoint_weight (e.g. 0.024) is a fraction of the KB-area_weight, not
  // of 1.0 globally -> normalize it into a per-module area_weight share
  // (sums to 1.0 within each module) for the Weightage Assignment screen.
  const areas: AreaRow[] = activeRows.map((r) => ({
    module_id: r.area_id,
    module_name: r.area_name,
    area_id: r.subpoint_id,
    area_name: r.subpoint_name,
    area_weight: r.subpoint_weight / r.area_weight,
    score_descs: [
      r.score_1_desc,
      r.score_2_desc,
      r.score_3_desc,
      r.score_4_desc,
      r.score_5_desc,
    ],
    indicative_scoring_questions: splitQuestions(
      r.indicative_scoring_questions
    ),
    primary_kpi_metric: r.primary_kpi_metric ?? "",
  }));

  // --- Derived module summaries ---
  const moduleMap = new Map<string, ModuleSummary>();
  for (const r of activeRows) {
    if (!moduleMap.has(r.area_id)) {
      moduleMap.set(r.area_id, {
        module_id: r.area_id,
        module_name: r.area_name,
        module_weight: r.area_weight,
        area_ids: [],
      });
    }
    moduleMap.get(r.area_id)!.area_ids.push(r.subpoint_id);
  }
  const modules = Array.from(moduleMap.values());

  // --- Recommendations sheet ---
  // KB rows key by (constant module_id, subpoint_id, target_level). subpoint_id
  // is globally unique, so join against `areas` to recover our module_id (the
  // KB-area/RM1-RM14 code) for consistent grouping.
  const areaToModule = new Map(areas.map((a) => [a.area_id, a.module_id]));
  const recSheet = wb.Sheets["Recommendations"];
  const recRows: any[] = XLSX.utils.sheet_to_json(recSheet, { defval: null });
  const recommendations: RecommendationRow[] = recRows
    .filter((r) => r.subpoint_id && r.target_level)
    .map((r) => ({
      module_id: areaToModule.get(r.subpoint_id) ?? r.module_id,
      area_id: r.subpoint_id,
      target_level: r.target_level,
      target_level_name: r.target_level_name,
      recommended_tasks: r.recommended_tasks,
    }));

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, "areas.json"),
    JSON.stringify(areas, null, 2)
  );
  fs.writeFileSync(
    path.join(DATA_DIR, "modules.json"),
    JSON.stringify(modules, null, 2)
  );
  fs.writeFileSync(
    path.join(DATA_DIR, "recommendations.json"),
    JSON.stringify(recommendations, null, 2)
  );

  const moduleWeightSum = modules.reduce((s, m) => s + m.module_weight, 0);
  console.log(`Areas (scored units): ${areas.length}`);
  console.log(`Modules (nav groups): ${modules.length}`);
  console.log(`Module weight sum (expect 1.0): ${moduleWeightSum.toFixed(4)}`);
  for (const m of modules) {
    const share = m.area_ids.reduce((s, aid) => {
      const a = areas.find((x) => x.area_id === aid)!;
      return s + a.area_weight;
    }, 0);
    if (Math.abs(share - 1) > 1e-4) {
      console.warn(
        `  WARNING: ${m.module_id} area_weight shares sum to ${share.toFixed(4)}, expected 1.0`
      );
    }
  }
  console.log(`Recommendation rows: ${recommendations.length}`);
}

main();
