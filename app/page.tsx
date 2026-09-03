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
        <video
          className="hero-bg-video"
          src="/video/hero-bg.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          ref={(el) => {
            // React doesn't reliably set the `muted` PROPERTY from the JSX
            // attribute on <video> - without it, Chrome's autoplay policy
            // silently blocks the whole element from loading.
            if (el) el.muted = true;
          }}
        />
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
              Diagnose replenishment, dispatch and middle-mile cost across
              your network - find the gaps, size the impact, fix what
              matters.
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
