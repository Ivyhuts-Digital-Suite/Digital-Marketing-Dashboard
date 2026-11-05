'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronRight, LogOut, Menu, Settings } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { matchNavItem } from '@/lib/navigation';
import { useWorkspace } from '@/lib/session';
import { Avatar } from '@/components/ui/primitives';
import { MenuItem, MenuSeparator, PopoverMenu } from '@/components/ui/menu';
import { EmptyState } from '@/components/ui/states';
import { ThemeToggle } from './theme';

function Breadcrumbs() {
  const pathname = usePathname();
  const { organization } = useWorkspace();
  const match = matchNavItem(pathname);
  const crumbs = [organization.name, match?.section, match?.item.title].filter(Boolean) as string[];

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb}-${index}`} className={last ? 'min-w-0' : 'hidden min-w-0 items-center gap-1.5 sm:flex'}>
              <span
                className={last ? 'block truncate font-medium text-foreground' : 'truncate text-muted'}
                aria-current={last ? 'page' : undefined}
              >
                {crumb}
              </span>
              {!last && <ChevronRight className="size-3.5 shrink-0 text-subtle" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Notifications() {
  return (
    <PopoverMenu
      label="Notifications"
      role="dialog"
      className="w-80"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label="Notifications"
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Bell className="size-4" />
        </button>
      )}
    >
      {() => (
        <div>
          <p className="border-b border-border px-3 py-2.5 text-sm font-semibold text-foreground">Notifications</p>
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            description="Alerts about campaigns, leads and AI insights will appear here once those modules are live."
            className="py-8"
          />
        </div>
      )}
    </PopoverMenu>
  );
}

function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useWorkspace();
  const { user } = session;

  const signOut = async () => {
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
    queryClient.clear();
    router.replace('/login');
  };

  return (
    <PopoverMenu
      label="Account"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label="Open account menu"
          className="flex items-center rounded-full p-0.5 transition-colors hover:bg-surface-hover"
        >
          <Avatar name={user.name} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <MenuSeparator />
          <MenuItem
            onSelect={() => {
              close();
              router.push('/workspace/settings#profile');
            }}
          >
            <Settings className="size-4 text-muted" aria-hidden />
            Profile & security
          </MenuItem>
          <MenuItem danger onSelect={signOut}>
            <LogOut className="size-4" aria-hidden />
            Sign out
          </MenuItem>
        </>
      )}
    </PopoverMenu>
  );
}

export function Header({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenNavigation}
        className="-ml-1 inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-hover lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Notifications />
        <UserMenu />
      </div>
    </header>
  );
}

export function SkipLink() {
  return (
    <Link
      href="#main"
      className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Skip to content
    </Link>
  );
}
