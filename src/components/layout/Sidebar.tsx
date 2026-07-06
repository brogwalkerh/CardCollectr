import { NavLink } from 'react-router-dom';
import { Search, Library, Layers, Heart, BarChart3, ArrowUpDown, Camera, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const navItems = [
  { path: '/search', icon: Search, label: 'Search' },
  { path: '/collection', icon: Library, label: 'Collection' },
  { path: '/decks', icon: Layers, label: 'Decks' },
  { path: '/wishlist', icon: Heart, label: 'Wishlist' },
  { path: '/stats', icon: BarChart3, label: 'Statistics' },
  { path: '/import-export', icon: ArrowUpDown, label: 'Import/Export' },
  { path: '/scanner', icon: Camera, label: 'Scanner' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen sticky top-0">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">CC</span>
          CardCollectr
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">MTG Collection Manager</p>
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
    </aside>
  );
}
