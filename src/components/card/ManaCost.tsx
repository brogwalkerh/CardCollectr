interface ManaCostProps {
  cost?: string;
  className?: string;
}

const MANA_COLORS: Record<string, string> = {
  W: 'bg-amber-100 text-amber-900',
  U: 'bg-blue-200 text-blue-900',
  B: 'bg-gray-700 text-gray-100',
  R: 'bg-red-200 text-red-900',
  G: 'bg-green-200 text-green-900',
  C: 'bg-gray-300 text-gray-800',
};

export function ManaCost({ cost, className = '' }: ManaCostProps) {
  if (!cost) return null;

  const symbols = cost.match(/\{([^}]+)\}/g) || [];

  return (
    <span className={`inline-flex gap-0.5 ${className}`}>
      {symbols.map((symbol, i) => {
        const value = symbol.replace(/[{}]/g, '');
        const colorClass = MANA_COLORS[value] || 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200';
        return (
          <span
            key={i}
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${colorClass}`}
          >
            {value}
          </span>
        );
      })}
    </span>
  );
}
