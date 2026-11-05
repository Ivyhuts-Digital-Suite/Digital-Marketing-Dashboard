import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-border bg-surface">
        <Compass className="size-5 text-muted" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-foreground">Page not found</h1>
      <p className="mt-1 text-sm text-muted">The page you are looking for does not exist or has moved.</p>
      <ButtonLink href="/dashboard" className="mt-6">
        Back to dashboard
      </ButtonLink>
    </div>
  );
}
