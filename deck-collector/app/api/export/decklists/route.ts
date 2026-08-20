// GET /api/export/decklists?q=&format=&cardName=
// Zip of plain-text decklists, one .txt per matching deck.

import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { allDecksForFilter, cardsForDeck, filterFromSearchParams } from "@/lib/queries";
import { renderDecklist, safeFilename } from "@/lib/decklist";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const decks = allDecksForFilter(filterFromSearchParams(request.nextUrl.searchParams));
  if (decks.length === 0) {
    return NextResponse.json({ error: "no decks match this filter" }, { status: 404 });
  }

  const zip = new JSZip();
  for (const deck of decks) {
    zip.file(safeFilename(deck.name, deck.id), renderDecklist(deck, cardsForDeck(deck.id)));
  }

  // Built in memory — fine at this scale (text compresses hard; even
  // thousands of decklists are a few MB).
  const bytes = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/zip",
      // attachment = browser saves it as a file instead of rendering it.
      "Content-Disposition": `attachment; filename="decklists_${decks.length}.zip"`,
    },
  });
}
