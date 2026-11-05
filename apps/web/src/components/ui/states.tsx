import { CircleAlert, Inbox, LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { Skeleton } from './primitives';

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-surface-muted">
        <Icon className="size-5 text-muted" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = 'Something went wrong',
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const message = error instanceof ApiError ? error.message : 'An unexpected error occurred. Please try again.';
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-danger-soft">
        <CircleAlert className="size-5 text-danger" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      {requestId && <p className="mt-2 font-mono text-xs text-subtle">Request ID: {requestId}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 py-12 text-sm text-muted', className)}>
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" aria-label="Loading" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
