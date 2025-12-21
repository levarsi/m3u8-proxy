import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  Gauge,
  HardDrive,
  ListOrdered,
  Moon,
  PlayCircle,
  Settings
} from 'lucide-react';
import { useTheme } from './theme';

const navItems = [
  { to: '/dashboard', label: '仪表板', icon: Gauge },
  { to: '/proxy', label: '测试 / 播放', icon: PlayCircle },
  { to: '/cache', label: '缓存管理', icon: HardDrive },
  { to: '/settings', label: '设置', icon: Settings },
  { to: '/logs', label: '日志', icon: ListOrdered }
] as const;

export function AppShell() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      <div className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
        <div className="flex w-full items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            <div className="font-semibold">M3U8 代理服务器</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              aria-label="切换主题"
              title="切换 light/dark"
            >
              <Moon className="h-4 w-4" />
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
            <div className="text-xs text-slate-500 dark:text-slate-300">UI v2</div>
          </div>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[240px_1fr]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-950/40">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                      isActive
                        ? 'bg-sky-500/15 text-sky-800 dark:text-sky-200'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/5 dark:hover:text-white'
                    ].join(' ')
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="min-h-[70vh] rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
