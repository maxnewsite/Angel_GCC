import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import PDFDocument from "pdfkit";
import type { Submission, AnalysisReport, CriterionScore, Flag } from "@/lib/types";

export const runtime = "nodejs";

// ── helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#f97316";
  if (score >= 40) return "#eab308";
  return "#dc2626";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "RECOMMEND TO IC";
  if (score >= 60) return "DEEP DIVE REQUIRED";
  if (score >= 40) return "REQUEST MORE INFO";
  return "STRONG REJECT";
}

function hex(color: string): string {
  return color.startsWith("#") ? color : "#000000";
}

function buildPDF(submission: Submission, report: AnalysisReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 96; // usable width
    const overallScore = report.overall_score ?? 0;
    const color = hex(scoreColor(overallScore));
    const label = scoreLabel(overallScore);
    const criteria: CriterionScore[] = report.criteria_scores ?? [];
    const green: Flag[] = report.green_flags ?? [];
    const red: Flag[] = report.red_flags ?? [];
    const mkt = (report.market_research ?? {}) as {
      market_size?: string;
      competitors?: string[];
      trends?: string[];
      summary?: string;
    };

    // ── PAGE 1: Cover ──────────────────────────────────────────────────────
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("#1d4ed8")
      .text("Angel AI Analyst", { align: "center" });

    doc
      .font("Helvetica")
      .fontSize(14)
      .fillColor("#64748b")
      .text("Investment Analysis Report", { align: "center" });

    doc.moveDown(3);

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#0f172a")
      .text(submission.startup_name, { align: "center" });

    if (submission.sector) {
      doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor("#64748b")
        .text(submission.sector, { align: "center" });
    }

    // Score box
    doc.moveDown(2);
    const boxW = 180;
    const boxX = (doc.page.width - boxW) / 2;
    const boxY = doc.y;
    doc
      .roundedRect(boxX, boxY, boxW, 90, 8)
      .lineWidth(2)
      .strokeColor(color)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(48)
      .fillColor(color)
      .text(String(overallScore), boxX, boxY + 8, { width: boxW, align: "center" });

    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#64748b")
      .text("/100", boxX, boxY + 58, { width: boxW, align: "center" });

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(color)
      .text(label, boxX, boxY + 74, { width: boxW, align: "center" });

    doc.moveDown(5);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#94a3b8")
      .text(
        `Generated: ${new Date(report.generated_at).toLocaleDateString()}`,
        { align: "center" }
      );

    footer(doc, 1);

    // ── PAGE 2: Executive Summary + Criteria ──────────────────────────────
    doc.addPage();
    sectionTitle(doc, "Executive Summary");

    if (report.recommendation) {
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#0f172a")
        .text(report.recommendation)
        .moveDown(0.5);
    }

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#334155")
      .text(report.executive_summary ?? "", { lineGap: 3 });

    doc.moveDown(1);
    sectionTitle(doc, "7-Criteria Screening Analysis");

    for (const cs of criteria) {
      const csColor = cs.score >= 4 ? "#16a34a" : cs.score >= 3 ? "#eab308" : "#dc2626";
      doc.moveDown(0.3);
      // Row: name | score | rationale
      const y = doc.y;
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#334155")
        .text(`${cs.criterion ?? ""} (${cs.weight ?? ""}x)`, 48, y, { width: W * 0.42, lineBreak: false });
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(csColor)
        .text(`${cs.score ?? ""}/5`, 48 + W * 0.44, y, { width: W * 0.12, align: "center", lineBreak: false });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#64748b")
        .text(cs.rationale ?? "", 48 + W * 0.57, y, { width: W * 0.43 });
      doc
        .moveTo(48, doc.y + 2)
        .lineTo(48 + W, doc.y + 2)
        .lineWidth(0.5)
        .strokeColor("#e2e8f0")
        .stroke();
    }

    footer(doc, 2);

    // ── PAGE 3: Flags ──────────────────────────────────────────────────────
    doc.addPage();
    sectionTitle(doc, "Investment Flags (YC Framework)");

    if (green.length > 0) {
      subTitle(doc, `Green Flags (${green.length})`, "#16a34a");
      for (const f of green) {
        flagBox(doc, f, "#f0fdf4", "#bbf7d0", "#16a34a", "#166534");
      }
    }

    if (red.length > 0) {
      doc.moveDown(0.5);
      subTitle(doc, `Red Flags (${red.length})`, "#dc2626");
      for (const f of red) {
        flagBox(doc, f, "#fef2f2", "#fecaca", "#dc2626", "#991b1b");
      }
    }

    footer(doc, 3);

    // ── PAGE 4: Market Research ────────────────────────────────────────────
    doc.addPage();
    sectionTitle(doc, "Market Research");

    if (mkt.market_size) {
      subTitle(doc, "Market Size", "#0f172a");
      doc.font("Helvetica").fontSize(10).fillColor("#334155").text(mkt.market_size, { lineGap: 2 });
      doc.moveDown(0.5);
    }

    if ((mkt.competitors ?? []).length > 0) {
      subTitle(doc, "Competitors", "#0f172a");
      for (const c of mkt.competitors!) {
        doc.font("Helvetica").fontSize(10).fillColor("#334155").text(`\u2022  ${c}`, { lineGap: 2 });
      }
      doc.moveDown(0.5);
    }

    if ((mkt.trends ?? []).length > 0) {
      subTitle(doc, "Market Trends", "#0f172a");
      for (const t of mkt.trends!) {
        doc.font("Helvetica").fontSize(10).fillColor("#334155").text(`\u2022  ${t}`, { lineGap: 2 });
      }
      doc.moveDown(0.5);
    }

    if (mkt.summary) {
      subTitle(doc, "Research Summary", "#0f172a");
      doc.font("Helvetica").fontSize(10).fillColor("#334155").text(mkt.summary, { lineGap: 2 });
    }

    footer(doc, 4);

    // ── PAGE 5: Detailed Analysis ──────────────────────────────────────────
    doc.addPage();
    sectionTitle(doc, "Detailed Analysis");
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#334155")
      .text(report.detailed_rationale ?? "", { lineGap: 3 });

    doc.moveDown(3);
    doc
      .moveTo(48, doc.y)
      .lineTo(doc.page.width - 48, doc.y)
      .lineWidth(0.5)
      .strokeColor("#e2e8f0")
      .stroke();
    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#94a3b8")
      .text(
        "This report was generated by Angel AI Analyst using Claude AI. " +
          "It is intended for informational purposes only and does not constitute investment advice.",
        { align: "center" }
      );

    footer(doc, 5);

    doc.end();
  });
}

