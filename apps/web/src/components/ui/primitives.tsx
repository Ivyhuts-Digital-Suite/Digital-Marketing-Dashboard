import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-border bg-surface shadow-xs', className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-border px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const BADGE_TONES = {
  neutral: 'bg-surface-muted text-muted border-border',
  primary: 'bg-primary-soft text-primary border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

const ALERT_TONES = {
  info: { className: 'border-primary/20 bg-primary-soft text-foreground', icon: Info, iconClass: 'text-primary' },
  success: { className: 'border-success/20 bg-success-soft text-foreground', icon: CircleCheck, iconClass: 'text-success' },
  warning: { className: 'border-warning/25 bg-warning-soft text-foreground', icon: TriangleAlert, iconClass: 'text-warning' },
  danger: { className: 'border-danger/20 bg-danger-soft text-foreground', icon: CircleAlert, iconClass: 'text-danger' },
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof ALERT_TONES;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { className: toneClass, icon: Icon, iconClass } = ALERT_TONES[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-lg border p-3 text-sm', toneClass, className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-muted">{children}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-muted', className)} aria-hidden />;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary',
        className,
      )}
    >
      {initials || '?'}
    </span>
  );
}
