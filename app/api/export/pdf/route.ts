import { NextRequest, NextResponse } from "next/server";
import { renderDiagnosticPdf } from "@/lib/export/pdfReport";
import type { DiagnosticResult, PlanItem } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const result = body?.result as DiagnosticResult | undefined;
  const planItems = (body?.planItems as PlanItem[] | undefined) ?? [];

  if (!result) {
    return NextResponse.json({ error: "result is required" }, { status: 400 });
  }

  const buffer = await renderDiagnosticPdf(result, planItems);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="diagnostic-report.pdf"',
    },
  });
}
