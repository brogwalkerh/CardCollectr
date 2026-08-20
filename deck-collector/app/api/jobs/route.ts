// API route: /api/jobs
// In the App Router, a file named route.ts exposes HTTP handlers — the
// exported function names (GET, POST, ...) are the HTTP methods.
// This code runs only on the server, so it may touch SQLite and Archidekt.

import { NextRequest, NextResponse } from "next/server";
import { createJob, listJobs, updateJob, queueCounts, queueErrors } from "@/lib/db";
import { kickRunner, type JobParams } from "@/lib/runner";
import { buildListUrl } from "@/lib/archidekt";

// Tell Next.js this route must run per-request (it reads a live database),
// never be statically cached at build time.
export const dynamic = "force-dynamic";

/** GET /api/jobs — every job plus live queue progress. */
export async function GET() {
  const jobs = listJobs().map((job) => ({
    ...job, // spread: shallow-copies the row's fields into this new object
    queue: queueCounts(job.id),
    errors: queueErrors(job.id, 10),
  }));
  return NextResponse.json({ jobs });
}

/** POST /api/jobs — create a job from the New Job form and start it. */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<JobParams>;

  const maxPages = Number(body.maxPages);
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 50) {
    return NextResponse.json({ error: "maxPages must be an integer from 1 to 50" }, { status: 400 });
  }

  // Keep only the fields we understand; drop empty strings so the stored
  // query_params JSON stays clean.
  const params: JobParams = {
    maxPages,
    refresh: body.refresh === true,
    orderBy: body.orderBy || "-createdAt",
  };
  if (body.formats) params.formats = String(body.formats);
  if (body.cardName) params.cardName = String(body.cardName);
  if (body.commander) params.commander = String(body.commander);
  if (body.name) params.name = String(body.name);

  const jobId = createJob(params);
  updateJob(jobId, { status: "running" });
  kickRunner(); // fire-and-forget: the response returns while the job runs

  return NextResponse.json({ jobId, firstPageUrl: buildListUrl(params, 1) });
}
