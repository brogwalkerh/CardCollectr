// API route: /api/jobs/[id] — pause / resume / cancel one job.
// [id] in the folder name is a dynamic segment; Next.js hands it to us via
// `params`. In Next 16, params is a Promise and must be awaited.

import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJob, queueCounts, queueErrors } from "@/lib/db";
import { kickRunner } from "@/lib/runner";

export const dynamic = "force-dynamic";

/** GET /api/jobs/123 — one job with progress (the Jobs page polls this). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(Number(id));
  if (!job) return NextResponse.json({ error: "no such job" }, { status: 404 });
  return NextResponse.json({ ...job, queue: queueCounts(job.id), errors: queueErrors(job.id, 10) });
}

/** POST /api/jobs/123 with {"action": "pause" | "resume" | "cancel"}. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(Number(id));
  if (!job) return NextResponse.json({ error: "no such job" }, { status: 404 });

  const { action } = (await request.json()) as { action?: string };

  switch (action) {
    case "pause":
      if (job.status !== "running") {
        return NextResponse.json({ error: `cannot pause a ${job.status} job` }, { status: 400 });
      }
      // The runner re-reads status before every request, so this takes
      // effect within ~1 request.
      updateJob(job.id, { status: "paused" });
      break;

    case "resume":
      if (job.status !== "paused" && job.status !== "failed") {
        return NextResponse.json({ error: `cannot resume a ${job.status} job` }, { status: 400 });
      }
      updateJob(job.id, { status: "running", error: null });
      kickRunner();
      break;

    case "cancel":
      if (job.status === "done" || job.status === "cancelled") {
        return NextResponse.json({ error: `job is already ${job.status}` }, { status: 400 });
      }
      updateJob(job.id, { status: "cancelled", finished_at: new Date().toISOString() });
      break;

    default:
      return NextResponse.json({ error: "action must be pause, resume, or cancel" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: getJob(job.id)!.status });
}
