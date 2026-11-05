import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'block w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-xs transition-colors ' +
  'placeholder:text-subtle hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus:ring-danger/30';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, 'h-9', className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, 'h-9 pr-8', className)} {...props}>
      {children}
    </select>
  );
}

interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
  className?: string;
}

/** Label + control + hint/error, wired up with ids and ARIA attributes. */
export function Field({ label, error, hint, children, className }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children({ id, ...(error && { 'aria-invalid': true as const }), ...(describedBy && { 'aria-describedby': describedBy }) })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
