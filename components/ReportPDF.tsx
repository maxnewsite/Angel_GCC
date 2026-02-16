import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { AnalysisReport, Submission } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1e293b" },
  coverPage: { padding: 40, fontFamily: "Helvetica", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 28, fontFamily: "Helvetica-Bold", color: "#1d4ed8", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#64748b", textAlign: "center", marginTop: 8 },
  startupName: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0f172a", textAlign: "center", marginTop: 40 },
  date: { fontSize: 10, color: "#94a3b8", textAlign: "center", marginTop: 12 },
  scoreBox: {
    marginTop: 30,
    padding: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#1d4ed8",
    alignItems: "center",
    alignSelf: "center",
    width: 200,
  },
  scoreNumber: { fontSize: 48, fontFamily: "Helvetica-Bold" },
  scoreLabel: { fontSize: 12, color: "#64748b", marginTop: 4 },
  sectionTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#1d4ed8", marginBottom: 10, marginTop: 20 },
  sectionSubtitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 6, marginTop: 12 },
  text: { fontSize: 10, lineHeight: 1.5, color: "#334155" },
  boldText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  criterionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  criterionName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#334155", width: "40%" },
  criterionScore: { fontSize: 12, fontFamily: "Helvetica-Bold", width: "10%", textAlign: "center" },
  criterionRationale: { fontSize: 9, color: "#64748b", width: "48%" },
  bar: { height: 6, borderRadius: 3, marginTop: 2, marginBottom: 6 },
  flagBox: { padding: 8, borderRadius: 4, marginBottom: 6, borderWidth: 1 },
  greenFlag: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  redFlag: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  flagCategory: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  flagText: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  flagEvidence: { fontSize: 9, color: "#64748b", marginTop: 2 },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#94a3b8" },
  listItem: { fontSize: 10, lineHeight: 1.5, color: "#334155", marginBottom: 2 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 10 },
});

function getScoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#f97316";
  if (score >= 40) return "#eab308";
  return "#dc2626";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "RECOMMEND TO IC";
  if (score >= 60) return "DEEP DIVE REQUIRED";
  if (score >= 40) return "REQUEST MORE INFO";
  return "STRONG REJECT";
}

interface ReportPDFProps {
  submission: Submission;
  report: AnalysisReport;
}

