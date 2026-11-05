import { CircleCheck, Clock, Plug } from 'lucide-react';
import { notFound } from 'next/navigation';
import { findNavItem } from '@/lib/navigation';
import { ButtonLink } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/primitives';
import { PageContainer, PageHeader } from '@/components/layout/page';

/**
 * Honest placeholder for modules scheduled in later milestones. It shows what the module
 * will do and never renders sample metrics that could be mistaken for real account data.
 */
export function ModulePlaceholder({ href }: { href: string }) {
  const match = findNavItem(href);
  if (!match) notFound();
  const { item } = match;
  const dependsOnAds = ['Campaigns', 'Overview', 'Intelligence', 'Reports'].includes(match.section);

  return (
    <PageContainer>
      <PageHeader
        title={item.title}
        description={item.description}
        badge={
          <Badge tone="warning">
            <Clock className="size-3" aria-hidden />
            Planned{item.milestone ? ` · ${item.milestone} milestone` : ''}
          </Badge>
        }
      />

      <Card className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1fr_320px]">
          <div className="p-6 sm:p-8">
            <div className="mb-5 flex size-11 items-center justify-center rounded-xl border border-border bg-surface-muted">
              <item.icon className="size-5 text-muted" aria-hidden />
            </div>
            <h2 className="text-base font-semibold text-foreground">This module is not available yet</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              {item.title} is part of an upcoming milestone. No data is shown here until the module is built and connected to
              real sources.
            </p>
            {item.capabilities && (
              <ul className="mt-6 space-y-2.5">
                {item.capabilities.map((capability) => (
                  <li key={capability} className="flex items-start gap-2.5 text-sm text-foreground">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
                    {capability}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {dependsOnAds && (
            <div className="border-t border-border bg-surface-muted p-6 sm:p-8 md:border-l md:border-t-0">
              <Plug className="size-5 text-muted" aria-hidden />
              <h3 className="mt-3 text-sm font-semibold text-foreground">Requires connected ad accounts</h3>
              <p className="mt-1 text-sm text-muted">
                Data for this module will come from your Google Ads and Meta Ads connections.
              </p>
              <ButtonLink href="/workspace/integrations" variant="secondary" size="sm" className="mt-4">
                View integrations
              </ButtonLink>
            </div>
          )}
        </div>
      </Card>
    </PageContainer>
  );
}
