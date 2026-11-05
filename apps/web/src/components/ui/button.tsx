import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const VARIANTS = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
  secondary: 'border border-border bg-surface text-foreground hover:bg-surface-hover shadow-xs',
  ghost: 'text-muted hover:bg-surface-hover hover:text-foreground',
  danger: 'bg-danger text-white hover:opacity-90 shadow-sm',
} as const;

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  icon: 'h-9 w-9 justify-center',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({ variant, size, loading, disabled, className, children, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
