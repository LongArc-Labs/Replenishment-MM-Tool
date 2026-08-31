"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDiagnostic } from "@/state/DiagnosticContext";
import { prioritizedGaps, targetLevelFor } from "@/lib/aggregate";
import { getRecommendation, getBenchmarks } from "@/lib/kb";
import { findNextIncompleteModule } from "@/lib/flow";

const BAND_CLASS: Record<string, string> = {
  "Ad Hoc": "badge-adhoc",
  Basic: "badge-basic",
  Standardized: "badge-standardized",
  Managed: "badge-managed",
  "Best-in-Class": "badge-bestinclass",
};

export default function ResultPage() {
  const router = useRouter();
  const {
    result,
    resultStale,
    scores,
    selectedAreaIds,
    completedAreaIds,
    runDiagnosticNow,
  } = useDiagnostic();

  function reRun() {
    // A selection change since the last run can leave a newly-added area
    // unscored - send the user to finish that first rather than silently
    // rolling it up as an unscored (floor-score) area.
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
        <h1>Result</h1>
        <p className="lead">Run the diagnostic first to see your result.</p>
        <Link href="/diagnose" className="btn btn-primary">
          Go to Diagnose
        </Link>
      </main>
    );
  }

  const gaps = prioritizedGaps(result);
  const benchmarks = getBenchmarks();
  const defaultedAreas = result.areas.filter((a) => {
    const entry = scores[a.area_id];
    return entry?.auto_failed && entry.manual_score == null;
  });

  return (
    <main className="page reveal">
      <h1>Result</h1>

      {defaultedAreas.length > 0 && (
        <div
          className="card"
          style={{ borderColor: "var(--warn)", marginBottom: 16 }}
        >
          <p style={{ fontSize: 13.5 }}>
            <strong>
              {defaultedAreas.length} of {result.areas.length} area
              {defaultedAreas.length === 1 ? "" : "s"} defaulted to Level 1
            </strong>{" "}
            because the automatic scoring call failed, not because the
            underlying process was actually assessed that low. Treat the
            score below as provisional until{" "}
            {defaultedAreas.length === 1 ? "it is" : "those are"} manually
            scored or re-run.
          </p>
        </div>
      )}

      {resultStale && (
        <div className="card" style={{ borderColor: "var(--warn)", marginBottom: 16 }}>
          <p style={{ fontSize: 13.5 }}>
            <strong>This result is out of date.</strong> Your selected areas
            or answers have changed since this was run. Re-run the diagnostic
            to bring it up to date.
          </p>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn btn-secondary" onClick={reRun}>
              Re-run Diagnostic
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <div className="result-score-num">{result.overall_score.toFixed(2)}</div>
          <span className={`badge ${BAND_CLASS[result.overall_band]}`}>
            {result.overall_band}
          </span>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
          Based on {result.areas.length} selected area
          {result.areas.length === 1 ? "" : "s"}.
        </p>
      </div>

      <h2 style={{ marginTop: 28 }}>Identified Gaps &amp; Key Recommendations</h2>
      {gaps.length === 0 && (
        <div className="card">
          <p>All assessed areas are already at the maximum level.</p>
        </div>
      )}
      {gaps.map((g) => {
        const targetLevel = targetLevelFor(g);
        const rec = getRecommendation(g.area_id, targetLevel);
        const entry = scores[g.area_id];
        return (
          <div className="card" key={g.area_id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <h3>{g.area_name}</h3>
              <span className={`score-pill lvl-${g.score}`}>{g.score}</span>
            </div>
            {entry?.llm_rationale && (
              <p className="rationale-note" style={{ marginTop: 4 }}>
                {entry.llm_rationale}
              </p>
            )}
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
              Target: Level {targetLevel}
              {rec?.target_level_name ? ` (${rec.target_level_name})` : ""}
            </p>
            <p style={{ fontSize: 14, whiteSpace: "pre-line", marginTop: 8 }}>
              {rec?.recommended_tasks ?? "No recommendation authored yet."}
            </p>
          </div>
        );
      })}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 28 }}>
        <h2 style={{ margin: 0 }}>Snapshot</h2>
        <span className="badge badge-neutral">Not yet connected</span>
      </div>
      <p className="lead" style={{ marginBottom: 12 }}>
        Structure ready for live operational data - these are placeholders,
        not measurements. Values will populate automatically once a data
        connection is in place.
      </p>
      <div className="grid grid-3">
        {benchmarks.map((b) => (
          <div className="metric-card metric-card-blank" key={b.metric_id}>
            <div className="label">{b.metric_name}</div>
            <div className="value snapshot-blank">—</div>
            <div className="bic snapshot-blank">Best-in-Class: —</div>
          </div>
        ))}
      </div>

      <div className="btn-row">
        <Link href="/action-plan" className="btn btn-primary">
          Continue to Action Plan
        </Link>
      </div>
    </main>
  );
}
