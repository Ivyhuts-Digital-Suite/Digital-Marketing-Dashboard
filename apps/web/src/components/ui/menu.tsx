'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PopoverMenuProps {
  /** Renders the trigger. Spread `props` onto a <button>. */
  trigger: (props: {
    'aria-expanded': boolean;
    'aria-controls': string;
    'aria-haspopup': 'menu' | 'dialog';
    onClick: () => void;
  }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  role?: 'menu' | 'dialog';
  label: string;
  className?: string;
}

/** Lightweight accessible popover: closes on Escape, outside click and item selection. */
export function PopoverMenu({ trigger, children, align = 'end', role = 'menu', label, className }: PopoverMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {trigger({ 'aria-expanded': open, 'aria-controls': id, 'aria-haspopup': role, onClick: () => setOpen((v) => !v) })}
      {open && (
        <div
          id={id}
          role={role}
          aria-label={label}
          className={cn(
            'absolute top-full z-50 mt-2 min-w-56 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  className,
  danger,
}: {
  children: ReactNode;
  onSelect: () => void;
  className?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-hover',
        danger ? 'text-danger' : 'text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}
