import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReportPDF } from "@/components/ReportPDF";
import type { Submission, AnalysisReport } from "@/lib/types";

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(ReportPDF, {
      submission: submission as Submission,
      report: report as AnalysisReport,
    }) as any;
    const buffer = await renderToBuffer(element);

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
