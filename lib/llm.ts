import Groq from "groq-sdk";
import type { AreaRow } from "@/lib/types";

export interface AutoScoreResult {
  score: number;
  rationale: string;
}

const MODEL = "openai/gpt-oss-120b";

/**
 * Calls Groq to auto-score an observation against a subpoint's 5-level
 * rubric. Fails silently (returns null) on any error - missing API key,
 * network failure, malformed response - so the UI simply falls back to
 * manual-only scoring with no error surfaced to the user. Manual override
 * always wins over this value regardless.
 */
export async function scoreWithGroq(
  area: AreaRow,
  observation: string
): Promise<AutoScoreResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !observation.trim()) return null;

  try {
    const groq = new Groq({ apiKey });

    const rubric = area.score_descs
      .map((desc, i) => `Level ${i + 1}:\n${desc}`)
      .join("\n\n");

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a supply-chain maturity assessor. Given a 5-level rubric and a field observation, " +
            'pick the single best-fitting level and explain why in 1-3 sentences. Respond with strict JSON: {"score": <1-5 integer>, "rationale": "<string>"}.',
        },
        {
          role: "user",
          content: `Area: ${area.area_name}\n\nRubric:\n${rubric}\n\nObservation:\n${observation}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const score = Number(parsed.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) return null;

    return {
      score,
      rationale: String(parsed.rationale ?? ""),
    };
  } catch {
    return null;
  }
}
