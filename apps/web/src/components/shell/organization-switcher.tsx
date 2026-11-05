'use client';

import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { ROLE_LABELS } from '@mp/shared';
import { useWorkspace } from '@/lib/session';
import { MenuItem, MenuSeparator, PopoverMenu } from '@/components/ui/menu';

export function OrganizationSwitcher() {
  const router = useRouter();
  const { session, organization, setActiveOrganization } = useWorkspace();

  return (
    <PopoverMenu
      label="Switch organization"
      align="start"
      className="w-[calc(var(--sidebar-width)-1.5rem)] min-w-0"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-left shadow-xs transition-colors hover:bg-surface-hover"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-xs font-semibold text-foreground">
            {organization.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{organization.name}</span>
            <span className="block truncate text-xs text-muted">{ROLE_LABELS[organization.membership.role]}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-subtle" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-subtle">Organizations</p>
          {session.organizations.map((org) => (
            <MenuItem
              key={org.id}
              onSelect={() => {
                setActiveOrganization(org.id);
                close();
              }}
            >
              <span className="min-w-0 flex-1 truncate">{org.name}</span>
              {org.id === organization.id && <Check className="size-4 text-primary" aria-label="Current organization" />}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem
            onSelect={() => {
              close();
              router.push('/workspace/organizations?create=1');
            }}
          >
            <Plus className="size-4 text-muted" aria-hidden />
            Create organization
          </MenuItem>
        </>
      )}
    </PopoverMenu>
  );
}
