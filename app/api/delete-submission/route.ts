import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  const { submission_id } = await request.json();

  if (!submission_id) {
    return NextResponse.json({ error: "submission_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1. Fetch all documents so we can remove their storage files
  const { data: documents } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("submission_id", submission_id);

  if (documents && documents.length > 0) {
    const paths = documents.map((d: { storage_path: string }) => d.storage_path);
    const { error: storageErr } = await supabase.storage
      .from("submissions")
      .remove(paths);

    if (storageErr) {
      console.error("Storage cleanup error:", storageErr.message);
      // Non-fatal — continue with DB deletion
    }
  }

  // 2. Delete documents rows (FK → submission)
  await supabase.from("documents").delete().eq("submission_id", submission_id);

  // 3. Delete analysis report (FK → submission)
  await supabase.from("analysis_reports").delete().eq("submission_id", submission_id);

  // 4. Delete the submission itself
  const { error } = await supabase
    .from("submissions")
    .delete()
    .eq("id", submission_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
