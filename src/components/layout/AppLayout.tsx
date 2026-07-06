import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 pb-16 md:pb-0 overflow-x-hidden">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
