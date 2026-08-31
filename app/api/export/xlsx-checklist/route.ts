import { NextRequest, NextResponse } from "next/server";
import { buildChecklistWorkbook } from "@/lib/export/xlsxChecklist";
import type { ScoreEntry } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const scores = (body?.scores as Record<string, ScoreEntry> | undefined) ?? {};

  const wb = await buildChecklistWorkbook(scores);
  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="scoring-checklist.xlsx"',
    },
  });
}