export function ReportPDF({ submission, report }: ReportPDFProps) {
  const scoreColor = getScoreColor(report.overall_score);
  const scoreLabel = getScoreLabel(report.overall_score);
  const marketResearch = report.market_research as {
    market_size?: string;
    competitors?: string[];
    trends?: string[];
    summary?: string;
    sources?: string[];
  };

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.title}>Angel AI Analyst</Text>
        <Text style={styles.subtitle}>Investment Analysis Report</Text>
        <Text style={styles.startupName}>{submission.startup_name}</Text>
        {submission.sector && (
          <Text style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 8 }}>
            {submission.sector}
          </Text>
        )}
        <View style={[styles.scoreBox, { borderColor: scoreColor }]}>
          <Text style={[styles.scoreNumber, { color: scoreColor }]}>{report.overall_score}</Text>
          <Text style={styles.scoreLabel}>/100</Text>
          <Text style={[{ fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 4, color: scoreColor }]}>
            {scoreLabel}
          </Text>
        </View>
        <Text style={[styles.date, { marginTop: 30 }]}>
          Generated: {new Date(report.generated_at).toLocaleDateString()}
        </Text>
        <View style={styles.footer}>
          <Text>Angel AI Analyst - Confidential</Text>
          <Text>Page 1</Text>
        </View>
      </Page>

      {/* Executive Summary */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Executive Summary</Text>
        <Text style={[styles.boldText, { marginBottom: 8 }]}>{report.recommendation}</Text>
        <Text style={styles.text}>{report.executive_summary}</Text>

        <Text style={styles.sectionTitle}>7-Criteria Screening Analysis</Text>
        {report.criteria_scores.map((cs, i) => (
          <View key={i} wrap={false}>
            <View style={styles.criterionRow}>
              <Text style={styles.criterionName}>
                {cs.criterion} ({cs.weight}x)
              </Text>
              <Text style={[styles.criterionScore, { color: cs.score >= 4 ? "#16a34a" : cs.score >= 3 ? "#eab308" : "#dc2626" }]}>
                {cs.score}/5
              </Text>
              <Text style={styles.criterionRationale}>{cs.rationale}</Text>
            </View>
          </View>
        ))}
        <View style={styles.footer}>
          <Text>Angel AI Analyst - Confidential</Text>
          <Text>Page 2</Text>
        </View>
      </Page>

      {/* Flags */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Investment Flags (YC Framework)</Text>

        <Text style={[styles.sectionSubtitle, { color: "#16a34a" }]}>
          Green Flags ({report.green_flags.length})
        </Text>
        {report.green_flags.map((flag, i) => (
          <View key={i} style={[styles.flagBox, styles.greenFlag]} wrap={false}>
            <Text style={[styles.flagCategory, { color: "#16a34a" }]}>{flag.category}</Text>
            <Text style={[styles.flagText, { color: "#166534" }]}>{flag.flag}</Text>
            <Text style={styles.flagEvidence}>{flag.evidence}</Text>
          </View>
        ))}

        <Text style={[styles.sectionSubtitle, { color: "#dc2626" }]}>
          Red Flags ({report.red_flags.length})
        </Text>
        {report.red_flags.map((flag, i) => (
          <View key={i} style={[styles.flagBox, styles.redFlag]} wrap={false}>
            <Text style={[styles.flagCategory, { color: "#dc2626" }]}>{flag.category}</Text>
            <Text style={[styles.flagText, { color: "#991b1b" }]}>{flag.flag}</Text>
            <Text style={styles.flagEvidence}>{flag.evidence}</Text>
          </View>
        ))}
        <View style={styles.footer}>
          <Text>Angel AI Analyst - Confidential</Text>
          <Text>Page 3</Text>
        </View>
      </Page>

      {/* Market Research */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Market Research</Text>

        {marketResearch.market_size && (
          <View>
            <Text style={styles.sectionSubtitle}>Market Size</Text>
            <Text style={styles.text}>{marketResearch.market_size}</Text>
          </View>
        )}

        {marketResearch.competitors && marketResearch.competitors.length > 0 && (
          <View>
            <Text style={styles.sectionSubtitle}>Competitors</Text>
            {marketResearch.competitors.map((c, i) => (
              <Text key={i} style={styles.listItem}>&#8226; {c}</Text>
            ))}
          </View>
        )}

        {marketResearch.trends && marketResearch.trends.length > 0 && (
          <View>
            <Text style={styles.sectionSubtitle}>Market Trends</Text>
            {marketResearch.trends.map((t, i) => (
              <Text key={i} style={styles.listItem}>&#8226; {t}</Text>
            ))}
          </View>
        )}

        {marketResearch.summary && (
          <View>
            <Text style={styles.sectionSubtitle}>Research Summary</Text>
            <Text style={styles.text}>{marketResearch.summary}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>Angel AI Analyst - Confidential</Text>
          <Text>Page 4</Text>
        </View>
      </Page>

      {/* Detailed Analysis */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Detailed Analysis</Text>
        <Text style={styles.text}>{report.detailed_rationale}</Text>

        <View style={[styles.divider, { marginTop: 20 }]} />
        <Text style={{ fontSize: 8, color: "#94a3b8", textAlign: "center", marginTop: 10 }}>
          This report was generated by Angel AI Analyst using Claude AI.
          It is intended for informational purposes only and does not constitute investment advice.
        </Text>
        <View style={styles.footer}>
          <Text>Angel AI Analyst - Confidential</Text>
          <Text>Page 5</Text>
        </View>
      </Page>
    </Document>
  );
}
