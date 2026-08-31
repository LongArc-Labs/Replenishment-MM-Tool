import { getModules, getAreasByModule } from "@/lib/kb";
import type { ModuleSummary } from "@/lib/types";

function selectedModules(selectedAreaIds: string[]): ModuleSummary[] {
  const selected = new Set(selectedAreaIds);
  return getModules().filter((m) => {
    const ids = getAreasByModule(m.module_id).map((a) => a.area_id);
    return ids.length > 0 && ids.every((id) => selected.has(id));
  });
}

/** The selected module (if any) that still has at least one unscored area -
 * i.e. where "Continue Assessment" / "Resume" should send the user. */
export function findNextIncompleteModule(
  selectedAreaIds: string[],
  completedAreaIds: string[]
): ModuleSummary | null {
  return (
    selectedModules(selectedAreaIds).find(
      (m) =>
        !getAreasByModule(m.module_id).every((a) =>
          completedAreaIds.includes(a.area_id)
        )
    ) ?? null
  );
}

interface DiagnoseFlowState {
  quizComplete: boolean;
  profileLocked: boolean;
  selectedAreaIds: string[];
  completedAreaIds: string[];
}

/** Where the "Diagnose" entry point (and nav tab) should send the user -
 * wherever they actually are in the flow, never always back to the start.
 * A "/result" destination means everything is answered but not (re)run yet -
 * the caller is responsible for calling runDiagnosticNow() before or while
 * navigating there. */
export function resolveDiagnoseDestination(state: DiagnoseFlowState): string {
  if (!state.quizComplete) return "/diagnose/quiz";
  if (!state.profileLocked) return "/diagnose/profile";
  if (selectedModules(state.selectedAreaIds).length === 0) return "/diagnose/areas";
  const nextIncomplete = findNextIncompleteModule(
    state.selectedAreaIds,
    state.completedAreaIds
  );
  if (nextIncomplete) return `/diagnose/score/${nextIncomplete.module_id}`;
  return "/result";
}
