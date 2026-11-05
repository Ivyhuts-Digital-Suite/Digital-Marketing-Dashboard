'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, ChartColumn, Circle, CircleCheck, History, Plug, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { ROLE_LABELS } from '@mp/shared';
import { useWorkspace } from '@/lib/session';
import { ActivityChart, ACTIVITY_DAYS } from '@/features/dashboard/activity-chart';
import { describeAuditAction, timeAgo } from '@/features/workspace/audit-format';
import { useAuditLogs, useIntegrationCatalog, useInvitations, useMembers } from '@/features/workspace/queries';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { ButtonLink } from '@/components/ui/button';
import { Avatar, Card, CardHeader, Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number | undefined;
  hint?: string;
  icon: LucideIcon;
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <Icon className="size-4 text-subtle" aria-hidden />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-16" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value ?? '—'}</p>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

function SetupChecklist({ connected, teamSize }: { connected: number; teamSize: number | undefined }) {
  const steps = [
    { label: 'Create your organization', done: true, href: '/workspace/settings' },
    { label: 'Invite your team', done: (teamSize ?? 0) > 1, href: '/workspace/team' },
    { label: 'Connect an advertising account', done: connected > 0, href: '/workspace/integrations' },
  ];
  const completed = steps.filter((s) => s.done).length;
  return (
    <Card>
      <CardHeader title="Get set up" description={`${completed} of ${steps.length} complete`} />
      <ul className="divide-y divide-border">
        {steps.map((step) => (
          <li key={step.label}>
            <Link href={step.href} className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-surface-hover">
              {step.done ? (
                <CircleCheck className="size-4 text-success" aria-label="Done" />
              ) : (
                <Circle className="size-4 text-subtle" aria-label="Not done" />
              )}
              <span className={step.done ? 'text-muted line-through' : 'text-foreground'}>{step.label}</span>
              <ArrowRight className="ml-auto size-4 text-subtle" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ActivitySection() {
  const [since] = useState(() => new Date(Date.now() - ACTIVITY_DAYS * 86_400_000).toISOString());
  const audit = useAuditLogs({ limit: 100, since });

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Workspace activity"
        description={`Audited events per day, last ${ACTIVITY_DAYS} days`}
        action={
          <ButtonLink href="/workspace/settings#audit-log" variant="ghost" size="sm">
            Audit log
          </ButtonLink>
        }
      />
      {audit.isPending ? (
        <LoadingState />
      ) : audit.error ? (
        <ErrorState error={audit.error} onRetry={() => audit.refetch()} />
      ) : (
        <div className="px-3 pb-2 pt-4 sm:px-5">
          <ActivityChart logs={audit.data.items} />
          {audit.data.pagination.total > audit.data.items.length && (
            <p className="px-2 pb-2 text-xs text-muted">Showing the most recent {audit.data.items.length} events.</p>
          )}
          <ul className="mt-2 divide-y divide-border border-t border-border">
            {audit.data.items.slice(0, 5).map((log) => (
              <li key={log.id} className="flex items-center gap-3 px-2 py-2.5 text-sm">
                <Avatar name={log.actor?.name ?? 'System'} className="size-7" />
                <p className="min-w-0 flex-1 truncate text-foreground">
                  <span className="font-medium">{log.actor?.name ?? 'System'}</span>{' '}
                  <span className="text-muted">{describeAuditAction(log)}</span>
                </p>
                <time dateTime={log.createdAt} className="shrink-0 text-xs text-subtle">
                  {timeAgo(log.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const { session, organization, can } = useWorkspace();
  const members = useMembers();
  const invitations = useInvitations();
  const catalog = useIntegrationCatalog();
  const connected = catalog.data?.reduce((sum, provider) => sum + provider.connections.length, 0) ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${session.user.name.split(' ')[0]}`}
        description={`Here's what is happening in ${organization.name}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Team members" value={members.data?.length} icon={Users} loading={members.isPending && can('members:read')} />
        <StatTile
          label="Pending invitations"
          value={can('members:invite') ? invitations.data?.length : undefined}
          hint={can('members:invite') ? undefined : 'Visible to members who can invite'}
          icon={History}
          loading={invitations.isPending && can('members:invite')}
        />
        <StatTile
          label="Ad platform connections"
          value={can('integrations:read') ? connected : undefined}
          hint="Google Ads and Meta Ads"
          icon={Plug}
          loading={catalog.isPending && can('integrations:read')}
        />
        <StatTile label="Your role" value={ROLE_LABELS[organization.membership.role]} icon={ShieldCheck} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {can('audit:read') ? (
          <ActivitySection />
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader title="Workspace activity" />
            <EmptyState icon={History} title="Activity is visible to administrators" description="Your role does not include audit log access." />
          </Card>
        )}
        <div className="space-y-6">
          <SetupChecklist connected={connected} teamSize={members.data?.length} />
          <Card>
            <CardHeader title="Advertising performance" />
            <EmptyState
              icon={ChartColumn}
              title="No advertising data yet"
              description="Performance metrics appear here after a Google Ads or Meta Ads account is connected and synced."
              action={
                <ButtonLink href="/workspace/integrations" variant="secondary" size="sm">
                  View integrations
                </ButtonLink>
              }
              className="py-8"
            />
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
