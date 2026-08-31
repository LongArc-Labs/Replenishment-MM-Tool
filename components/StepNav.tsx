"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDiagnostic } from "@/state/DiagnosticContext";
import { resolveDiagnoseDestination } from "@/lib/flow";

const STEPS = [
  { href: "/", label: "Home" },
  { href: "/diagnose", label: "Diagnose" },
  { href: "/result", label: "Result" },
  { href: "/action-plan", label: "Action Plan" },
];

export function TopBar() {
  const pathname = usePathname();
  const { result, quizComplete, profileLocked, selectedAreaIds, completedAreaIds } =
    useDiagnostic();

  function isReachable(href: string): boolean {
    if (href === "/result" || href === "/action-plan") return result != null;
    return true;
  }

  // Send "Diagnose" straight to wherever the user actually is in the flow
  // instead of always through the /diagnose redirect page - that page still
  // exists (and is still used here) for the one case where the destination
  // is the result itself, since only it knows to (re)run the diagnostic
  // before landing there.
  const diagnoseDestination = resolveDiagnoseDestination({
    quizComplete,
    profileLocked,
    selectedAreaIds,
    completedAreaIds,
  });
  const diagnoseHref =
    diagnoseDestination === "/result" ? "/diagnose" : diagnoseDestination;

  return (
    <div className="nav-shell">
      <nav className="nav-float">
        <Link href="/" className="nav-brand">
          LongArc
        </Link>
        <div className="nav-links">
          {STEPS.map((s) => {
            const active =
              s.href === "/"
                ? pathname === "/"
                : pathname.startsWith(s.href);
            const reachable = isReachable(s.href);

            if (!reachable) {
              return (
                <span
                  key={s.href}
                  className="nav-link disabled"
                  title="Run the diagnostic to unlock"
                >
                  {s.label}
                </span>
              );
            }

            return (
              <Link
                key={s.href}
                href={s.href === "/diagnose" ? diagnoseHref : s.href}
                className={`nav-link${active ? " active" : ""}`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
