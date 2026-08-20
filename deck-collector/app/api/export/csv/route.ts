// GET /api/export/csv?q=&format=&cardName=
// Single CSV with every card row of every matching deck.

import { NextRequest, NextResponse } from "next/server";
import { allDecksForFilter, cardsForDecks, filterFromSearchParams } from "@/lib/queries";
import { csvCell } from "@/lib/decklist";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const decks = allDecksForFilter(filterFromSearchParams(request.nextUrl.searchParams));
  const nameById = new Map(decks.map((d) => [d.id, d.name]));
  const cards = cardsForDecks(decks.map((d) => d.id));

  const lines = ["deck_id,deck_name,card_name,quantity,category,set_code,collector_number,scryfall_id"];
  for (const card of cards) {
    lines.push(
      [
        card.deck_id,
        csvCell(nameById.get(card.deck_id) ?? ""),
        csvCell(card.card_name),
        card.quantity,
        csvCell(card.category),
        csvCell(card.set_code),
        csvCell(card.collector_number),
        csvCell(card.scryfall_id),
      ].join(",")
    );
  }

  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cards_${decks.length}_decks.csv"`,
    },
  });
}
