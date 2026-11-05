'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChartColumn } from 'lucide-react';
import { NAVIGATION, matchNavItem } from '@/lib/navigation';
import { cn } from '@/lib/cn';
import { useWorkspace } from '@/lib/session';
import { OrganizationSwitcher } from './organization-switcher';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useWorkspace();
  const active = matchNavItem(pathname)?.item.href;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ChartColumn className="size-4" aria-hidden />
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">{process.env.NEXT_PUBLIC_APP_NAME}</span>
      </div>

      <div className="px-3 pb-3">
        <OrganizationSwitcher />
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 pb-6">
        {NAVIGATION.map((section) => {
          const items = section.items.filter((item) => !item.permission || can(item.permission));
          if (items.length === 0) return null;
          return (
            <div key={section.title} className="mt-5 first:mt-1">
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">{section.title}</p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const isActive = item.href === active;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'bg-primary-soft font-medium text-primary'
                            : 'text-muted hover:bg-surface-hover hover:text-foreground',
                        )}
                      >
                        <item.icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{item.title}</span>
                        {item.status === 'planned' && (
                          <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-subtle">Soon</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
