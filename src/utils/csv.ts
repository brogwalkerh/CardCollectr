import type { CollectionEntry } from '../types';

export function exportCollectionToCSV(
  entries: Array<CollectionEntry & { name: string; set: string; collectorNumber: string }>
): string {
  const header = 'Count,Name,Set,Collector Number,Condition,Foil,Purchase Price';
  const rows = entries.map(e =>
    `${e.quantity},"${e.name}",${e.set},${e.collectorNumber},${e.condition},${e.isFoil ? 'Yes' : 'No'},${e.purchasePrice ?? ''}`
  );
  return [header, ...rows].join('\n');
}

export function parseCSV(content: string): Array<{
  count: number;
  name: string;
  set?: string;
  collectorNumber?: string;
  condition?: string;
  foil: boolean;
  purchasePrice?: number;
}> {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('name') || header.includes('count');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map(line => {
    const parts = parseCSVLine(line);
    return {
      count: parseInt(parts[0]) || 1,
      name: parts[1]?.replace(/"/g, '') || '',
      set: parts[2] || undefined,
      collectorNumber: parts[3] || undefined,
      condition: parts[4] || undefined,
      foil: (parts[5] || '').toLowerCase() === 'yes',
      purchasePrice: parts[6] ? parseFloat(parts[6]) : undefined,
    };
  }).filter(r => r.name.length > 0);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
