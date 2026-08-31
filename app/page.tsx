"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDiagnostic } from "@/state/DiagnosticContext";

const LEVELS = [
  {
    level: 1,
    name: "Ad Hoc",
    desc: "No defined or repeatable practice - decisions are reactive, case by case.",
  },
  {
    level: 2,
    name: "Basic",
    desc: "Some practices exist but execution is informal and inconsistent.",
  },
  {
    level: 3,
    name: "Standardized",
    desc: "Processes are documented and generally repeatable across the network.",
  },
  {
    level: 4,
    name: "Managed",
    desc: "Performance is actively monitored against targets and root-caused.",
  },
  {
    level: 5,
    name: "Best-in-Class",
    desc: "The process is continuously optimized and system-driven end to end.",
  },
];

const CAPABILITIES = [
  "Replenishment",
  "Dispatch Planning",
  "Vehicle Utilization",
  "Middle-Mile Cost",
  "Diagnostics",
];

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 7H12M12 7L7.5 2.5M12 7L7.5 11.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NetworkArt() {
  const nodes = [
    { x: 330, y: 70, r: 9 },
    { x: 450, y: 190, r: 13 },
    { x: 420, y: 370, r: 7 },
    { x: 270, y: 440, r: 11 },
  ];
  const hub = { x: 60, y: 260 };

  return (
    <svg
      className="hero-network"
      viewBox="0 0 500 500"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {/* warehouse hub */}
      <rect
        x={hub.x - 46}
        y={hub.y - 46}
        width="92"
        height="92"
        rx="10"
        fill="none"
        stroke="white"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      <rect x={hub.x - 30} y={hub.y - 30} width="24" height="24" rx="3" fill="white" fillOpacity="0.18" />
      <rect x={hub.x + 6} y={hub.y - 30} width="24" height="24" rx="3" fill="white" fillOpacity="0.12" />
      <rect x={hub.x - 30} y={hub.y + 6} width="24" height="24" rx="3" fill="white" fillOpacity="0.12" />
      <rect x={hub.x + 6} y={hub.y + 6} width="24" height="24" rx="3" fill="white" fillOpacity="0.18" />

      {nodes.map((n, i) => (
        <g key={i}>
          <line
            x1={hub.x}
            y1={hub.y}
            x2={n.x}
            y2={n.y}
            stroke="white"
            strokeOpacity="0.28"
            strokeWidth="1.2"
            strokeDasharray="2 7"
            className="flow-line"
          />
          <circle cx={n.x} cy={n.y} r={n.r} fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" />
          <circle cx={n.x} cy={n.y} r={n.r - 4 > 0 ? n.r - 4 : 2} fill="white" fillOpacity="0.15" />
        </g>
      ))}
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { reset, result, quizAnswers, selectedAreaIds, scores } =
    useDiagnostic();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasProgress =
    result != null ||
    Object.keys(quizAnswers).length > 0 ||
    selectedAreaIds.length > 0 ||
    Object.keys(scores).length > 0;

  function startNew() {
    reset();
    router.push("/diagnose/quiz");
  }

  function handleStartClick() {
    if (hasProgress) {
      setConfirmOpen(true);
    } else {
      startNew();
    }
  }

  useEffect(() => {
    if (!confirmOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen]);

  return (
    <main className="home-wrap reveal">
      <div className="hero">
        <div className="hero-bg" />

        <div className="hero-top">
          <span className="hero-eyebrow">
            LongArc Labs &middot; Replenishment + Middle-Mile Diagnostic
          </span>
        </div>

        <div className="hero-row">
          <div className="hero-mid">
            <h1 className="hero-headline">
              Know what&apos;s moving.
              <br />
              Know what&apos;s costing.
              <br />
              Know what to fix.
            </h1>
            <p className="hero-copy">
              Diagnose replenishment performance, dispatch efficiency and
              middle-mile cost across your network - identify the gaps,
              quantify the impact and turn them into actionable improvement
              plans.
            </p>
            <p className="hero-position">
              From operational gaps to measurable actions.
            </p>
            <button className="cta-pill" onClick={handleStartClick}>
              Start Diagnostic
              <span className="arrow-dot">
                <Arrow />
              </span>
            </button>
          </div>
          <div className="hero-art">
            <NetworkArt />
          </div>
        </div>

        <div className="hero-bottom">
          {CAPABILITIES.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      </div>

      <section className="scoring-section">
        <h2 className="scoring-head">How the Diagnostic Works</h2>
        <p className="scoring-lead">
          Every assessment is scored on a 5-point maturity scale to identify
          the current operating level, the gap to the desired state, and
          where improvement should be prioritized.
        </p>
        <div className="level-grid">
          {LEVELS.map((l) => (
            <div className={`level-card${l.level === 5 ? " final" : ""}`} key={l.level}>
              <div className="lvl-num">{l.level}</div>
              <div className="lvl-name">{l.name}</div>
              <div className="lvl-desc">{l.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <h2>Ready to diagnose your operation?</h2>
        <button className="cta-pill" onClick={handleStartClick}>
          Start Diagnostic
          <span className="arrow-dot">
            <Arrow />
          </span>
        </button>
      </section>

      {confirmOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="modal-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-confirm-title"
            aria-describedby="reset-confirm-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reset-confirm-title">Start a new diagnostic?</h3>
            <p id="reset-confirm-desc">
              {result
                ? "You have a completed result saved in this session."
                : "You have answers in progress in this session."}{" "}
              Starting a new diagnostic will permanently erase it.
            </p>
            <div className="btn-row" style={{ marginTop: 20 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setConfirmOpen(false);
                  startNew();
                }}
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
