import { NextRequest, NextResponse } from "next/server";
import { getArea } from "@/lib/kb";
import { scoreWithGroq } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const areaId = body?.area_id;
  const observation = body?.observation;

  if (typeof areaId !== "string" || typeof observation !== "string") {
    return NextResponse.json(
      { error: "area_id and observation are required" },
      { status: 400 }
    );
  }

  const area = getArea(areaId);
  if (!area) {
    return NextResponse.json({ error: "unknown area_id" }, { status: 404 });
  }

  const result = await scoreWithGroq(area, observation);
  // result is null on any failure (no key, network error, bad response) -
  // that's a valid, expected response, not an error status.
  return NextResponse.json({ result });
}
