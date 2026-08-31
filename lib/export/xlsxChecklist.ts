import ExcelJS from "exceljs";
import { getAreas, getModule } from "@/lib/kb";
import { effectiveScore } from "@/lib/types";
import type { ScoreEntry } from "@/lib/types";

const COLUMNS = [
  { header: "Module ID", key: "module_id", width: 10 },
  { header: "Module", key: "module_name", width: 32 },
  { header: "Area ID", key: "area_id", width: 10 },
  { header: "Area", key: "area_name", width: 40 },
  { header: "Score (1-5)", key: "score", width: 12 },
  { header: "Scored By", key: "scored_by", width: 14 },
  { header: "Observation", key: "observation", width: 60 },
  { header: "Additional Observations", key: "additional_observations", width: 40 },
  { header: "LLM Rationale", key: "llm_rationale", width: 50 },
];

/** Read-only report of the scoring for this run - manual overrides always
 * win over the LLM score, per the score picker on the scoring screen. */
export async function buildChecklistWorkbook(
  scores: Record<string, ScoreEntry>
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Scoring Checklist");
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };

  for (const area of getAreas()) {
    const entry = scores[area.area_id];
    const score = effectiveScore(entry);
    sheet.addRow({
      module_id: area.module_id,
      module_name: getModule(area.module_id)?.module_name ?? area.module_id,
      area_id: area.area_id,
      area_name: area.area_name,
      score: score ?? "",
      scored_by: entry
        ? entry.manual_score != null
          ? "Manual"
          : entry.auto_failed
            ? "Defaulted (auto-score unavailable)"
            : "LLM"
        : "",
      observation: entry?.observation ?? "",
      additional_observations: entry?.additional_observations ?? "",
      llm_rationale: entry?.llm_rationale ?? "",
    });
  }

  return wb;
}
