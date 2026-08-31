"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDiagnostic } from "@/state/DiagnosticContext";
import { resolveDiagnoseDestination } from "@/lib/flow";

/** Entry point for the "Diagnose" nav tab when a direct route (e.g. a
 * bookmark, or the nav tab's own "all done" case - see StepNav) is needed -
 * routes to wherever the user actually is in the flow rather than always
 * restarting from the quiz. */
export default function DiagnosePage() {
  const router = useRouter();
  const {
    quizComplete,
    profileLocked,
    selectedAreaIds,
    completedAreaIds,
    runDiagnosticNow,
  } = useDiagnostic();

  useEffect(() => {
    const destination = resolveDiagnoseDestination({
      quizComplete,
      profileLocked,
      selectedAreaIds,
      completedAreaIds,
    });
    if (destination === "/result") runDiagnosticNow();
    router.replace(destination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="page">
      <p className="lead">Loading your diagnostic…</p>
    </main>
  );
}
