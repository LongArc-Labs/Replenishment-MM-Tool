"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getModules, getAreasByModule } from "@/lib/kb";
import { useDiagnostic } from "@/state/DiagnosticContext";
import { normalizedModuleWeights } from "@/lib/aggregate";
import { findNextIncompleteModule } from "@/lib/flow";

export default function AreasPage() {
  const router = useRouter();
  const modules = getModules();
  const {
    isModuleSelected,
    toggleModuleSelection,
    selectedAreaIds,
    completedAreaIds,
    moduleWeights,
    runDiagnosticNow,
  } = useDiagnostic();
  const [pulsingId, setPulsingId] = useState<string | null>(null);
  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedModules = modules.filter((m) => isModuleSelected(m.module_id));
  const completedModuleCount = selectedModules.filter((m) =>
    getAreasByModule(m.module_id).every((a) =>
      completedAreaIds.includes(a.area_id)
    )
  ).length;

  // The weight actually applied to each selected module once run - renormalized
  // to just the current selection, same math as the real rollup. Shown instead
  // of the raw pre-selection blend so the number on screen matches what
  // actually counts, not a figure that silently changes meaning once run.
  const effectiveWeights = normalizedModuleWeights(
    moduleWeights,
    selectedModules.map((m) => m.module_id)
  );

  function handleToggle(moduleId: string) {
    const willSelect = !isModuleSelected(moduleId);
    toggleModuleSelection(moduleId);
    if (willSelect) {
      setPulsingId(moduleId);
      if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
      pulseTimeout.current = setTimeout(() => setPulsingId(null), 600);
    }
  }

  function handleSelectAll() {
    for (const m of modules) {
      if (!isModuleSelected(m.module_id)) toggleModuleSelection(m.module_id);
    }
  }

  function handleClear() {
    for (const m of modules) {
      if (isModuleSelected(m.module_id)) toggleModuleSelection(m.module_id);
    }
  }

  function startAssessment() {
    const nextIncompleteModule = findNextIncompleteModule(
      selectedAreaIds,
      completedAreaIds
    );
    if (nextIncompleteModule) {
      router.push(`/diagnose/score/${nextIncompleteModule.module_id}`);
    } else {
      runDiagnosticNow();
      router.push("/result");
    }
  }

  return (
    <main className="page reveal">
      <h1>Select Areas</h1>
      <p className="lead">
        Choose only the areas relevant to what you want assessed right now.
        Selecting an area includes everything within it - you&apos;ll answer
        all of its questions together on one screen, then move to the next
        selected area.
      </p>

      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
        {selectedModules.length} of {modules.length} areas selected
      </p>

      <div className="select-toolbar">
        <button className="btn btn-secondary" onClick={handleSelectAll}>
          Select all
        </button>
        <button className="btn btn-secondary" onClick={handleClear}>
          Clear
        </button>
      </div>

      <div className="select-grid">
        {modules.map((m, i) => {
          const areas = getAreasByModule(m.module_id);
          const selected = isModuleSelected(m.module_id);
          const selectedCount = selected ? areas.length : 0;
          const weight = selected
            ? (effectiveWeights[m.module_id] ?? 0)
            : (moduleWeights[m.module_id] ?? m.module_weight);
          const weightPct = Math.round(weight * 1000) / 10;
          return (
            <label
              className={`select-card${selected ? " selected" : ""}`}
              key={m.module_id}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => handleToggle(m.module_id)}
              />
              {pulsingId === m.module_id && (
                <span className="ring" key={`ring-${Date.now()}`} />
              )}
              <div className="select-card-top">
                <span className="tag">{m.module_id}</span>
                {/* Decorative only - the checkbox above already carries the
                    real, accessible checked/unchecked state. */}
                <span className="chev" aria-hidden="true">
                  {selected ? "✓" : "›"}
                </span>
              </div>
              <div className="select-card-title">{m.module_name}</div>
              <div className="select-card-meta">
                <span>
                  {selectedCount}/{areas.length} selected
                </span>
                <span className="weight" title={
                  selected
                    ? "Weight actually applied given your current selection"
                    : "Baseline weight - recalculated once selected"
                }>
                  weight {weightPct}%{selected ? " (this run)" : ""}
                </span>
              </div>
            </label>
          );
        })}
      </div>

      <div className="btn-row">
        <button
          className="btn btn-primary"
          disabled={selectedModules.length === 0}
          onClick={startAssessment}
        >
          {selectedModules.length === 0
            ? "Select at least one area"
            : completedModuleCount === selectedModules.length
              ? "View Result"
              : "Start Assessment"}
        </button>
      </div>
    </main>
  );
}
