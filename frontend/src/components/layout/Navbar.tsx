import { Link, useLocation } from 'react-router-dom';
import { Terminal, History, BarChart2 } from 'lucide-react';
import { getDeviceId } from '@/lib/device';

export function Navbar() {
  const location = useLocation();
  const deviceId = getDeviceId();
  const shortDeviceId = deviceId.slice(0, 8);

  const navItems = [
    { label: 'Practice', href: '/setup', icon: Terminal },
    { label: 'History', href: '/history', icon: History },
    { label: 'Progress', href: '/progress', icon: BarChart2 },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 group">
              <span className="flex h-7 w-7 items-center justify-center rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-primary text-lime text-xs font-bold tracking-tight">
                DR
              </span>
              <div className="flex flex-col">
                <span className="font-heading text-lg font-bold tracking-tight text-ink group-hover:text-primary transition-colors">
                  Dryrun
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex min-h-[44px] items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider font-semibold transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                      isActive
                        ? 'bg-soft-green text-primary'
                        : 'text-muted hover:text-ink hover:bg-background'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background border border-border text-xs text-muted font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-lime border border-primary/20" />
              <span className="truncate max-w-[100px]">{shortDeviceId}</span>
            </div>

            <Link
              to="/setup"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-lime shadow-sm hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-opacity"
            >
              Start Viva
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar for < 768px screens */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-paper/95 backdrop-blur-md px-3 py-1 flex items-center justify-around"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex flex-col items-center justify-center min-h-[44px] min-w-[64px] px-2 py-1 rounded-lg text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                isActive ? 'text-primary bg-soft-green/60' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
