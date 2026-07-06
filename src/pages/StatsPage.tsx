import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useCollectionStats } from '../hooks/useCollectionStats';
import { EmptyState } from '../components/ui/EmptyState';
import { formatPrice, formatNumber } from '../utils/format';

const COLOR_MAP: Record<string, string> = {
  W: '#F9E076',
  U: '#0E68AB',
  B: '#3D3D3D',
  R: '#D3202A',
  G: '#00733E',
  C: '#CAC5C0',
};

const RARITY_COLORS: Record<string, string> = {
  common: '#1a1a1a',
  uncommon: '#6b7280',
  rare: '#b8860b',
  mythic: '#dc2626',
};

export function StatsPage() {
  const stats = useCollectionStats();

  const colorData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.colorCounts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({ name: key, value, fill: COLOR_MAP[key] || '#999' }));
  }, [stats]);

  const rarityData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.rarityCounts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({ name: key, value, fill: RARITY_COLORS[key] || '#999' }));
  }, [stats]);

  const topSets = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.setCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([_code, data]) => ({ name: data.name.length > 20 ? data.name.slice(0, 18) + '...' : data.name, count: data.count, value: data.value }));
  }, [stats]);

  if (!stats) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Statistics</h1>
        <EmptyState icon={<BarChart3 size={48} />} title="No data yet" description="Add cards to your collection to see statistics" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Statistics</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(stats.totalCards)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Cards</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(stats.uniqueCards)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Unique Cards</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatPrice(stats.totalValue)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Value</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalCards > 0 ? formatPrice(stats.totalValue / stats.totalCards) : '$0.00'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Card Value</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Color Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={colorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                {colorData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Rarity Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rarityData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value">
                {rarityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {topSets.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Top Sets by Card Count</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topSets} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [String(v), 'Cards']} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
