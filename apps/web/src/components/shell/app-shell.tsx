'use client';

import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Header, SkipLink } from './header';
import { Sidebar } from './sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMobileOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <div className="min-h-dvh [--sidebar-width:16rem]">
      <SkipLink />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-(--sidebar-width) border-r border-border bg-surface lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-(--sidebar-width) max-w-[85vw] border-r border-border bg-surface shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 rounded-md p-1.5 text-muted hover:bg-surface-hover"
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-dvh flex-col lg:pl-(--sidebar-width)">
        <Header onOpenNavigation={() => setMobileOpen(true)} />
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
