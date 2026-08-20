// API route: /api/decks — searchable, paginated view of STORED decks
// (reads our SQLite only; never calls Archidekt).

import { NextRequest, NextResponse } from "next/server";
import { searchDecks, filterFromSearchParams } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? 50) || 50));
  const result = searchDecks(filterFromSearchParams(sp), page, pageSize);
  return NextResponse.json({ ...result, page, pageSize });
}
