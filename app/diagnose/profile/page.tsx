"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getModules, getWeightProfiles } from "@/lib/kb";
import { computeProfileBlend } from "@/lib/weights";
import { useDiagnostic } from "@/state/DiagnosticContext";

export default function ProfilePage() {
  const router = useRouter();
  const {
    moduleWeights,
    weightsInitialized,
    applyRecommendedWeights,
    profileLocked,
    lockProfile,
    quizAnswers,
  } = useDiagnostic();
  const modules = getModules();

  // The actual "why" behind the deltas below: which archetype mix the quiz
  // answers landed on, and how much each one is represented. A module's
  // weight moved because the archetype that weighs it heavily moved.
  const profileMix = useMemo(() => {
    const blend = computeProfileBlend(quizAnswers);
    return getWeightProfiles()
      .map((p) => ({ name: p.name, pct: (blend[p.id] ?? 0) * 100 }))
      .filter((p) => p.pct >= 1)
      .sort((a, b) => b.pct - a.pct);
  }, [quizAnswers]);

  useEffect(() => {
    if (!weightsInitialized) applyRecommendedWeights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightsInitialized]);

  function continueToModules() {
    lockProfile();
    router.push("/diagnose/areas");
  }

  return (
    <main className="page reveal">
      <h1>Priority Weighting{profileLocked ? " (Verified)" : ""}</h1>
      <p className="lead">
        Module weight is set automatically from your Priorities answers, so
        it can&apos;t be edited by hand - this keeps scoring aligned with how
        you actually run the business.
      </p>

      {profileMix.length > 0 && (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--muted)",
            marginTop: -20,
            marginBottom: 24,
          }}
        >
          Your answers map to{" "}
          {profileMix.map((p, i) => (
            <span key={p.name}>
              {i > 0 && (i === profileMix.length - 1 ? " and " : ", ")}
              <strong style={{ color: "var(--foreground)" }}>
                {Math.round(p.pct)}% {p.name}
              </strong>
            </span>
          ))}
          . Weights below lean toward the modules that mix values most.
        </p>
      )}

      <div className="card">
        {modules.map((m) => {
          const weight = moduleWeights[m.module_id] ?? m.module_weight;
          const pct = Math.round(weight * 1000) / 10;
          const basePct = Math.round(m.module_weight * 1000) / 10;
          const deltaPp = Math.round((pct - basePct) * 10) / 10;
          const direction =
            deltaPp > 0.05 ? "up" : deltaPp < -0.05 ? "down" : "flat";
          const directionLabel =
            direction === "up"
              ? "Weight increased"
              : direction === "down"
                ? "Weight decreased"
                : "No change";
          return (
            <div className="weight-row" key={m.module_id}>
              <div className="name">{m.module_name}</div>
              <span
                className={`delta-arrow ${direction}`}
                role="img"
                aria-label={directionLabel}
              >
                {direction === "up" ? "↑" : direction === "down" ? "↓" : "–"}
              </span>
              <div className="pct">{pct.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>

      <div className="btn-row">
        {!profileLocked ? (
          <button className="btn btn-primary" onClick={continueToModules}>
            Continue to Select Areas
          </button>
        ) : (
          <>
            <span
              className="badge badge-bestinclass"
              style={{ alignSelf: "center" }}
            >
              Profile Locked
            </span>
            <button
              className="btn btn-primary"
              onClick={() => router.push("/diagnose/areas")}
            >
              Continue to Select Areas
            </button>
          </>
        )}
      </div>
    </main>
  );
}
