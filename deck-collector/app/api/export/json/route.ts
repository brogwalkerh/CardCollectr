// GET /api/export/json?q=&format=&cardName=
// The raw Archidekt responses (raw_json column) for every matching deck,
// streamed out as one JSON array.

import { NextRequest, NextResponse } from "next/server";
import { allDecksForFilter, rawJsonForDeck, filterFromSearchParams } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const decks = allDecksForFilter(filterFromSearchParams(request.nextUrl.searchParams));

  // raw_json values are already JSON text — join them instead of re-parsing
  // (parse+stringify of thousands of decks would just burn CPU).
  const parts: string[] = [];
  for (const deck of decks) {
    const raw = rawJsonForDeck(deck.id);
    if (raw) parts.push(raw);
  }
  const body = "[\n" + parts.join(",\n") + "\n]\n";

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="decks_raw_${decks.length}.json"`,
    },
  });
}
