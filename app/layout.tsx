import type { Metadata } from "next";
import "./globals.css";
import { DiagnosticProvider } from "@/state/DiagnosticContext";
import { TopBar } from "@/components/StepNav";

export const metadata: Metadata = {
  title: "Replenishment + Middle-Mile Diagnostic",
  description:
    "Maturity diagnostic for replenishment planning and middle-mile logistics",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <DiagnosticProvider>
          <TopBar />
          <div id="main-content">{children}</div>
        </DiagnosticProvider>
      </body>
    </html>
  );
}
