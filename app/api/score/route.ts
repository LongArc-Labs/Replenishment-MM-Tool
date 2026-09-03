import { NextRequest, NextResponse } from "next/server";
import { getArea, getBenchmarks } from "@/lib/kb";
import { scoreWithGroq } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const areaId = body?.area_id;
  const observation = body?.observation;
  // Attempt 2 (the client's one retry) runs at a nonzero temperature - a
  // repeat of the exact same request at temperature 0 fails identically to
  // the first, so it isn't a real second chance.
  const attempt = Number(body?.attempt) === 2 ? 2 : 1;

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

  const benchmarks = getBenchmarks().filter((b) => b.linked_area_id === areaId);
  const temperature = attempt === 2 ? 0.4 : 0;
  const result = await scoreWithGroq(area, observation, benchmarks, temperature);
  // result is null on any failure (no key, network error, bad response) -
  // that's a valid, expected response, not an error status.
  return NextResponse.json({ result });
}
