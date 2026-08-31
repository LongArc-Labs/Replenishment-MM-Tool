import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { getBenchmarks, getRecommendation } from "@/lib/kb";
import { targetLevelFor } from "@/lib/aggregate";
import type { DiagnosticResult, PlanItem } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  h1: { fontSize: 20, marginBottom: 4, fontWeight: 700 },
  h2: { fontSize: 14, marginTop: 16, marginBottom: 8, fontWeight: 700 },
  muted: { color: "#667085", marginBottom: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e7ec",
    paddingVertical: 6,
  },
  cell: { flex: 1 },
  badge: { fontSize: 9, color: "#2757d6" },
  card: {
    borderWidth: 1,
    borderColor: "#e4e7ec",
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
});

function ReportDoc({
  result,
  planItems,
}: {
  result: DiagnosticResult;
  planItems: PlanItem[];
}) {
  const benchmarks = getBenchmarks();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Replenishment + Middle-Mile Diagnostic</Text>
        <Text style={styles.muted}>
          Overall Score: {result.overall_score.toFixed(2)} / 5 -{" "}
          {result.overall_band}
        </Text>

        <Text style={styles.h2}>Module Scores</Text>
        {result.modules.map((m) => (
          <View style={styles.row} key={m.module_id}>
            <Text style={styles.cell}>{m.module_name}</Text>
            <Text style={{ ...styles.cell, textAlign: "right" }}>
              {m.score.toFixed(2)} - {m.band} (
              {(m.module_weight * 100).toFixed(1)}%)
            </Text>
          </View>
        ))}
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Snapshot</Text>
        <Text style={styles.muted}>
          Structure ready for live operational data - values will populate
          automatically once a data connection is in place.
        </Text>
        <Text style={styles.h2}>KPIs</Text>
        {benchmarks
          .filter((b) => b.group === "kpi")
          .map((b) => (
            <View style={styles.card} key={b.metric_id}>
              <Text>{b.metric_name}</Text>
              <Text style={styles.muted}>Current: — | Best-in-Class: —</Text>
            </View>
          ))}
        <Text style={styles.h2}>Operational</Text>
        {benchmarks
          .filter((b) => b.group === "operational")
          .map((b) => (
            <View style={styles.card} key={b.metric_id}>
              <Text>{b.metric_name}</Text>
              <Text style={styles.muted}>Current: — | Best-in-Class: —</Text>
            </View>
          ))}
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Recommendations & Plan</Text>
        {result.areas
          .filter((a) => a.score < 5)
          .sort((a, b) => b.weighted_gap - a.weighted_gap)
          .map((a) => {
            const rec = getRecommendation(a.area_id, targetLevelFor(a));
            return (
              <View style={styles.card} key={a.area_id}>
                <Text>
                  {a.area_name} (L{a.score} to L{targetLevelFor(a)})
                </Text>
                <Text style={styles.muted}>{rec?.recommended_tasks ?? ""}</Text>
              </View>
            );
          })}

        <Text style={styles.h2}>Plan Tracker</Text>
        {planItems.map((item) => (
          <View style={styles.row} key={item.id}>
            <Text style={styles.cell}>{item.area_name}</Text>
            <Text style={styles.cell}>{item.owner || "-"}</Text>
            <Text style={styles.cell}>{item.target_date ?? "-"}</Text>
            <Text style={styles.cell}>{item.status}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function renderDiagnosticPdf(
  result: DiagnosticResult,
  planItems: PlanItem[]
): Promise<Buffer> {
  return renderToBuffer(<ReportDoc result={result} planItems={planItems} />);
}
