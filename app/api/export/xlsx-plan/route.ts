import { NextRequest, NextResponse } from "next/server";
import { buildPlanTrackerWorkbook } from "@/lib/export/xlsxPlanTracker";
import type { PlanItem } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const planItems = (body?.planItems as PlanItem[] | undefined) ?? [];

  const wb = await buildPlanTrackerWorkbook(planItems);
  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plan-tracker.xlsx"',
    },
  });
}
