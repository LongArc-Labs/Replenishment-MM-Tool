import ExcelJS from "exceljs";
import type { PlanItem } from "@/lib/types";

export async function buildPlanTrackerWorkbook(
  planItems: PlanItem[]
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Plan Tracker");
  sheet.columns = [
    { header: "Priority", key: "priority", width: 10 },
    { header: "Module", key: "module_name", width: 32 },
    { header: "Area", key: "area_name", width: 40 },
    { header: "Current Level", key: "current_score", width: 14 },
    { header: "Target Level", key: "target_level", width: 14 },
    { header: "Weighted Gap", key: "weighted_gap", width: 14 },
    { header: "Recommended Tasks", key: "recommended_tasks", width: 60 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Target Date", key: "target_date", width: 14 },
    { header: "Status", key: "status", width: 16 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };

  planItems.forEach((item, i) => {
    sheet.addRow({
      priority: i + 1,
      module_name: item.module_name,
      area_name: item.area_name,
      current_score: item.current_score,
      target_level: item.target_level,
      weighted_gap: Number(item.weighted_gap.toFixed(4)),
      recommended_tasks: item.recommended_tasks,
      owner: item.owner,
      target_date: item.target_date ?? "",
      status: item.status,
      notes: item.notes,
    });
  });

  return wb;
}
