import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8', className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
