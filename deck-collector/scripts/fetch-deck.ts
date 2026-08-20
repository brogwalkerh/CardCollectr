// CLI smoke test for the Archidekt client (build step 1 verification).
//
// Usage:
//   npm run fetch-deck -- 1234567        # fetch a specific deck ID
//   npm run fetch-deck                   # no ID: grab the newest public EDH
//                                        # deck from the list endpoint first
//   npm run fetch-deck -- 1234567 --raw  # dump the full raw JSON instead of
//                                        # the summarized view
//
// Run with `tsx`, which executes TypeScript directly (think `dotnet script` /
// `jshell` — no separate compile step).

import { getDeck, listDecks, extractCardName, buildDeckUrl, type DeckDetail } from "../lib/archidekt";
import { formatName } from "../lib/formats";

function printDeck(deck: DeckDetail, raw: boolean): void {
  if (raw) {
    console.log(JSON.stringify(deck, null, 2));
    return;
  }
  console.log(`\nDeck ${deck.id}: ${deck.name}`);
  console.log(`  format:  ${formatName(deck.deckFormat)}`);
  console.log(`  owner:   ${deck.owner?.username ?? "(unknown)"}`);
  // `?.` is optional chaining: null-safe member access, like C#'s `?.`
  console.log(`  created: ${deck.createdAt}   updated: ${deck.updatedAt}`);
  console.log(`  cards:   ${deck.cards?.length ?? 0} entries`);
  for (const entry of (deck.cards ?? []).slice(0, 15)) {
    const set = entry.card?.edition?.editioncode ?? "???";
    const cn = entry.card?.collectorNumber ?? "?";
    const cats = entry.categories?.join(", ") || "(no category)";
    console.log(`    ${entry.quantity}x ${extractCardName(entry)}  [${set} #${cn}]  — ${cats}`);
  }
  if ((deck.cards?.length ?? 0) > 15) {
    console.log(`    ... and ${deck.cards.length - 15} more (use --raw for everything)`);
  }
}

// Top-level `async` entry point. A Promise rejection here would otherwise be
// swallowed with a nonzero-but-vague exit, so we catch and report explicitly.
async function main(): Promise<void> {
  // process.argv = [node path, script path, ...actual args] — hence slice(2).
  const args = process.argv.slice(2);
  const raw = args.includes("--raw");
  const idArg = args.find((a) => /^\d+$/.test(a));

  let id: number;
  if (idArg) {
    id = Number(idArg);
  } else {
    console.log("No deck ID given — asking the list endpoint for the newest Commander deck...");
    const page = await listDecks({ formats: "3", orderBy: "-createdAt", pageSize: 5 }, 1);
    console.log(`List endpoint reports count=${page.count}; first ids: ${page.results.map((d) => d.id).join(", ")}`);
    id = page.results[0].id;
  }

  console.log(`Fetching ${buildDeckUrl(id)} ...`);
  const deck = await getDeck(id);
  printDeck(deck, raw);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
