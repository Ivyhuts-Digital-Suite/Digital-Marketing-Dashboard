'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/** Modal built on the native <dialog> element (focus trapping, Escape and inertness for free). */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-[1px]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 id="dialog-title" className="text-base font-semibold">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted hover:bg-surface-hover hover:text-foreground"
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
