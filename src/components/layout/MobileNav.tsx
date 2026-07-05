import { NavLink } from 'react-router-dom';
import { Search, Library, Layers, Heart, BarChart3 } from 'lucide-react';

const navItems = [
  { path: '/search', icon: Search, label: 'Search' },
  { path: '/collection', icon: Library, label: 'Collection' },
  { path: '/decks', icon: Layers, label: 'Decks' },
  { path: '/wishlist', icon: Heart, label: 'Wishlist' },
  { path: '/stats', icon: BarChart3, label: 'Stats' },
];

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40">
      <div className="flex items-center justify-around py-2">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-xs ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`
            }
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