// ── layout helpers ─────────────────────────────────────────────────────────

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor("#1d4ed8")
    .text(title)
    .moveDown(0.6);
}

function subTitle(doc: PDFKit.PDFDocument, title: string, color: string) {
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(hex(color))
    .text(title)
    .moveDown(0.3);
}

function flagBox(
  doc: PDFKit.PDFDocument,
  flag: Flag,
  bg: string,
  border: string,
  categoryColor: string,
  textColor: string
) {
  const margin = 48;
  const W = doc.page.width - margin * 2;
  const startY = doc.y;
  // measure text height first with a rough estimate, then draw
  const bPad = 8;
  doc
    .rect(margin, startY, W, 54)
    .fillColor(bg)
    .fill();
  doc
    .rect(margin, startY, W, 54)
    .lineWidth(1)
    .strokeColor(border)
    .stroke();
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(categoryColor)
    .text(flag.category ?? "", margin + bPad, startY + bPad, { width: W - bPad * 2, lineBreak: false });
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(textColor)
    .text(flag.flag ?? "", margin + bPad, startY + bPad + 12, { width: W - bPad * 2, lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#64748b")
    .text(flag.evidence ?? "", margin + bPad, startY + bPad + 26, { width: W - bPad * 2, lineBreak: false });
  doc.moveDown(0.8);
}

function footer(doc: PDFKit.PDFDocument, pageNum: number) {
  const y = doc.page.height - 32;
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#94a3b8")
    .text("Angel AI Analyst - Confidential", 48, y, { lineBreak: false });
  doc.text(`Page ${pageNum}`, 48, y, { align: "right", lineBreak: false });
}

// ── route ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { submission_id } = await request.json();
    if (!submission_id) {
      return NextResponse.json({ error: "submission_id required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: submission } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    const { data: report } = await supabase
      .from("analysis_reports")
      .select("*")
      .eq("submission_id", submission_id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    if (!submission || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const buffer = await buildPDF(submission as Submission, report as AnalysisReport);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${submission.startup_name}_analysis.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
