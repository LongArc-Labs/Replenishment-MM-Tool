"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDiagnostic } from "@/state/DiagnosticContext";
import { prioritizedGaps, targetLevelFor } from "@/lib/aggregate";
import { getArea, getRecommendation } from "@/lib/kb";
import { findNextIncompleteModule } from "@/lib/flow";
import type { PlanStatus } from "@/lib/types";

const STATUS_LABELS: Record<PlanStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  done: "Done",
};

function parseTasks(text: string): { intro: string; bullets: string[] } {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const introLine = "To reach Level";
  const intro = lines.find((l) => l.startsWith(introLine)) ?? "";
  const body = lines.filter((l) => l !== intro);
  const bulletLines = body.filter((l) => l.startsWith("- "));
  // Some KB rows use "- " bullets, others are a single plain sentence -
  // fall back to treating each remaining line as its own action step.
  const bullets = (bulletLines.length > 0 ? bulletLines : body).map((l) =>
    l.startsWith("- ") ? l.slice(2) : l
  );
  return { intro, bullets };
}

export default function ActionPlanPage() {
  const router = useRouter();
  const {
    result,
    resultStale,
    planItems,
    updatePlanItem,
    selectedAreaIds,
    completedAreaIds,
    runDiagnosticNow,
  } = useDiagnostic();
  const [exporting, setExporting] = useState<string | null>(null);

  function reRun() {
    const nextIncomplete = findNextIncompleteModule(
      selectedAreaIds,
      completedAreaIds
    );
    if (nextIncomplete) {
      router.push(`/diagnose/score/${nextIncomplete.module_id}`);
    } else {
      runDiagnosticNow();
    }
  }

  if (!result) {
    return (
      <main className="page reveal">
        <h1>Action Plan</h1>
        <p className="lead">Run the diagnostic first to generate a plan.</p>
        <Link href="/diagnose" className="btn btn-primary">
          Go to Diagnose
        </Link>
      </main>
    );
  }

  const gaps = prioritizedGaps(result);

  async function download(path: string, filename: string, key: string) {
    setExporting(key);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, planItems }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  return (
    <main className="page reveal">
      <h1>Action Plan</h1>
      <p className="lead">
        A practical roadmap for closing each gap found in the diagnostic -
        ordered by priority, so the first card is where to start.
      </p>

      {resultStale && (
        <div className="card" style={{ borderColor: "var(--warn)", marginBottom: 16 }}>
          <p style={{ fontSize: 13.5 }}>
            <strong>This plan is out of date.</strong> Your selected areas or
            answers have changed since the diagnostic was run. Re-run it to
            regenerate this plan.
          </p>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn btn-secondary" onClick={reRun}>
              Re-run Diagnostic
            </button>
          </div>
        </div>
      )}

      {gaps.length === 0 && (
        <div className="card">
          <p>All assessed areas are already at the maximum level - nothing to plan.</p>
        </div>
      )}

      {gaps.map((g, i) => {
        const targetLevel = targetLevelFor(g);
        const rec = getRecommendation(g.area_id, targetLevel);
        const area = getArea(g.area_id);
        const { bullets } = parseTasks(rec?.recommended_tasks ?? "");
        const currentDesc = area?.score_descs[g.score - 1] ?? "";
        const outcomeDesc = area?.score_descs[targetLevel - 1] ?? "";

        return (
          <div className="roadmap-card" key={g.area_id}>
            <h3 style={{ marginBottom: 14 }}>{g.area_name}</h3>

            <div className="roadmap-block">
              <div className="roadmap-label">Problem</div>
              <p>{currentDesc}</p>
            </div>

            <div className="roadmap-block">
              <div className="roadmap-label">Recommendation</div>
              <p>
                Reach Level {targetLevel}
                {rec?.target_level_name ? ` — ${rec.target_level_name}` : ""}
              </p>
            </div>

            <div className="roadmap-block">
              <div className="roadmap-label">Action</div>
              <ol>
                {bullets.map((b, bi) => (
                  <li key={bi}>{b}</li>
                ))}
              </ol>
            </div>

            <div className="roadmap-block">
              <div className="roadmap-label">Sequence</div>
              <p>
                Step {i + 1} of {gaps.length}
              </p>
            </div>

            <div className="roadmap-block">
              <div className="roadmap-label">Expected Outcome</div>
              <p>{outcomeDesc}</p>
            </div>
          </div>
        );
      })}

      <h2 style={{ marginTop: 32 }}>Tracker</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Priority</th>
              <th>Area</th>
              <th>Owner</th>
              <th>Target Date</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {planItems.map((item, i) => (
              <tr key={item.id}>
                <td>{i + 1}</td>
                <td>
                  <strong>{item.area_name}</strong>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    {item.module_name}
                  </div>
                </td>
                <td>
                  <input
                    type="text"
                    value={item.owner}
                    placeholder="Owner"
                    onChange={(e) =>
                      updatePlanItem(item.id, { owner: e.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={item.target_date ?? ""}
                    onChange={(e) =>
                      updatePlanItem(item.id, {
                        target_date: e.target.value || null,
                      })
                    }
                  />
                </td>
                <td>
                  <select
                    value={item.status}
                    onChange={(e) =>
                      updatePlanItem(item.id, {
                        status: e.target.value as PlanStatus,
                      })
                    }
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={item.notes}
                    placeholder="Notes"
                    onChange={(e) =>
                      updatePlanItem(item.id, { notes: e.target.value })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 28 }}>Export</h2>
      <p className="lead" style={{ marginTop: -8, marginBottom: 16 }}>
        Each download is a snapshot of the tracker as it stands right now -
        editing owner, status, or notes afterward won&apos;t update a file
        you already downloaded. Export again to include later changes.
      </p>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button
          className="btn btn-secondary"
          disabled={exporting === "pdf"}
          onClick={() =>
            download("/api/export/pdf", "diagnostic-report.pdf", "pdf")
          }
        >
          {exporting === "pdf" ? "Generating…" : "Download PDF Report"}
        </button>
        <button
          className="btn btn-secondary"
          disabled={exporting === "checklist"}
          onClick={() =>
            download(
              "/api/export/xlsx-checklist",
              "scoring-checklist.xlsx",
              "checklist"
            )
          }
        >
          {exporting === "checklist"
            ? "Generating…"
            : "Download Scoring Checklist (xlsx)"}
        </button>
        <button
          className="btn btn-secondary"
          disabled={exporting === "plan"}
          onClick={() =>
            download("/api/export/xlsx-plan", "plan-tracker.xlsx", "plan")
          }
        >
          {exporting === "plan" ? "Generating…" : "Download Plan Tracker (xlsx)"}
        </button>
      </div>
    </main>
  );
}
